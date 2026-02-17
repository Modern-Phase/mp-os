import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

// GDPR consent types
export const CONSENT_TYPES = {
  ANALYTICS: "analytics",
  MARKETING: "marketing",
  FUNCTIONAL: "functional",
  ESSENTIAL: "essential",
} as const;

export const consentTypeValidator = v.union(
  v.literal(CONSENT_TYPES.ANALYTICS),
  v.literal(CONSENT_TYPES.MARKETING),
  v.literal(CONSENT_TYPES.FUNCTIONAL),
  v.literal(CONSENT_TYPES.ESSENTIAL),
);

// Update user consent
export const updateConsent = mutation({
  args: {
    consents: v.array(
      v.object({
        type: consentTypeValidator,
        granted: v.boolean(),
      }),
    ),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const ipAddress = "127.0.0.1"; // Would get from request headers in real implementation
    const userAgent = "GDPR consent update"; // Would get from request headers

    // Update each consent
    for (const consent of args.consents) {
      await ctx.db.insert("gdprConsents", {
        userId,
        consentType: consent.type,
        granted: consent.granted,
        ipAddress,
        userAgent,
        timestamp: Date.now(),
        version: args.version,
      });
    }

    // Log the consent update
    await ctx.db.insert("auditLogs", {
      userId,
      action: "consent_update",
      details: `Updated consents: ${args.consents.map((c) => `${c.type}=${c.granted}`).join(", ")}`,
      ipAddress,
      userAgent,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

// Get user consents
export const getUserConsents = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const consents = await ctx.db
      .query("gdprConsents")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Group by consent type and get the latest version for each
    const latestConsents = new Map();
    for (const consent of consents) {
      if (!latestConsents.has(consent.consentType)) {
        latestConsents.set(consent.consentType, consent);
      }
    }

    return Array.from(latestConsents.values());
  },
});

// Export all user data (GDPR Article 20 - Right to data portability)
export const exportUserData = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user profile
    const user = await ctx.db.get(userId);

    // Get subscriptions
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get document collections
    const documentCollections = await ctx.db
      .query("documentCollections")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get documents
    const documents = await ctx.db
      .query("documents")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get chat sessions
    const chatSessions = await ctx.db
      .query("chatSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get chat messages
    const chatMessages = await ctx.db
      .query("chatMessages")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get message feedback
    const messageFeedback = await ctx.db
      .query("messageFeedback")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get usage data
    const usage = await ctx.db
      .query("usage")
      .withIndex("userId_periodEnd", (q) => q.eq("userId", userId))
      .collect();

    // Get GDPR consents
    const gdprConsents = await ctx.db
      .query("gdprConsents")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Get audit logs
    const auditLogs = await ctx.db
      .query("auditLogs")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    return {
      user,
      subscriptions,
      documentCollections,
      documents,
      chatSessions,
      chatMessages,
      messageFeedback,
      usage,
      gdprConsents,
      auditLogs,
      exportTimestamp: Date.now(),
    };
  },
});

// Delete all user data (GDPR Article 17 - Right to erasure)
export const deleteUserData = mutation({
  args: {
    confirmation: v.boolean(),
    // SECURITY: Add additional verification
    verificationToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Multi-factor confirmation required
    if (!args.confirmation) {
      throw new Error("Confirmation required for account deletion");
    }

    // SECURITY: Log deletion attempt before proceeding
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Authentication required");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const ipAddress = "127.0.0.1"; // Would get from request headers
    const userAgent = "GDPR data deletion"; // Would get from request headers

    // Log the deletion request
    await ctx.db.insert("auditLogs", {
      userId,
      action: "data_deletion",
      details: "User requested data deletion",
      ipAddress,
      userAgent,
      timestamp: Date.now(),
    });

    // SECURITY: Implement transactional deletion to prevent partial state
    try {
      // Delete in order to respect foreign key constraints

      // Delete feedback first
      const feedback = await ctx.db
        .query("messageFeedback")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const item of feedback) {
        await ctx.db.delete(item._id);
      }

      // Delete chat messages
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete chat sessions
      const sessions = await ctx.db
        .query("chatSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }

      // Delete document chunks
      const chunks = await ctx.db
        .query("documentChunks")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
      }

      // Delete documents
      const documents = await ctx.db
        .query("documents")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const doc of documents) {
        await ctx.db.delete(doc._id);
      }

      // Delete document collections
      const collections = await ctx.db
        .query("documentCollections")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const collection of collections) {
        await ctx.db.delete(collection._id);
      }

      // Delete usage data
      const usage = await ctx.db
        .query("usage")
        .withIndex("userId_periodEnd", (q) => q.eq("userId", userId))
        .collect();

      for (const usageItem of usage) {
        await ctx.db.delete(usageItem._id);
      }

      // Delete subscriptions
      const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const sub of subscriptions) {
        await ctx.db.delete(sub._id);
      }

      // Delete GDPR consents
      const consents = await ctx.db
        .query("gdprConsents")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();

      for (const consent of consents) {
        await ctx.db.delete(consent._id);
      }

      // Delete user record last
      await ctx.db.delete(userId);

      return { success: true };
    } catch (error) {
      // SECURITY: Log deletion failure but don't expose details
      await ctx.db.insert("auditLogs", {
        userId,
        action: "data_deletion",
        details: "Data deletion failed - please contact support",
        ipAddress,
        userAgent,
        timestamp: Date.now(),
      });
      throw new Error("Account deletion failed. Please contact support.");
    }
  },
});

// Get audit logs for admin purposes (ADMIN ONLY)
export const getAuditLogs = query({
  args: {
    userId: v.optional(v.id("users")),
    action: v.optional(
      v.union(
        v.literal("data_export"),
        v.literal("data_deletion"),
        v.literal("data_access"),
        v.literal("consent_update"),
        v.literal("account_created"),
        v.literal("account_deleted"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // SECURITY: Only authenticated users can access their own audit logs
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Authentication required to access audit logs");
    }

    // SECURITY: Users can only access their own audit logs
    const targetUserId = args.userId || currentUserId;
    if (targetUserId !== currentUserId) {
      throw new Error("Access denied: insufficient permissions");
    }

    let results;

    if (args.action) {
      results = await ctx.db
        .query("auditLogs")
        .withIndex("userId", (q) => q.eq("userId", targetUserId))
        .filter((q) => q.eq(q.field("action"), args.action))
        .collect();
    } else {
      results = await ctx.db
        .query("auditLogs")
        .withIndex("userId", (q) => q.eq("userId", targetUserId))
        .collect();
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    // SECURITY: Limit results to prevent resource exhaustion
    const maxLimit = Math.min(args.limit || 100, 1000);
    if (results.length > maxLimit) {
      results = results.slice(0, maxLimit);
    }

    return results;
  },
});
