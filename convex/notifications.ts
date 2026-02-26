// convex/notifications.ts — Notification system queries, mutations, and internal helpers

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { notificationTypeValidator, agentIdValidator } from "./schema";

// ========== AUTH HELPER ==========

async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

// ========== QUERIES ==========

export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("userId_read", (q: any) => q.eq("userId", userId).eq("read", false))
      .collect();

    return unread.length;
  },
});

export const getNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("userId_createdAt", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// ========== MUTATIONS ==========

export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(args.notificationId, { read: true });
    return true;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("userId_read", (q: any) => q.eq("userId", userId).eq("read", false))
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }

    return unread.length;
  },
});

// ========== INTERNAL ==========

export const INTERNAL_createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    resourceType: v.optional(v.union(v.literal("task"), v.literal("lead"), v.literal("message"), v.literal("invoice"), v.literal("proposal"), v.literal("contract"))),
    resourceId: v.optional(v.string()),
    agentId: v.optional(agentIdValidator),
  },
  handler: async (ctx, args) => {
    // Dedup: skip if identical notification (same type + resourceId) in last 30s
    if (args.resourceId) {
      const recent = await ctx.db
        .query("notifications")
        .withIndex("userId_createdAt", (q: any) => q.eq("userId", args.userId))
        .order("desc")
        .take(5);

      const isDuplicate = recent.some(
        (n) =>
          n.type === args.type &&
          n.resourceId === args.resourceId &&
          n.createdAt > Date.now() - 30_000,
      );
      if (isDuplicate) return;
    }

    await ctx.db.insert("notifications", {
      userId: args.userId,
      orgId: args.orgId,
      type: args.type,
      title: args.title,
      body: args.body,
      read: false,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      agentId: args.agentId,
      createdAt: Date.now(),
    });
  },
});
