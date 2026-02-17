import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { PROCESSING_STATUS } from "./schema";

// Insert pending chunk (without embedding) - single
export const insertPendingChunk = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    content: v.string(),
    pageNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current chunk count for this document
    const existingChunks = await ctx.db
      .query("documentChunks")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    const chunkIndex = existingChunks.length;

    // Insert with empty embedding (will be filled later)
    await ctx.db.insert("documentChunks", {
      documentId: args.documentId,
      userId: args.userId,
      collectionId: args.collectionId,
      chunkIndex,
      content: args.content,
      embedding: [], // Empty for now
      metadata: {
        pageNumber: args.pageNumber,
      },
    });
  },
});

// Batch insert pending chunks (for better performance)
export const insertPendingChunksBatch = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    chunks: v.array(
      v.object({
        content: v.string(),
        pageNumber: v.number(),
        parentId: v.optional(v.id("documentParents")),
      }),
    ),
    startIndex: v.number(), // Starting chunk index
  },
  handler: async (ctx, args) => {
    // Insert all chunks with sequential indices
    for (let i = 0; i < args.chunks.length; i++) {
      const chunk = args.chunks[i];
      await ctx.db.insert("documentChunks", {
        documentId: args.documentId,
        userId: args.userId,
        collectionId: args.collectionId,
        parentId: chunk.parentId,
        chunkIndex: args.startIndex + i,
        content: chunk.content,
        embedding: [], // Empty for now
        metadata: {
          pageNumber: chunk.pageNumber,
        },
      });
    }
    return args.startIndex + args.chunks.length; // Return next index
  },
});

// Get current chunk count for a document - paginated to avoid read limits
export const getChunkCount = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    let count = 0;
    let cursor: string | null = null;

    while (true) {
      const results = await ctx.db
        .query("documentChunks")
        .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
        .paginate({ numItems: 500, cursor });

      count += results.page.length;

      if (results.isDone) break;
      cursor = results.continueCursor;
    }

    return count;
  },
});

// Insert pending part (without embedding)
export const insertPendingPart = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    partNumber: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    pageNumber: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if part already exists
    const existing = await ctx.db
      .query("catalogParts")
      .withIndex("partNumber", (q) => q.eq("partNumber", args.partNumber))
      .first();

    if (existing) {
      // Update if from same document (might have better description)
      if (existing.documentId === args.documentId) {
        return;
      }
    }

    await ctx.db.insert("catalogParts", {
      documentId: args.documentId,
      userId: args.userId,
      collectionId: args.collectionId,
      partNumber: args.partNumber,
      description: args.description,
      category: args.category,
      pageNumber: args.pageNumber,
      embedding: [], // Empty for now
    });
  },
});

// Get chunks pending embedding - scans from a given chunkIndex
export const getPendingChunks = internalQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.number(),
    startIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Scan chunks starting from startIndex to find ones without embeddings
    // Use smaller batch (500) since chunks WITH embeddings have large arrays (~6KB each)
    const chunkBatchSize = 500;
    const startIdx = args.startIndex ?? 0;

    const chunks = await ctx.db
      .query("documentChunks")
      .withIndex("documentId_chunkIndex", (q) =>
        q.eq("documentId", args.documentId).gte("chunkIndex", startIdx),
      )
      .take(chunkBatchSize);

    // Filter for chunks with empty embeddings
    const pendingChunks = chunks
      .filter((c) => c.embedding.length === 0)
      .slice(0, args.limit);

    // Include the next startIndex for continuation
    const lastChunk = chunks[chunks.length - 1];
    const nextStartIndex = lastChunk
      ? lastChunk.chunkIndex + 1
      : startIdx + chunkBatchSize;

    return { chunks: pendingChunks, nextStartIndex, scanned: chunks.length };
  },
});

// Get parts pending embedding - uses take() to limit data read
export const getPendingParts = internalQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    // Fetch a reasonable batch of parts
    const partBatchSize = Math.max(args.limit * 3, 300);

    const parts = await ctx.db
      .query("catalogParts")
      .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
      .take(partBatchSize);

    // Filter for parts with empty embeddings
    const pendingParts = parts
      .filter((p) => p.embedding.length === 0)
      .slice(0, args.limit);

    return pendingParts;
  },
});

// Update chunk with embedding
export const updateChunkEmbedding = internalMutation({
  args: {
    chunkId: v.id("documentChunks"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chunkId, { embedding: args.embedding });
  },
});

// Update part with embedding
export const updatePartEmbedding = internalMutation({
  args: {
    partId: v.id("catalogParts"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.partId, { embedding: args.embedding });
  },
});

// Get part count for document - paginated to avoid read limits
export const getPartCount = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    let count = 0;
    let cursor: string | null = null;

    while (true) {
      const results = await ctx.db
        .query("catalogParts")
        .withIndex("documentId", (q) => q.eq("documentId", args.documentId))
        .paginate({ numItems: 500, cursor });

      count += results.page.length;

      if (results.isDone) break;
      cursor = results.continueCursor;
    }

    return count;
  },
});

// Update document status after processing
export const updateDocumentStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    chunkCount: v.number(),
    partsCount: v.number(),
    parser: v.optional(v.union(v.literal("llamaparse"), v.literal("docling"))),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      processingStatus: PROCESSING_STATUS.COMPLETED,
      metadata: {
        chunkCount: args.chunkCount,
        partsCount: args.partsCount,
        parser: args.parser,
      },
    });
  },
});
