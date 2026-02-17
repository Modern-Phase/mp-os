import { query, mutation } from "@cvx/_generated/server";
import { v } from "convex/values";
import { isSystemAdmin } from "./utils/auth";

async function checkAdmin(ctx: any) {
  const admin = await isSystemAdmin(ctx);
  if (!admin) throw new Error("Admin access required");
}

export const getUsers = query({
  args: { paginationOpts: v.any() },
  handler: async (ctx, args) => {
    await checkAdmin(ctx);
    return await ctx.db.query("users").paginate(args.paginationOpts);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const admin = await isSystemAdmin(ctx);
    if (!admin) return null;

    const users = await ctx.db.query("users").collect();
    const subs = await ctx.db.query("subscriptions").collect();

    return {
      totalUsers: users.length,
      totalSubscriptions: subs.length,
      activeSubscriptions: subs.filter((s) => s.status === "active").length,
    };
  },
});

export const toggleAdmin = mutation({
  args: { userId: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    await checkAdmin(ctx);
    await ctx.db.patch(args.userId, { isAdmin: args.isAdmin });
  },
});
