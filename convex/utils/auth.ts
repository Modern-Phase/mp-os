import { QueryCtx, MutationCtx } from "@cvx/_generated/server";
import { Id } from "@cvx/_generated/dataModel";

export type Role = "admin" | "member" | "viewer";

export async function getAuthUserId(
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

export async function checkOrgPermission(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organizations">,
  requiredRole: Role = "member",
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const membership = await ctx.db
    .query("memberships")
    .withIndex("orgId_userId", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();

  if (!membership) throw new Error("Not a member of this organization");

  const roles: Role[] = ["viewer", "member", "admin"];
  const userRoleIndex = roles.indexOf(membership.role as Role);
  const requiredRoleIndex = roles.indexOf(requiredRole);

  if (userRoleIndex < requiredRoleIndex) {
    throw new Error(`Insufficient permissions. Required: ${requiredRole}`);
  }

  return { userId, role: membership.role as Role };
}

export async function isSystemAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return !!user?.isAdmin;
}
