import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DOCUMENT_TYPES, PROCESSING_STATUS } from "./schema";

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "large-documents";

// Internal mutation to insert document record for large files
export const insertDocumentRecord = internalMutation({
  args: {
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    name: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    r2Key: v.string(),
  },
  handler: async (ctx, args) => {
    const documentId = await ctx.db.insert("documents", {
      userId: args.userId,
      collectionId: args.collectionId,
      name: args.name,
      type: DOCUMENT_TYPES.PDF,
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      processingStatus: PROCESSING_STATUS.PENDING,
      metadata: {
        isLargeDocument: true,
        r2Key: args.r2Key,
        r2Bucket: R2_BUCKET_NAME,
      },
    });
    return documentId;
  },
});
