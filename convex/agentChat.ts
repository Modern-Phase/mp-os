// convex/agentChat.ts — Agent chat system for in-app messaging

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { agentIdValidator } from "./schema";

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

    // If user message, trigger agent response
    if (args.role === "user") {
      // Spawn agent session via HTTP call to OpenClaw Gateway
      // This would be handled by a separate service or webhook
      await ctx.db.insert("agentChatQueue", {
        orgId: args.orgId,
        messageId,
        agentId: args.agentId,
        userId,
        status: "queued",
        attempts: 0,
        queuedAt: Date.now(),
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
