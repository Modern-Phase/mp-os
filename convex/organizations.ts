import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId, checkOrgPermission } from "./utils/auth";

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check if slug is taken
    const existing = await ctx.db
      .query("organizations")
      .withIndex("slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("Slug already taken");

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      ownerId: userId,
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId,
      role: "admin",
    });

    return orgId;
  },
});

export const ensurePersonalOrg = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check if user already has any membership
    const existing = await ctx.db
      .query("memberships")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing.orgId;

    // Create a personal org
    const user = await ctx.db.get(userId);
    const slug = `personal-${userId}`;
    const orgId = await ctx.db.insert("organizations", {
      name: user?.username ? `${user.username}'s Org` : "Personal",
      slug,
      ownerId: userId,
    });

    await ctx.db.insert("memberships", {
      orgId,
      userId,
      role: "admin",
    });

    return orgId;
  },
});

export const getMyOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    const orgs = await Promise.all(memberships.map((m) => ctx.db.get(m.orgId)));

    return orgs.filter((o): o is NonNullable<typeof o> => !!o);
  },
});

export const getMembers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await checkOrgPermission(ctx, args.orgId, "member");

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...user,
          role: m.role,
        };
      }),
    );

    return members;
  },
});

export const inviteMember = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    await checkOrgPermission(ctx, args.orgId, "admin");

    const targetUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();

    if (!targetUser)
      throw new Error("User not found. They must sign up first.");

    // Check if already a member
    const existing = await ctx.db
      .query("memberships")
      .withIndex("orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", targetUser._id),
      )
      .unique();

    if (existing) throw new Error("User is already a member");

    await ctx.db.insert("memberships", {
      orgId: args.orgId,
      userId: targetUser._id,
      role: args.role,
    });
  },
});
