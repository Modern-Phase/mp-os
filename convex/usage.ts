import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { PLANS } from "./schema";
import type { PlanKey } from "./schema";

// Plan limits: chat messages and documents per billing period, storage in bytes
export const PLAN_LIMITS: Record<
  PlanKey,
  { chatMessages: number; documents: number; storageBytes: number }
> = {
  [PLANS.FREE]: {
    chatMessages: 1000,
    documents: 500, // Increased for development
    storageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
  },
  [PLANS.PRO]: {
    chatMessages: 5000,
    documents: 500,
    storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
  },
};

export function getEndOfCurrentMonthSeconds(): number {
  const d = new Date();
  return Math.floor(
    new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000,
  );
}

/** Get period end for usage (subscription period or end of current month) */
export async function getPeriodEndForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .unique();
  if (subscription) {
    return subscription.currentPeriodEnd;
  }
  return getEndOfCurrentMonthSeconds();
}

/** Get or create usage row for the current billing period */
async function getOrCreateUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Id<"usage">> {
  const periodEnd = await getPeriodEndForUser(ctx, userId);
  const existing = await ctx.db
    .query("usage")
    .withIndex("userId_periodEnd", (q) =>
      q.eq("userId", userId).eq("periodEnd", periodEnd),
    )
    .unique();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("usage", {
    userId,
    periodEnd,
    chatMessages: 0,
    documentsCreated: 0,
    storageBytes: 0,
  });
}

/** Increment chat message count for the current period (call when a user message is saved) */
export const recordChatMessage = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const usageId = await getOrCreateUsage(ctx, args.userId);
    const row = await ctx.db.get(usageId);
    if (row) {
      await ctx.db.patch(usageId, {
        chatMessages: row.chatMessages + 1,
      });
    }
  },
});

/** Increment document count and storage for the current period */
export const recordDocumentCreated = internalMutation({
  args: {
    userId: v.id("users"),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const usageId = await getOrCreateUsage(ctx, args.userId);
    const row = await ctx.db.get(usageId);
    if (row) {
      await ctx.db.patch(usageId, {
        documentsCreated: row.documentsCreated + 1,
        storageBytes: row.storageBytes + args.fileSize,
      });
    }
  },
});

/** Get usage for the current period (for display and checks) */
export const getUsageForCurrentPeriod = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const periodEnd = await getPeriodEndForUser(ctx, user._id);
    const usage = await ctx.db
      .query("usage")
      .withIndex("userId_periodEnd", (q) =>
        q.eq("userId", user._id).eq("periodEnd", periodEnd),
      )
      .unique();

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .unique();
    const plan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : null;
    const planKey = (plan?.key ?? PLANS.FREE) as PlanKey;
    const limits = PLAN_LIMITS[planKey];

    return {
      usage: usage
        ? {
            chatMessages: usage.chatMessages,
            documentsCreated: usage.documentsCreated,
            storageBytes: usage.storageBytes,
          }
        : {
            chatMessages: 0,
            documentsCreated: 0,
            storageBytes: 0,
          },
      limits: {
        chatMessages: limits.chatMessages,
        documents: limits.documents,
        storageBytes: limits.storageBytes,
      },
      planKey,
      periodEnd,
    };
  },
});

/** Internal: get usage + limits for a user (for HTTP/action checks) */
export const getUsageAndLimits = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const periodEnd = await getPeriodEndForUser(ctx, args.userId);
    const usage = await ctx.db
      .query("usage")
      .withIndex("userId_periodEnd", (q) =>
        q.eq("userId", args.userId).eq("periodEnd", periodEnd),
      )
      .unique();

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    const plan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : null;
    const planKey = (plan?.key ?? PLANS.FREE) as PlanKey;
    const limits = PLAN_LIMITS[planKey];

    return {
      chatMessages: usage?.chatMessages ?? 0,
      documentsCreated: usage?.documentsCreated ?? 0,
      storageBytes: usage?.storageBytes ?? 0,
      limits,
      planKey,
    };
  },
});

/** Check if user can send another chat message (for HTTP/actions: use getUsageAndLimits and compare) */
export function canSendChatMessage(
  usage: { chatMessages: number; limits: { chatMessages: number } },
): boolean {
  return usage.chatMessages < usage.limits.chatMessages;
}

/** Check if user can create another document (count + storage) */
export function canCreateDocument(
  usage: {
    documentsCreated: number;
    storageBytes: number;
    limits: { documents: number; storageBytes: number };
  },
  additionalBytes: number,
): boolean {
  return (
    usage.documentsCreated < usage.limits.documents &&
    usage.storageBytes + additionalBytes <= usage.limits.storageBytes
  );
}
