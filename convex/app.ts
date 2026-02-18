import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { currencyValidator, PLANS } from "./schema";
import { asyncMap } from "convex-helpers";
import { v } from "convex/values";
import { User } from "../types";
import { Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

const usernameValidator = v.string();

const validateUsername = (username: string): void => {
  if (username.length < 3 || username.length > 20) {
    throw new Error("Username must be between 3 and 20 characters");
  }
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    throw new Error("Username may only contain alphanumeric characters");
  }
};

async function getAuthUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Check if user already exists by clerkId.
    const existing = await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (existing) return existing._id;

    // Check if user exists by email (legacy user without clerkId).
    if (identity.email) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", identity.email))
        .unique();
      if (byEmail) {
        await ctx.db.patch(byEmail._id, { clerkId: identity.subject });
        return byEmail._id;
      }
    }

    // Create new user.
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      name: identity.name,
      image: identity.pictureUrl,
    });

    // Create default collection for the new user
    await ctx.scheduler.runAfter(
      0,
      internal.collections.createDefaultCollection,
      { userId },
    );

    return userId;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<User | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const [user, subscription] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("subscriptions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .unique(),
    ]);
    if (!user) {
      return null;
    }

    // Batch the plan query with other operations if needed
    const plan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : undefined;
    // Get memberships
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    const avatarUrl = user.imageId
      ? await ctx.storage.getUrl(user.imageId)
      : user.image;

    return {
      ...user,
      avatarUrl: avatarUrl || undefined,
      memberships,
      subscription:
        subscription && plan
          ? {
              ...subscription,
              planKey: plan.key,
            }
          : undefined,
    };
  },
});

export const updateUsername = mutation({
  args: {
    username: usernameValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to update username");
    }

    validateUsername(args.username);

    await ctx.db.patch(userId, { username: args.username });
  },
});

export const completeOnboarding = mutation({
  args: {
    username: usernameValidator,
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to complete onboarding");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    validateUsername(args.username);

    await ctx.db.patch(userId, { username: args.username });
    if (user.customerId) {
      return;
    }
    await ctx.scheduler.runAfter(
      0,
      internal.stripe.PREAUTH_createStripeCustomer,
      {
        currency: args.currency,
        userId,
      },
    );
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateUserImage = mutation({
  args: {
    imageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to update image");
    }
    ctx.db.patch(userId, { imageId: args.imageId });
  },
});

export const removeUserImage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to remove image");
    }
    ctx.db.patch(userId, { imageId: undefined, image: undefined });
  },
});

export const getActivePlans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to get active plans");
    }
    const [free, pro] = await asyncMap(
      [PLANS.FREE, PLANS.PRO] as const,
      (key) =>
        ctx.db
          .query("plans")
          .withIndex("key", (q) => q.eq("key", key))
          .unique(),
    );
    if (!free || !pro) {
      throw new Error("Plan not found");
    }
    return { free, pro };
  },
});

export const deleteCurrentUserAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to delete account");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .unique();
    if (!subscription) {
      console.error("No subscription found for user deletion");
    } else {
      await ctx.db.delete(subscription._id);
      await ctx.scheduler.runAfter(
        0,
        internal.stripe.cancelCurrentUserSubscriptions,
      );
    }
    await ctx.db.delete(userId);
  },
});
