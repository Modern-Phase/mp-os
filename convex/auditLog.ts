import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// GDPR audit actions
export const AUDIT_ACTIONS = {
  DATA_EXPORT: "data_export",
  DATA_DELETION: "data_deletion",
  DATA_ACCESS: "data_access",
  CONSENT_UPDATE: "consent_update",
  ACCOUNT_CREATED: "account_created",
  ACCOUNT_DELETED: "account_deleted",
} as const;

// Helper function to log audit events
export async function logAuditEvent(
  ctx: MutationCtx,
  args: {
    userId?: Id<"users">;
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
    details?: string;
    ipAddress: string;
    userAgent: string;
    requestId?: string;
  },
) {
  await ctx.db.insert("auditLogs", {
    userId: args.userId,
    action: args.action,
    details: args.details,
    ipAddress: args.ipAddress,
    userAgent: args.userAgent,
    timestamp: Date.now(),
    requestId: args.requestId,
  });
}

// Mutation to manually log audit events (for testing)
export const logAudit = mutation({
  args: {
    action: v.union(
      v.literal("data_export"),
      v.literal("data_deletion"),
      v.literal("data_access"),
      v.literal("consent_update"),
      v.literal("account_created"),
      v.literal("account_deleted"),
    ),
    details: v.optional(v.string()),
    ipAddress: v.string(),
    userAgent: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the user ID from the identity
    const user = await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await logAuditEvent(ctx, {
      userId: user._id,
      action: args.action,
      details: args.details,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      requestId: args.requestId,
    });

    return { success: true };
  },
});
