// convex/gatewayIntegration.ts
// Integration with OpenClaw Gateway for spawning agent sessions

import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { agentIdValidator } from "./schema";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// HTTP action to spawn agent session via OpenClaw Gateway
export const spawnAgentSession = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    task: v.string(),
    context: v.optional(v.any()),
    source: v.union(v.literal("discord"), v.literal("web")),
    channelId: v.optional(v.string()),
  },
  returns: v.object({
    sessionId: v.string(),
    status: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Generate session ID
    const sessionId = `${args.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create session record
    await ctx.db.insert("agentSessions", {
      orgId: args.orgId,
      agentId: args.agentId,
      sessionId,
      status: "working",
      currentTaskId: undefined,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      metadata: {
        task: args.task,
        context: args.context,
        source: args.source,
        channelId: args.channelId,
        userId,
      },
    });

    // Queue for processing
    await ctx.db.insert("agentProcessingQueue", {
      orgId: args.orgId,
      agentId: args.agentId,
      sessionId,
      task: args.task,
      context: args.context,
      source: args.source,
      channelId: args.channelId,
      status: "queued",
      queuedAt: Date.now(),
      attempts: 0,
    });

    // Log activity
    await ctx.db.insert("agentActivity", {
      orgId: args.orgId,
      agentId: args.agentId,
      action: "session_spawned",
      target: args.task,
      timestamp: Date.now(),
      metadata: { sessionId, source: args.source },
    });

    return { sessionId, status: "queued" };
  },
});

// Internal: Get queued items (helper mutation for processQueue action)
export const getQueuedItems = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    const items = await ctx.db
      .query("agentProcessingQueue")
      .withIndex("status", (q) => q.eq("status", "queued"))
      .take(limit);

    // Mark all as processing
    for (const item of items) {
      await ctx.db.patch(item._id, {
        status: "processing",
        startedAt: Date.now(),
      });
    }

    return items;
  },
});

// Internal: Mark queue item as completed
export const completeQueueItem = internalMutation({
  args: { itemId: v.id("agentProcessingQueue"), sessionId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      status: "completed",
      completedAt: Date.now(),
    });

    const session = await ctx.db
      .query("agentSessions")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (session) {
      await ctx.db.patch(session._id, {
        status: "idle",
        lastActivityAt: Date.now(),
      });
    }
  },
});

// Internal: Mark queue item as failed
export const failQueueItem = internalMutation({
  args: {
    itemId: v.id("agentProcessingQueue"),
    error: v.string(),
    attempts: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      status: "failed",
      error: args.error,
      attempts: args.attempts,
    });
  },
});

// Internal: Process queue via VPS Orchestrator (called by scheduled job or webhook)
export const processQueue = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const items: any[] = await ctx.runMutation(
      internal.gatewayIntegration.getQueuedItems,
      { limit: args.limit },
    );

    for (const item of items) {
      try {
        if (VPS_ORCHESTRATOR_URL && VPS_API_KEY) {
          // Send task to OpenClaw instance via VPS Orchestrator
          // Include messageId and orgId so orchestrator can route responses back
          const response = await fetch(
            `${VPS_ORCHESTRATOR_URL}/api/instances/${item.agentId}/message`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": VPS_API_KEY,
              },
              body: JSON.stringify({
                message: item.task,
                sessionId: item.sessionId,
                messageId: item.messageId ?? "",
                orgId: item.orgId ?? "",
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gateway error (${response.status}): ${errorText}`);
          }
        } else {
          console.log(
            "VPS Orchestrator not configured, skipping real dispatch for:",
            item.task,
          );
        }

        await ctx.runMutation(
          internal.gatewayIntegration.completeQueueItem,
          { itemId: item._id, sessionId: item.sessionId },
        );
      } catch (error) {
        await ctx.runMutation(
          internal.gatewayIntegration.failQueueItem,
          {
            itemId: item._id,
            error: String(error),
            attempts: item.attempts + 1,
          },
        );
      }
    }

    return items.length;
  },
});

// Webhook: Agent completed task
export const agentWebhook = mutation({
  args: {
    sessionId: v.string(),
    result: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Find session
    const session = await ctx.db
      .query("agentSessions")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) throw new Error("Session not found");

    // Update session
    await ctx.db.patch(session._id, {
      status: "idle",
      lastActivityAt: Date.now(),
    });

    // If this was a chat message, create response
    if (session.metadata?.chatMessageId) {
      await ctx.db.insert("agentChatMessages", {
        orgId: session.orgId,
        agentId: session.agentId,
        userId: session.metadata.userId,
        content: args.result,
        role: "agent",
        sessionId: args.sessionId,
        status: "delivered",
        timestamp: Date.now(),
      });
    }

    // If this created a task, update it
    if (session.metadata?.taskId) {
      await ctx.db.patch(session.metadata.taskId, {
        status: "done",
        completedAt: Date.now(),
      });
    }

    // Log completion
    await ctx.db.insert("agentActivity", {
      orgId: session.orgId,
      agentId: session.agentId,
      action: "session_completed",
      target: args.result.substring(0, 100),
      timestamp: Date.now(),
      metadata: { sessionId: args.sessionId },
    });

    return true;
  },
});

// Get active sessions
export const getActiveSessions = query({
  args: {
    orgId: v.id("organizations"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("status"), "working"))
      .collect();
  },
});

// Helper
async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}
