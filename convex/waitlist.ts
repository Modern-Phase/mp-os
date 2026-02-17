import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      return { success: true, message: "Already on the list!" };
    }

    await ctx.db.insert("waitlist", {
      email: args.email,
      name: args.name,
      timestamp: Date.now(),
    });

    return { success: true, message: "Welcome to the waitlist!" };
  },
});
