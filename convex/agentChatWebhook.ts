// convex/agentChatWebhook.ts
// Handles webhook callbacks from VPS Orchestrator with agent response streaming

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Task Directive Parsing ──
// Agents can include <task_directives>[...]</task_directives> in their responses
// to create/update/complete tasks on the Kanban board.

interface TaskDirective {
  action: "create" | "update" | "complete";
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  agentId?: string;
  tags?: string[];
  taskId?: string; // For update/complete — Convex ID of existing task
}

function parseTaskDirectives(content: string): {
  directives: TaskDirective[];
  cleanContent: string;
} {
  const regex = /<task_directives>([\s\S]*?)<\/task_directives>/g;
  const directives: TaskDirective[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        if (d.action && typeof d.action === "string") {
          directives.push(d as TaskDirective);
        }
      }
    } catch {
      // Malformed JSON — skip silently
      console.warn("[webhook] Failed to parse task_directives JSON");
    }
    cleanContent = cleanContent.replace(match[0], "");
  }

  return { directives, cleanContent: cleanContent.trim() };
}

/**
 * Receive an agent response event from the VPS Orchestrator webhook.
 * Called by the HTTP handler in http.ts after HMAC verification.
 *
 * States:
 * - "delta": streaming partial content — upsert a streaming message
 * - "final": complete response — finalize the message
 * - "error": agent error — mark as failed
 */
export const receiveAgentResponse = internalMutation({
  args: {
    agentId: v.string(),
    orgId: v.string(),
    messageId: v.string(),
    content: v.string(),
    state: v.union(v.literal("delta"), v.literal("final"), v.literal("error")),
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find existing streaming message for this runId
    const existing = await ctx.db
      .query("agentChatMessages")
      .withIndex("runId", (q) => q.eq("runId", args.runId))
      .first();

    // Helper: look up the original user message by ID
    const getOriginalMessage = async () => {
      if (!args.messageId) return null;
      const id = ctx.db.normalizeId("agentChatMessages", args.messageId);
      if (!id) return null;
      return ctx.db.get(id);
    };

    // Helper: look up the queue item for this message
    const getQueueItem = async () => {
      if (!args.messageId) return null;
      const msgId = ctx.db.normalizeId("agentChatMessages", args.messageId);
      if (!msgId) return null;
      return ctx.db
        .query("agentChatQueue")
        .withIndex("messageId", (q) => q.eq("messageId", msgId))
        .first();
    };

    if (args.state === "delta") {
      if (existing) {
        // Append delta content to existing streaming message
        await ctx.db.patch(existing._id, {
          content: existing.content + args.content,
          timestamp: Date.now(),
        });
      } else {
        // Create new streaming message
        const originalMsg = await getOriginalMessage();
        if (originalMsg) {
          await ctx.db.insert("agentChatMessages", {
            orgId: originalMsg.orgId,
            agentId: originalMsg.agentId,
            userId: originalMsg.userId,
            content: args.content,
            role: "agent",
            sessionId: originalMsg.sessionId,
            status: "streaming",
            runId: args.runId,
            replyTo: originalMsg._id,
            timestamp: Date.now(),
          });
        }
      }
    } else if (args.state === "final") {
      // Parse task directives from agent response before storing
      const finalContent = args.content || existing?.content || "";
      const { directives, cleanContent } = parseTaskDirectives(finalContent);
      const displayContent = cleanContent || finalContent;

      let agentMessageId: Id<"agentChatMessages"> | undefined;

      if (existing) {
        // Finalize the streaming message with clean content
        await ctx.db.patch(existing._id, {
          content: displayContent,
          status: "delivered",
          ...(directives.length > 0 && { processedTaskDirectives: directives.length }),
          timestamp: Date.now(),
        });
        agentMessageId = existing._id;
      } else {
        // No streaming message existed (maybe deltas were skipped) — create final
        const originalMsg = await getOriginalMessage();
        if (originalMsg) {
          agentMessageId = await ctx.db.insert("agentChatMessages", {
            orgId: originalMsg.orgId,
            agentId: originalMsg.agentId,
            userId: originalMsg.userId,
            content: displayContent,
            role: "agent",
            sessionId: originalMsg.sessionId,
            status: "delivered",
            runId: args.runId,
            replyTo: originalMsg._id,
            ...(directives.length > 0 && { processedTaskDirectives: directives.length }),
            timestamp: Date.now(),
          });
        }
      }

      // ── Process Task Directives ──
      if (directives.length > 0) {
        const originalMsg = await getOriginalMessage();
        if (originalMsg) {
          const orgId = originalMsg.orgId;
          const userId = originalMsg.userId;

          for (const directive of directives) {
            try {
              if (directive.action === "create" && directive.title) {
                const taskId = await ctx.db.insert("agentTasks", {
                  orgId,
                  title: directive.title,
                  description: directive.description || "",
                  agentId: (directive.agentId || args.agentId) as any,
                  status: "todo",
                  priority: directive.priority || "medium",
                  createdBy: userId,
                  assignedTo: userId,
                  createdByAgent: args.agentId as any,
                  sourceMessageId: agentMessageId,
                  tags: directive.tags || [],
                });

                // Log activity
                await ctx.db.insert("agentActivity", {
                  orgId,
                  agentId: args.agentId as any,
                  action: "task_created",
                  target: directive.title,
                  taskId,
                  timestamp: Date.now(),
                });

                console.log(`[webhook] Agent ${args.agentId} created task: ${directive.title}`);
              } else if (directive.action === "update" && directive.taskId) {
                const taskDocId = ctx.db.normalizeId("agentTasks", directive.taskId);
                if (taskDocId) {
                  const task = await ctx.db.get(taskDocId);
                  if (task && task.orgId === orgId) {
                    const patch: Record<string, any> = {};
                    if (directive.title) patch.title = directive.title;
                    if (directive.description) patch.description = directive.description;
                    if (directive.priority) patch.priority = directive.priority;
                    if (directive.tags) patch.tags = directive.tags;
                    if (Object.keys(patch).length > 0) {
                      await ctx.db.patch(taskDocId, patch);
                    }
                  }
                }
              } else if (directive.action === "complete" && directive.taskId) {
                const taskDocId = ctx.db.normalizeId("agentTasks", directive.taskId);
                if (taskDocId) {
                  const task = await ctx.db.get(taskDocId);
                  if (task && task.orgId === orgId) {
                    await ctx.db.patch(taskDocId, {
                      status: "done",
                      completedAt: Date.now(),
                    });

                    await ctx.db.insert("agentActivity", {
                      orgId,
                      agentId: args.agentId as any,
                      action: "task_done",
                      target: task.title,
                      taskId: taskDocId,
                      timestamp: Date.now(),
                    });
                  }
                }
              }
            } catch (directiveError) {
              console.error("[webhook] Failed to process directive:", directiveError);
            }
          }
        }
      }

      // Update the original user message status to "responded"
      const originalMsgForStatus = await getOriginalMessage();
      if (originalMsgForStatus && originalMsgForStatus.status === "pending") {
        await ctx.db.patch(originalMsgForStatus._id, {
          status: "responded",
        });
      }

      // Mark queue item as completed
      const queueItem = await getQueueItem();
      if (queueItem && queueItem.status !== "completed") {
        await ctx.db.patch(queueItem._id, {
          status: "completed",
          processedAt: Date.now(),
        });
      }
    } else if (args.state === "error") {
      if (existing) {
        // Mark streaming message as error
        await ctx.db.patch(existing._id, {
          content: `Error: ${args.content}`,
          status: "delivered",
          metadata: { error: true },
          timestamp: Date.now(),
        });
      } else {
        const originalMsg = await getOriginalMessage();
        if (originalMsg) {
          await ctx.db.insert("agentChatMessages", {
            orgId: originalMsg.orgId,
            agentId: originalMsg.agentId,
            userId: originalMsg.userId,
            content: `Error: ${args.content}`,
            role: "system",
            sessionId: originalMsg.sessionId,
            status: "delivered",
            runId: args.runId,
            metadata: { error: true },
            timestamp: Date.now(),
          });
        }
      }

      // Mark queue item as failed
      const queueItem = await getQueueItem();
      if (queueItem && queueItem.status !== "failed") {
        await ctx.db.patch(queueItem._id, {
          status: "failed",
          error: args.content,
          processedAt: Date.now(),
        });
      }
    }
  },
});
