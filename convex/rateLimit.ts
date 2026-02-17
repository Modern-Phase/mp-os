import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const WINDOW_MS_CHAT = 60 * 1000; // 1 minute
const MAX_CHAT_PER_MINUTE = 30;

const WINDOW_MS_UPLOAD = 60 * 1000; // 1 minute
const MAX_UPLOADS_PER_MINUTE = 10;

/** Shared logic: check and increment rate limit. Use from mutations or call via internal mutation from actions. */
export async function checkAndIncrementRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("key", (q) => q.eq("key", key))
    .unique();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key,
      windowStart: now,
      count: 1,
    });
    return { allowed: true };
  }

  if (now - existing.windowStart > windowMs) {
    await ctx.db.patch(existing._id, {
      windowStart: now,
      count: 1,
    });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    return { allowed: false };
  }

  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
  });
  return { allowed: true };
}

/** Check and increment rate limit (for HTTP actions via runMutation). */
export const checkAndIncrement = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    return checkAndIncrementRateLimit(
      ctx,
      args.key,
      args.limit,
      args.windowMs,
    );
  },
});

/** Rate limit configs for callers */
export const RATE_LIMITS = {
  chat: { windowMs: WINDOW_MS_CHAT, limit: MAX_CHAT_PER_MINUTE },
  upload: { windowMs: WINDOW_MS_UPLOAD, limit: MAX_UPLOADS_PER_MINUTE },
} as const;
