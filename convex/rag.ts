import {
  action,
  internalAction,
  internalQuery,
  query,
  internalMutation,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { PROCESSING_STATUS } from "./schema";

// OpenAI configuration for embeddings and processing
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = "https://api.openai.com/v1";

// Helper to generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok)
    throw new Error(`Embedding failed: ${await response.text()}`);
  const data = await response.json();
  return data.data[0].embedding;
}

// Internal mutations
export const patchDocument = internalMutation({
  args: { documentId: v.id("documents"), updates: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, args.updates);
  },
});

export const insertParent = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documentParents", {
      documentId: args.documentId,
      userId: args.userId,
      content: args.content,
      metadata: args.metadata,
    });
  },
});

export const insertChunk = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    parentId: v.optional(v.id("documentParents")),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.float64()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("documentChunks", {
      documentId: args.documentId,
      userId: args.userId,
      collectionId: args.collectionId,
      parentId: args.parentId,
      chunkIndex: args.chunkIndex,
      content: args.content,
      embedding: args.embedding,
      metadata: args.metadata,
    });
  },
});

// Helper queries
export const getDocumentById = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => await ctx.db.get(args.documentId),
});

export const getParentById = internalQuery({
  args: { parentId: v.id("documentParents") },
  handler: async (ctx, args) => await ctx.db.get(args.parentId),
});

export const getChunkById = query({
  args: { chunkId: v.id("documentChunks") },
  handler: async (ctx, args) => await ctx.db.get(args.chunkId),
});

export const getDocumentByIdQuery = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => await ctx.db.get(args.documentId),
});

export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const getCollectionById = query({
  args: { collectionId: v.id("documentCollections") },
  handler: async (ctx, args) => await ctx.db.get(args.collectionId),
});

// Search types
export interface CatalogSearchResult {
  _id: Id<"documentChunks">;
  _score: number;
  type: "chunk" | "part";
  documentId: Id<"documents">;
  content: string; // Hierarchical Parent context
  snippet: string; // Original small snippet
  partNumber?: string;
  description?: string;
  category?: string;
  pageNumber?: number;
  documentName?: string;
  parser?: string;
}

// Main Search Action (Hybrid + Hierarchical Context)
export const searchCatalog = action({
  args: {
    query: v.string(),
    collectionIds: v.array(v.id("documentCollections")),
    searchType: v.optional(
      v.union(
        v.literal("semantic"),
        v.literal("part_number"),
        v.literal("hybrid"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<CatalogSearchResult[]> => {
    const limit = args.limit || 8;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.runQuery(api.rag.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const queryEmbedding = await generateEmbedding(args.query);

    // 1. Semantic search across chunks
    const vectorResults = await ctx.vectorSearch(
      "documentChunks",
      "embedding_index",
      {
        vector: queryEmbedding,
        limit: limit * 2,
        filter: (q) => q.eq("userId", user._id),
      },
    );

    const results: CatalogSearchResult[] = [];
    const seenParentIds = new Set<string>();

    for (const res of vectorResults) {
      const chunk = await ctx.runQuery(api.rag.getChunkById, {
        chunkId: res._id,
      });
      if (!chunk || !args.collectionIds.includes(chunk.collectionId)) continue;

      let content = chunk.content;
      // 2. High-Accuracy Context Swap (Child -> Parent)
      if (chunk.parentId) {
        if (seenParentIds.has(chunk.parentId)) continue;
        const parent = await ctx.runQuery(internal.rag.getParentById, {
          parentId: chunk.parentId,
        });
        if (parent) {
          content = parent.content;
          seenParentIds.add(chunk.parentId);
        }
      }

      const doc = await ctx.runQuery(api.rag.getDocumentByIdQuery, {
        documentId: chunk.documentId,
      });

      results.push({
        _id: res._id,
        _score: res._score,
        type: "chunk",
        documentId: chunk.documentId,
        documentName: doc?.name || "Unknown",
        content: content,
        snippet: chunk.content,
        pageNumber: chunk.metadata?.pageNumber,
        parser: (doc?.metadata as any)?.parser || "unstructured",
      });

      if (results.length >= limit) break;
    }

    return results;
  },
});

// Legacy support for part number search
export const searchChunksForPartNumberInternal = internalAction({
  args: {
    partNumber: v.string(),
    collectionId: v.id("documentCollections"),
    limit: v.number(),
  },
  handler: async () => ({ matches: [], hasMore: false }), // Simplified for now
});

export const searchDocuments = searchCatalog;

// Internal action to process documents
export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    jobId: v.optional(v.id("processingJobs")),
  },
  handler: async (ctx, args) => {
    try {
      if (args.jobId) {
        await ctx.runMutation(internal.processingJobs.updateStatus, {
          jobId: args.jobId as Id<"processingJobs">,
          status: "parsing",
        });
      }

      const document = await ctx.runQuery(api.rag.getDocumentById, {
        documentId: args.documentId,
      });
      if (!document) throw new Error("Document not found");

      await ctx.scheduler.runAfter(0, internal.ragProcess.processTextOrPdf, {
        documentId: args.documentId,
        userId: args.userId,
        jobId: args.jobId,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.rag.patchDocument, {
        documentId: args.documentId,
        updates: {
          processingStatus: PROCESSING_STATUS.FAILED,
          errorMessage: error.message,
        },
      });
    }
  },
});
