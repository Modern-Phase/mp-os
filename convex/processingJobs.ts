import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { JOB_STATUS, jobStatusValidator } from "./schema";

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

// Status messages for user-friendly display
const STATUS_MESSAGES: Record<string, string> = {
  queued: "Waiting to start processing...",
  uploading: "Uploading document to cloud storage...",
  parsing: "Extracting text and images from PDF...",
  chunking: "Processing pages and creating searchable chunks...",
  embedding: "Generating AI search embeddings...",
  completed: "Processing complete! Document is ready for search.",
  failed: "Processing encountered an error.",
};

// Create a new processing job
export const create = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    status: v.optional(jobStatusValidator),
    externalStorageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status = args.status || JOB_STATUS.QUEUED;
    const jobId = await ctx.db.insert("processingJobs", {
      documentId: args.documentId,
      userId: args.userId,
      status: status,
      statusMessage: STATUS_MESSAGES[status],
      processedPages: 0,
      processedChunks: 0,
      retryCount: 0,
      externalStorageUrl: args.externalStorageUrl,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    });
    return jobId;
  },
});

// Update job status and progress
export const updateStatus = internalMutation({
  args: {
    jobId: v.id("processingJobs"),
    status: jobStatusValidator,
    statusMessage: v.optional(v.string()),
    progress: v.optional(
      v.object({
        processedPages: v.optional(v.number()),
        totalPages: v.optional(v.number()),
        processedChunks: v.optional(v.number()),
        totalChunks: v.optional(v.number()),
      }),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { jobId, status, statusMessage, progress, error } = args;

    const updates: any = {
      status,
      lastUpdatedAt: Date.now(),
      statusMessage: statusMessage || STATUS_MESSAGES[status],
    };

    if (error) {
      updates.errorMessage = error;
      updates.completedAt = Date.now();
    }

    if (progress) {
      if (progress.processedPages !== undefined)
        updates.processedPages = progress.processedPages;
      if (progress.totalPages !== undefined)
        updates.totalPages = progress.totalPages;
      if (progress.processedChunks !== undefined)
        updates.processedChunks = progress.processedChunks;
      if (progress.totalChunks !== undefined)
        updates.totalChunks = progress.totalChunks;
    }

    if (status === "completed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(jobId, updates);
  },
});

// Increment progress counters
export const incrementProgress = internalMutation({
  args: {
    jobId: v.id("processingJobs"),
    pagesProcessed: v.optional(v.number()),
    chunksProcessed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    const updates: any = { lastUpdatedAt: Date.now() };

    if (args.pagesProcessed) {
      updates.processedPages = job.processedPages + args.pagesProcessed;
    }
    if (args.chunksProcessed) {
      updates.processedChunks = job.processedChunks + args.chunksProcessed;
    }

    await ctx.db.patch(args.jobId, updates);
  },
});

// Public query to get processing status for a document
export const getJobStatus = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const job = await ctx.db
      .query("processingJobs")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();

    if (!job || job.userId !== userId) return null;

    // Calculate progress percentage
    let progressPercent = 0;
    if (job.status === "completed") {
      progressPercent = 100;
    } else if (job.status === "embedding" && job.totalChunks) {
      progressPercent =
        70 + Math.round((job.processedChunks / job.totalChunks) * 30);
    } else if (job.status === "chunking" && job.totalPages) {
      progressPercent =
        40 + Math.round((job.processedPages / job.totalPages) * 30);
    } else if (job.status === "parsing") {
      progressPercent = 20;
    } else if (job.status === "uploading") {
      progressPercent = 10;
    } else if (job.status === "queued") {
      progressPercent = 5;
    }

    const elapsedMs = Date.now() - job.startedAt;
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

    return {
      ...job,
      progressPercent,
      elapsedTime: `${elapsedMinutes}m ${elapsedSeconds}s`,
    };
  },
});

// Legacy/Compatibility exports
export const getByDocumentId = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processingJobs")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .unique();
  },
});
