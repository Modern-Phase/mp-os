import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { DOCUMENT_TYPES, PLANS, PROCESSING_STATUS } from "./schema";
import { checkAndIncrementRateLimit, RATE_LIMITS } from "./rateLimit";
import {
  canCreateDocument,
  getPeriodEndForUser,
  PLAN_LIMITS,
} from "./usage";

// Auth helper
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

// Document type validator
const documentTypeValidator = v.union(
  v.literal(DOCUMENT_TYPES.TEXT),
  v.literal(DOCUMENT_TYPES.PDF),
  v.literal(DOCUMENT_TYPES.CSV),
  v.literal(DOCUMENT_TYPES.IMAGE),
  v.literal(DOCUMENT_TYPES.AUDIO),
  v.literal(DOCUMENT_TYPES.VIDEO),
);

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to upload documents");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Debug query to check subscription status
export const debugSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { error: "Not authenticated" };

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .unique();

    const plan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : null;

    const allPlans = await ctx.db.query("plans").collect();

    return {
      userId,
      hasSubscription: !!subscription,
      subscription: subscription || null,
      plan: plan || null,
      allPlans,
    };
  },
});

export const createDocument = mutation({
  args: {
    name: v.string(),
    collectionId: v.id("documentCollections"),
    type: documentTypeValidator,
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to create document");
    }

    // Verify collection belongs to user
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    // Rate limit: uploads per minute per user
    const uploadRateLimit = await checkAndIncrementRateLimit(
      ctx,
      `upload:${userId}`,
      RATE_LIMITS.upload.limit,
      RATE_LIMITS.upload.windowMs,
    );
    if (!uploadRateLimit.allowed) {
      throw new Error("Too many uploads. Try again in a minute.");
    }

    // Validate file size (max 100MB)
    if (args.fileSize > 100 * 1024 * 1024) {
      throw new Error("File size must be less than 100MB");
    }

    // DEVELOPMENT: Skip limit checks while building
    // TODO: Before launch, set SKIP_LIMITS_FOR_DEV to false and improve error messages
    // Error messages should be user-friendly, e.g.:
    //   "You've reached your upload limit. Upgrade to Pro to upload more documents."
    //   "Not enough storage space. Delete some documents or upgrade to get more storage."
    // NOT technical messages like "Plan: free, Documents: 10/10"
    const SKIP_LIMITS_FOR_DEV = true;

    if (!SKIP_LIMITS_FOR_DEV) {
      // Check plan limits (documents count + storage)
      const periodEnd = await getPeriodEndForUser(ctx, userId);
      const usageRow = await ctx.db
        .query("usage")
        .withIndex("userId_periodEnd", (q) =>
          q.eq("userId", userId).eq("periodEnd", periodEnd),
        )
        .unique();
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .unique();
      const plan = subscription?.planId
        ? await ctx.db.get(subscription.planId)
        : null;
      const planKey = plan?.key ?? PLANS.FREE;
      const limits = PLAN_LIMITS[planKey];
      const documentsCreated = usageRow?.documentsCreated ?? 0;
      const storageBytes = usageRow?.storageBytes ?? 0;

      if (
        !canCreateDocument(
          { documentsCreated, storageBytes, limits },
          args.fileSize,
        )
      ) {
        // TODO: Replace with user-friendly message before launch
        throw new Error(
          `Document or storage limit reached. Plan: ${planKey}, Documents: ${documentsCreated}/${limits.documents}, Storage: ${(storageBytes / 1024 / 1024).toFixed(2)}MB/${(limits.storageBytes / 1024 / 1024).toFixed(0)}MB`,
        );
      }
    }

    const documentId = await ctx.db.insert("documents", {
      userId,
      collectionId: args.collectionId,
      name: args.name.trim(),
      type: args.type,
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      processingStatus: PROCESSING_STATUS.PENDING,
    });

    // Create a processing job for status tracking
    const jobId = await ctx.db.insert("processingJobs", {
      documentId,
      userId,
      status: "queued",
      processedPages: 0,
      processedChunks: 0,
      startedAt: Date.now(),
      statusMessage: "Queued for processing...",
    });

    // Schedule processing with the jobId
    await ctx.scheduler.runAfter(0, internal.rag.processDocument, {
      documentId,
      userId,
      jobId, // Pass the jobId to the processor
    });

    // Record usage (document count + storage)
    await ctx.scheduler.runAfter(0, internal.usage.recordDocumentCreated, {
      userId,
      fileSize: args.fileSize,
    });

    return documentId;
  },
});

export const listDocuments = query({
  args: {
    collectionId: v.id("documentCollections"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to list documents");
    }

    // Verify collection belongs to user
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("collectionId", (q) => q.eq("collectionId", args.collectionId))
      .order("desc")
      .collect();

    return documents;
  },
});

export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to get document");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or access denied");
    }

    return document;
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to delete document");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or access denied");
    }

    // Delete all chunks
    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete associated processing job (if any)
    const processingJob = await ctx.db
      .query("processingJobs")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .unique();
    if (processingJob) {
      await ctx.db.delete(processingJob._id);
    }

    // Delete from storage
    await ctx.storage.delete(document.storageId);

    // Delete document record
    await ctx.db.delete(args.documentId);

    return args.documentId;
  },
});

export const getDocumentChunks = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to get document chunks");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or access denied");
    }

    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();

    return chunks;
  },
});

export const getDocumentDownloadUrl = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to download document");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== userId) {
      throw new Error("Document not found or access denied");
    }

    const url = await ctx.storage.getUrl(document.storageId);
    return url;
  },
});
