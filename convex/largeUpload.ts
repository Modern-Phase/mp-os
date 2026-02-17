"use node";

import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { JOB_STATUS } from "./schema";
import { Id } from "./_generated/dataModel";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Type for collection from listCollections query
interface Collection {
  _id: Id<"documentCollections">;
  name: string;
  userId: Id<"users">;
}

// R2/S3 configuration from environment
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "large-documents";

// Large file threshold (100MB)
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;
// Maximum file size (2GB)
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

// Helper to check if R2 is configured
function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Generate presigned URL for R2 upload
async function generateR2PresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600,
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error(
      "R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.",
    );
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

// Generate presigned GET URL for R2 (so LlamaParse can download the file)
export const generateR2PresignedGetUrl = internalAction({
  args: {
    key: v.string(),
    expiresIn: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isR2Configured()) {
      throw new Error("R2 storage is not configured.");
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: args.key,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn: args.expiresIn || 3600,
    });
    return url;
  },
});

// Initiate a large file upload
export const initiateLargeUpload = action({
  args: {
    name: v.string(),
    collectionId: v.id("documentCollections"),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    documentId: Id<"documents">;
    uploadUrl: string;
    r2Key: string;
  }> => {
    // Validate file size
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new Error(
        `File size must be less than 2GB. Received: ${(args.fileSize / 1024 / 1024 / 1024).toFixed(2)}GB`,
      );
    }

    if (args.fileSize < LARGE_FILE_THRESHOLD) {
      throw new Error("Use standard upload for files under 100MB");
    }

    // Validate file type (only PDF supported for large files initially)
    if (!args.mimeType.includes("pdf")) {
      throw new Error("Only PDF files are supported for large file upload");
    }

    // Get auth identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get user from database
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify collection belongs to user
    const collections = await ctx.runQuery(api.collections.listCollections);
    const collection = collections.find(
      (c: Collection) => c._id === args.collectionId,
    );
    if (!collection) {
      throw new Error("Collection not found or access denied");
    }

    // Generate unique key for R2
    const timestamp = Date.now();
    const sanitizedName = args.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const r2Key = `${user._id}/${timestamp}-${sanitizedName}`;

    // Generate presigned URL for upload
    const uploadUrl = await generateR2PresignedUrl(r2Key, args.mimeType);

    // Create document record with pending status via internal action
    const documentId: Id<"documents"> = await ctx.runAction(
      internal.largeUpload.createLargeDocument,
      {
        userId: user._id,
        collectionId: args.collectionId,
        name: args.name,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        r2Key,
      },
    );

    // Create processing job (r2Key stored in document metadata, presigned URL generated at finalize time)
    await ctx.runMutation(internal.processingJobs.create, {
      documentId,
      userId: user._id,
      externalStorageUrl: r2Key,
    });

    return {
      documentId,
      uploadUrl,
      r2Key,
    };
  },
});

// Internal action to create document record for large files
export const createLargeDocument = internalAction({
  args: {
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    name: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    r2Key: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    // Create a placeholder in Convex storage
    // We store a small marker file to get a valid storage ID
    const placeholder = new Blob(["Large file stored in R2"], {
      type: "text/plain",
    });
    const storageId = await ctx.storage.store(placeholder);

    // Insert document with metadata containing R2 info
    const documentId = await ctx.runMutation(
      internal.largeUploadMutations.insertDocumentRecord,
      {
        userId: args.userId,
        collectionId: args.collectionId,
        name: args.name,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        storageId,
        r2Key: args.r2Key,
      },
    );

    return documentId;
  },
});

// Type for processing job
interface ProcessingJob {
  _id: Id<"processingJobs">;
  userId: Id<"users">;
  documentId: Id<"documents">;
  status: string;
  externalStorageUrl?: string;
}

// Finalize upload and trigger processing
export const finalizeLargeUpload = action({
  args: {
    documentId: v.id("documents"),
    r2Key: v.string(),
    parser: v.optional(v.union(v.literal("llamaparse"), v.literal("docling"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; jobId: Id<"processingJobs"> }> => {
    // Get auth identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Get user
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user) {
      throw new Error("User not found");
    }

    // Get processing job
    const job: ProcessingJob | null = await ctx.runQuery(
      internal.processingJobs.getByDocumentId,
      {
        documentId: args.documentId,
      },
    );

    if (!job) {
      throw new Error("Processing job not found");
    }

    if (job.userId !== user._id) {
      throw new Error("Access denied");
    }

    // Generate a presigned GET URL for parser to download the file (valid for 4 hours)
    const presignedGetUrl = await ctx.runAction(
      internal.largeUpload.generateR2PresignedGetUrl,
      { key: args.r2Key, expiresIn: 14400 },
    );

    const parserChoice = args.parser || "llamaparse";

    // Update job status to uploading complete, now parsing
    await ctx.runMutation(internal.processingJobs.updateStatus, {
      jobId: job._id,
      status: JOB_STATUS.PARSING,
      statusMessage: `Starting ${parserChoice} parsing...`,
    });

    // Route to the selected parser
    if (parserChoice === "docling") {
      await ctx.scheduler.runAfter(0, internal.doclingParse.submitForParsing, {
        documentId: args.documentId,
        jobId: job._id,
        storageUrl: presignedGetUrl,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.llamaParse.submitForParsing, {
        documentId: args.documentId,
        jobId: job._id,
        storageUrl: presignedGetUrl,
      });
    }

    return { success: true, jobId: job._id };
  },
});

// Check if file should use large upload
export const shouldUseLargeUpload = action({
  args: {
    fileSize: v.number(),
  },
  handler: async (_ctx, args) => {
    return {
      useLargeUpload: args.fileSize >= LARGE_FILE_THRESHOLD,
      threshold: LARGE_FILE_THRESHOLD,
      maxSize: MAX_FILE_SIZE,
      r2Configured: isR2Configured(),
    };
  },
});
