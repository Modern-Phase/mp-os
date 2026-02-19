// convex/agentChatWebhook.ts
// Handles webhook callbacks from VPS Orchestrator with agent response streaming

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
      if (existing) {
        // Finalize the streaming message with full content
        await ctx.db.patch(existing._id, {
          content: args.content || existing.content,
          status: "delivered",
          timestamp: Date.now(),
        });
      } else {
        // No streaming message existed (maybe deltas were skipped) — create final
        const originalMsg = await getOriginalMessage();
        if (originalMsg) {
          await ctx.db.insert("agentChatMessages", {
            orgId: originalMsg.orgId,
            agentId: originalMsg.agentId,
            userId: originalMsg.userId,
            content: args.content,
            role: "agent",
            sessionId: originalMsg.sessionId,
            status: "delivered",
            runId: args.runId,
            replyTo: originalMsg._id,
            timestamp: Date.now(),
          });
        }
      }

      // Update the original user message status to "responded"
      const originalMsg = await getOriginalMessage();
      if (originalMsg && originalMsg.status === "pending") {
        await ctx.db.patch(originalMsg._id, {
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
