// convex/agentChat.ts — Agent chat system for in-app messaging

import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { agentIdValidator } from "./schema";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// Chat message schema
export const createChatMessage = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    sessionId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.id("agentChatMessages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const messageId = await ctx.db.insert("agentChatMessages", {
      orgId: args.orgId,
      agentId: args.agentId,
      userId,
      content: args.content,
      role: args.role,
      sessionId: args.sessionId,
      status: args.role === "user" ? "pending" : "delivered",
      metadata: args.metadata,
      timestamp: Date.now(),
    });

    // If user message, queue for agent processing and dispatch immediately
    if (args.role === "user") {
      const queueId = await ctx.db.insert("agentChatQueue", {
        orgId: args.orgId,
        messageId,
        agentId: args.agentId,
        userId,
        status: "queued",
        attempts: 0,
        queuedAt: Date.now(),
      });

      // Schedule immediate dispatch to VPS Orchestrator
      await ctx.scheduler.runAfter(0, internal.agentChat.dispatchChatMessage, {
        queueId,
        messageId: messageId as string,
        agentId: args.agentId,
        orgId: args.orgId as string,
        content: args.content,
        sessionId: args.sessionId,
      });
    }

    return messageId;
  },
});

// Get chat history for an agent
export const getAgentChatHistory = query({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentChatMessages")
      .withIndex("orgId_agentId", (q) => 
        q.eq("orgId", args.orgId).eq("agentId", args.agentId)
      )
      .order("desc")
      .take(args.limit || 50);
    
    return messages.reverse();
  },
});

// Get pending messages (for agent processing)
export const getPendingMessages = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(agentIdValidator),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("agentChatQueue")
      .withIndex("orgId_status", (q) => 
        q.eq("orgId", args.orgId).eq("status", "queued")
      );
    
    if (args.agentId) {
      // Filter by agent
      const all = await q.collect();
      return all.filter(item => item.agentId === args.agentId);
    }
    
    return await q.take(10);
  },
});

// Mark message as processed (agent responded)
export const markMessageProcessed = mutation({
  args: {
    queueId: v.id("agentChatQueue"),
    response: v.string(),
    sessionId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const queueItem = await ctx.db.get(args.queueId);
    if (!queueItem) throw new Error("Queue item not found");

    // Update queue status
    await ctx.db.patch(args.queueId, {
      status: "completed",
      processedAt: Date.now(),
    });

    // Create agent response message
    await ctx.db.insert("agentChatMessages", {
      orgId: queueItem.orgId,
      agentId: queueItem.agentId,
      userId: queueItem.userId,
      content: args.response,
      role: "agent",
      sessionId: args.sessionId,
      status: "delivered",
      replyTo: queueItem.messageId,
      timestamp: Date.now(),
    });

    // Update original message status
    await ctx.db.patch(queueItem.messageId, {
      status: "responded",
    });

    return true;
  },
});

// Get or create chat session
export const getOrCreateSession = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Look for existing active session
    const existing = await ctx.db
      .query("agentChatSessions")
      .withIndex("orgId_agentId_userId", (q) => 
        q.eq("orgId", args.orgId)
          .eq("agentId", args.agentId)
          .eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (existing) return existing.sessionId;

    // Create new session
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await ctx.db.insert("agentChatSessions", {
      orgId: args.orgId,
      agentId: args.agentId,
      userId,
      sessionId,
      status: "active",
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return sessionId;
  },
});

// Internal: Dispatch a chat message to the VPS Orchestrator → Gateway WS bridge
export const dispatchChatMessage = internalAction({
  args: {
    queueId: v.id("agentChatQueue"),
    messageId: v.string(),
    agentId: v.string(),
    orgId: v.string(),
    content: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
      console.log("[agentChat] VPS Orchestrator not configured, skipping dispatch");
      return;
    }

    try {
      // Mark queue item as processing
      await ctx.runMutation(internal.agentChat.updateQueueStatus, {
        queueId: args.queueId,
        status: "processing",
      });

      const sessionKey = args.sessionId || `agent:main:${args.agentId}`;

      const response = await fetch(
        `${VPS_ORCHESTRATOR_URL}/api/instances/${args.agentId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": VPS_API_KEY,
          },
          body: JSON.stringify({
            message: args.content,
            sessionId: sessionKey,
            messageId: args.messageId,
            orgId: args.orgId,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Orchestrator error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log(`[agentChat] Dispatched to orchestrator: runId=${result.runId}`);
    } catch (error) {
      console.error("[agentChat] Failed to dispatch:", error);
      await ctx.runMutation(internal.agentChat.updateQueueStatus, {
        queueId: args.queueId,
        status: "failed",
        error: String(error),
      });
    }
  },
});

// Internal: Update chat queue item status
export const updateQueueStatus = internalMutation({
  args: {
    queueId: v.id("agentChatQueue"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: args.status,
      ...(args.error && { error: args.error }),
      ...(args.status === "completed" || args.status === "failed"
        ? { processedAt: Date.now() }
        : {}),
    });
  },
});

// Helper to get auth user
async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}
