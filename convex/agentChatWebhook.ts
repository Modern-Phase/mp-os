// convex/agentChatWebhook.ts
// Handles webhook callbacks from VPS Orchestrator with agent response streaming

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ── Task Directive Parsing ──
// Agents can include <task_directives>[...]</task_directives> in their responses
// to create/update/complete tasks on the Kanban board.

interface TaskDirective {
  action: "create" | "update" | "complete" | "handoff";
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  agentId?: string;
  tags?: string[];
  taskId?: string; // For update/complete/handoff — Convex ID of existing task
  toAgentId?: string; // For handoff — target agent
  note?: string; // For handoff — optional note
  notes?: string; // For complete — summary of what was done
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

// ── Outbound Directive Parsing ──
// Agents can include <outbound_directives>[...]</outbound_directives> in responses
// to trigger Instantly API actions (add leads, check analytics, etc.)

interface OutboundDirective {
  action: "add_to_campaign" | "check_analytics" | "list_campaigns" | "check_lead_status";
  campaignId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customVariables?: Record<string, unknown>;
}

function parseOutboundDirectives(content: string): {
  directives: OutboundDirective[];
  cleanContent: string;
} {
  const regex = /<outbound_directives>([\s\S]*?)<\/outbound_directives>/g;
  const directives: OutboundDirective[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        if (d.action && typeof d.action === "string") {
          directives.push(d as OutboundDirective);
        }
      }
    } catch {
      console.warn("[webhook] Failed to parse outbound_directives JSON");
    }
    cleanContent = cleanContent.replace(match[0], "");
  }

  return { directives, cleanContent: cleanContent.trim() };
}

// ── Memory Directive Parsing ──
// Agents can include <memory_directives>[...]</memory_directives> in responses
// to store or forget persistent memories.

interface MemoryDirective {
  action: "store" | "forget";
  content?: string;
  category?: string;
  importance?: string;
  memoryId?: string;
}

function parseMemoryDirectives(content: string): {
  directives: MemoryDirective[];
  cleanContent: string;
} {
  const regex = /<memory_directives>([\s\S]*?)<\/memory_directives>/g;
  const directives: MemoryDirective[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        if (d.action && typeof d.action === "string") {
          directives.push(d as MemoryDirective);
        }
      }
    } catch {
      console.warn("[webhook] Failed to parse memory_directives JSON");
    }
    cleanContent = cleanContent.replace(match[0], "");
  }

  return { directives, cleanContent: cleanContent.trim() };
}

// ── Tool Call Report Directive Parsing ──
// Agents can include <tool_call_report>[...]</tool_call_report> in their responses
// to self-report tool calls made during execution.

interface ToolCallReport {
  tool: string;
  input: any;
  result?: any;
  error?: string;
  duration?: number;
}

function parseToolCallDirectives(content: string): {
  reports: ToolCallReport[];
  cleanContent: string;
} {
  const regex = /<tool_call_report>([\s\S]*?)<\/tool_call_report>/g;
  const reports: ToolCallReport[] = [];
  let cleanContent = content;

  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const d of arr) {
        if (d.tool && typeof d.tool === "string") {
          reports.push(d as ToolCallReport);
        }
      }
    } catch {
      console.warn("[webhook] Failed to parse tool_call_report JSON");
    }
    cleanContent = cleanContent.replace(match[0], "");
  }

  return { reports, cleanContent: cleanContent.trim() };
}

/**
 * Receive a tool call event from the VPS Orchestrator gateway.
 * Called by the HTTP handler in http.ts.
 */
export const receiveToolCall = internalMutation({
  args: {
    agentId: v.string(),
    orgId: v.string(),
    messageId: v.string(),
    runId: v.string(),
    toolName: v.string(),
    toolInput: v.string(),
    toolResult: v.optional(v.string()),
    state: v.union(v.literal("started"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.db.normalizeId("organizations", args.orgId);
    if (!orgId) return;

    // Resolve messageId to link tool call to the agent message
    let messageId: Id<"agentChatMessages"> | undefined;
    if (args.messageId) {
      // Find the agent response message by runId (not the original user msg)
      const agentMsg = await ctx.db
        .query("agentChatMessages")
        .withIndex("runId", (q) => q.eq("runId", args.runId))
        .first();
      if (agentMsg) messageId = agentMsg._id;
    }

    if (args.state === "started") {
      await ctx.db.insert("agentToolCalls", {
        orgId,
        agentId: args.agentId,
        runId: args.runId,
        messageId,
        toolName: args.toolName,
        toolInput: args.toolInput,
        status: "pending",
        startedAt: Date.now(),
      });
    } else {
      // Find existing pending tool call for this run + tool name
      const existing = await ctx.db
        .query("agentToolCalls")
        .withIndex("runId", (q) => q.eq("runId", args.runId))
        .filter((q) =>
          q.and(
            q.eq(q.field("toolName"), args.toolName),
            q.eq(q.field("status"), "pending"),
          ),
        )
        .first();

      if (existing) {
        const duration = Date.now() - existing.startedAt;
        await ctx.db.patch(existing._id, {
          toolResult: args.toolResult,
          status: "success",
          completedAt: Date.now(),
          duration,
          messageId: messageId || existing.messageId,
        });
      } else {
        // No started event — insert completed directly
        await ctx.db.insert("agentToolCalls", {
          orgId,
          agentId: args.agentId,
          runId: args.runId,
          messageId,
          toolName: args.toolName,
          toolInput: args.toolInput,
          toolResult: args.toolResult,
          status: "success",
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 0,
        });
      }
    }
  },
});

/**
 * Query tool calls for a specific message
 */
export const getToolCallsForMessage = internalQuery({
  args: { messageId: v.id("agentChatMessages") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentToolCalls")
      .withIndex("messageId", (q) => q.eq("messageId", args.messageId))
      .collect();
  },
});

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
        // Guard: skip if message was already finalized (prevents race with final event)
        if (existing.status === "delivered") {
          return;
        }
        // Replace with latest cumulative snapshot (gateway sends full text so far)
        await ctx.db.patch(existing._id, {
          content: args.content,
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
      const { directives, cleanContent: taskCleanContent } = parseTaskDirectives(finalContent);

      // Parse outbound directives from the task-cleaned content
      const { directives: outboundDirectives, cleanContent: outboundCleanContent } =
        parseOutboundDirectives(taskCleanContent);

      // Parse memory directives from the outbound-cleaned content
      const { directives: memoryDirectives, cleanContent: memoryCleanContent } =
        parseMemoryDirectives(outboundCleanContent);

      // Parse tool call report directives (self-reported by agents as fallback)
      const { reports: toolCallReports, cleanContent: toolCleanContent } =
        parseToolCallDirectives(memoryCleanContent);
      const displayContent = toolCleanContent || memoryCleanContent || outboundCleanContent || taskCleanContent || finalContent;

      let agentMessageId: Id<"agentChatMessages"> | undefined;

      if (existing) {
        // Finalize the streaming message with clean content
        await ctx.db.patch(existing._id, {
          content: displayContent,
          status: "delivered",
          ...(directives.length > 0 && { processedTaskDirectives: directives.length }),
          ...(outboundDirectives.length > 0 && { processedOutboundDirectives: outboundDirectives.length }),
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
            ...(outboundDirectives.length > 0 && { processedOutboundDirectives: outboundDirectives.length }),
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
                      ...(directive.notes && { completionNotes: directive.notes }),
                    });

                    await ctx.db.insert("agentActivity", {
                      orgId,
                      agentId: args.agentId as any,
                      action: "task_done",
                      target: task.title,
                      taskId: taskDocId,
                      timestamp: Date.now(),
                      ...(directive.notes && { metadata: { completionNotes: directive.notes } }),
                    });
                  }
                }
              } else if (directive.action === "handoff" && directive.taskId && directive.toAgentId) {
                const taskDocId = ctx.db.normalizeId("agentTasks", directive.taskId);
                if (taskDocId) {
                  const task = await ctx.db.get(taskDocId);
                  if (task && task.orgId === orgId) {
                    await ctx.db.patch(taskDocId, {
                      handoffFrom: task.agentId,
                      handoffTo: directive.toAgentId as any,
                      handoffNote: directive.note,
                      status: "todo",
                    });

                    await ctx.db.insert("agentActivity", {
                      orgId,
                      agentId: args.agentId as any,
                      action: "task_handoff_sent",
                      target: `${task.title} → ${directive.toAgentId}`,
                      taskId: taskDocId,
                      timestamp: Date.now(),
                    });

                    // Notify task assignee
                    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
                      userId: task.assignedTo,
                      orgId,
                      type: "task_handoff",
                      title: "Task handoff",
                      body: `${args.agentId} handed off "${task.title}" to ${directive.toAgentId}${directive.note ? `: ${directive.note}` : ""}`,
                      resourceType: "task",
                      resourceId: String(taskDocId),
                      agentId: directive.toAgentId as any,
                    });

                    console.log(`[webhook] Agent ${args.agentId} handed off task to ${directive.toAgentId}`);
                  }
                }
              }
            } catch (directiveError) {
              console.error("[webhook] Failed to process directive:", directiveError);
            }
          }
        }
      }

      // ── Process Memory Directives ──
      if (memoryDirectives.length > 0 && agentMessageId) {
        const memOriginalMsg = await getOriginalMessage();
        if (memOriginalMsg) {
          // Schedule as action (needs embedding generation, can't run in mutation)
          await ctx.scheduler.runAfter(0, internal.agentMemory.processMemoryDirectives, {
            directives: memoryDirectives,
            orgId: String(memOriginalMsg.orgId),
            agentId: args.agentId,
            sourceMessageId: String(agentMessageId),
          });
          console.log(`[webhook] Scheduled ${memoryDirectives.length} memory directive(s) for ${args.agentId}`);
        }
      }

      // ── Process Tool Call Reports (self-reported by agent) ──
      if (toolCallReports.length > 0 && agentMessageId) {
        const tcOriginalMsg = await getOriginalMessage();
        const tcOrgId = tcOriginalMsg ? tcOriginalMsg.orgId : ctx.db.normalizeId("organizations", args.orgId);
        if (tcOrgId) {
          for (const report of toolCallReports) {
            try {
              await ctx.db.insert("agentToolCalls", {
                orgId: tcOrgId,
                agentId: args.agentId,
                runId: args.runId,
                messageId: agentMessageId,
                toolName: report.tool,
                toolInput: JSON.stringify(report.input || {}),
                toolResult: report.result ? JSON.stringify(report.result) : undefined,
                status: report.error ? "error" : "success",
                startedAt: Date.now() - (report.duration || 0),
                completedAt: Date.now(),
                duration: report.duration,
              });
            } catch (err) {
              console.error("[webhook] Failed to insert tool call report:", err);
            }
          }
          console.log(`[webhook] Stored ${toolCallReports.length} tool call report(s) for ${args.agentId}`);
        }
      }

      // ── Process Outbound Directives ──
      if (outboundDirectives.length > 0) {
        for (const directive of outboundDirectives) {
          try {
            if (directive.action === "add_to_campaign" && directive.campaignId && directive.email) {
              await ctx.scheduler.runAfter(0, internal.instantly.INTERNAL_addLeadToCampaign, {
                campaignId: directive.campaignId,
                email: directive.email,
                firstName: directive.firstName,
                lastName: directive.lastName,
                company: directive.company,
                customVariables: directive.customVariables,
              });
              console.log(`[webhook] Scheduled add_to_campaign: ${directive.email} → ${directive.campaignId}`);
            } else if (directive.action === "check_analytics" && directive.campaignId) {
              await ctx.scheduler.runAfter(0, internal.instantly.INTERNAL_getCampaignAnalytics, {
                campaignId: directive.campaignId,
              });
              console.log(`[webhook] Scheduled check_analytics for campaign ${directive.campaignId}`);
            } else if (directive.action === "list_campaigns") {
              await ctx.scheduler.runAfter(0, internal.instantly.INTERNAL_listCampaigns, {});
              console.log("[webhook] Scheduled list_campaigns");
            } else if (directive.action === "check_lead_status" && directive.email) {
              await ctx.scheduler.runAfter(0, internal.instantly.INTERNAL_getLeadStatus, {
                email: directive.email,
                campaignId: directive.campaignId,
              });
              console.log(`[webhook] Scheduled check_lead_status for ${directive.email}`);
            }
          } catch (outboundError) {
            console.error("[webhook] Failed to process outbound directive:", outboundError);
          }
        }
      }

      // Notify user that agent responded
      const notifyOriginalMsg = await getOriginalMessage();
      if (notifyOriginalMsg) {
        await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
          userId: notifyOriginalMsg.userId,
          orgId: notifyOriginalMsg.orgId,
          type: "agent_message",
          title: "Agent response",
          body: displayContent.slice(0, 120) + (displayContent.length > 120 ? "..." : ""),
          resourceType: "message",
          resourceId: agentMessageId ? String(agentMessageId) : undefined,
          agentId: args.agentId as any,
        });

        // If this message originated from Discord, send the reply back
        if (notifyOriginalMsg.metadata?.source === "discord") {
          await ctx.scheduler.runAfter(0, internal.discord.INTERNAL_sendDiscordReply, {
            channelId: notifyOriginalMsg.metadata.discordChannelId,
            discordMessageId: notifyOriginalMsg.metadata.discordMessageId,
            agentId: args.agentId,
            content: displayContent,
          });
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

      // Schedule workspace scan to catch task files the agent may have written
      // Small delay to let the agent finish any file writes
      const scanOriginalMsg = await getOriginalMessage();
      if (scanOriginalMsg) {
        await ctx.scheduler.runAfter(3000, internal.agentChat.scanAgentWorkspaceForTasks, {
          agentId: args.agentId,
          orgId: String(scanOriginalMsg.orgId),
          userId: String(scanOriginalMsg.userId),
          messageId: args.messageId,
        });

        // Schedule full data sync (files + transcripts) after agent finishes
        await ctx.scheduler.runAfter(5000, internal.agentSync.INTERNAL_syncAgentData, {
          agentId: args.agentId,
          orgId: String(scanOriginalMsg.orgId),
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
