"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { JOB_STATUS, PROCESSING_STATUS } from "./schema";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = "https://api.openai.com/v1";

const PARENT_CHUNK_SIZE = 2500;
const CHILD_CHUNK_SIZE = 400;
const CHILD_CHUNK_OVERLAP = 80;
const EMBEDDING_BATCH_SIZE = 50;

async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!response.ok)
    throw new Error(`Batch embedding failed: ${await response.text()}`);

  const data = await response.json();
  const sorted = data.data.sort(
    (a: { index: number }, b: { index: number }) => a.index - b.index,
  );
  return sorted.map((d: { embedding: number[] }) => d.embedding);
}

function splitIntoParents(text: string): string[] {
  // Split by headers or large paragraphs
  const segments = text.split(/\n(?:#|---)/g);
  const parents: string[] = [];
  let current = "";

  for (const seg of segments) {
    if ((current + seg).length > PARENT_CHUNK_SIZE && current.length > 0) {
      parents.push(current.trim());
      current = seg;
    } else {
      current += (current ? "\n# " : "") + seg;
    }
  }
  if (current) parents.push(current.trim());
  return parents;
}

function splitIntoChildren(text: string): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + CHILD_CHUNK_SIZE;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start + CHILD_CHUNK_SIZE * 0.8) end = lastSpace;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - CHILD_CHUNK_OVERLAP;
    if (start >= text.length - CHILD_CHUNK_OVERLAP) break;
  }
  return chunks;
}

export const processFromStorage = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    storageId: v.id("_storage"),
    totalPages: v.number(),
    startChar: v.optional(v.number()),
    chunkIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startChar = args.startChar || 0;
    let currentChunkIndex = args.chunkIndex || 0;
    const CHARS_PER_BATCH = 100000;

    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw new Error("Content missing in storage");

      const fullContent = await blob.text();
      const endChar = Math.min(startChar + CHARS_PER_BATCH, fullContent.length);
      const contentSlice = fullContent.slice(startChar, endChar);
      const isLastBatch = endChar >= fullContent.length;

      const doc = await ctx.runQuery(api.rag.getDocumentById, {
        documentId: args.documentId,
      });
      if (!doc) throw new Error("Document not found");

      const parents = splitIntoParents(contentSlice);
      let nextChunkIndex = currentChunkIndex;

      for (const parentText of parents) {
        // 1. Store Parent Context
        const parentId = await ctx.runMutation(internal.rag.insertParent, {
          documentId: args.documentId,
          userId: doc.userId,
          content: parentText,
        });

        // 2. Store Child Chunks (pending embeddings)
        const children = splitIntoChildren(parentText);
        const batch = children.map((c, i) => ({
          content: `Document: ${doc.name}\n\n${c}`,
          parentId,
          pageNumber: Math.floor((startChar + i * CHILD_CHUNK_SIZE) / 3000) + 1,
        }));

        nextChunkIndex = await ctx.runMutation(
          internal.ragLargeMutations.insertPendingChunksBatch,
          {
            documentId: args.documentId,
            userId: doc.userId,
            collectionId: doc.collectionId,
            chunks: batch,
            startIndex: nextChunkIndex,
          },
        );
      }

      await ctx.runMutation(internal.processingJobs.incrementProgress, {
        jobId: args.jobId,
        pagesProcessed: Math.ceil(CHARS_PER_BATCH / 3000),
      });

      if (!isLastBatch) {
        await ctx.scheduler.runAfter(
          100,
          internal.ragLarge.processFromStorage,
          {
            ...args,
            startChar: endChar,
            chunkIndex: nextChunkIndex,
          },
        );
      } else {
        await ctx.storage.delete(args.storageId);
        await ctx.runMutation(internal.processingJobs.updateStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.EMBEDDING,
          statusMessage: "Generating AI embeddings for hierarchical search...",
        });
        await ctx.scheduler.runAfter(0, internal.ragLarge.generateEmbeddings, {
          documentId: args.documentId,
          jobId: args.jobId,
        });
      }
    } catch (error: any) {
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.FAILED,
        error: error.message,
      });
    }
  },
});

export const generateEmbeddings = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    startIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const result = await ctx.runQuery(
        internal.ragLargeMutations.getPendingChunks,
        {
          documentId: args.documentId,
          limit: EMBEDDING_BATCH_SIZE,
          startIndex: args.startIndex || 0,
        },
      );

      if (result.chunks.length > 0) {
        const embeddings = await generateBatchEmbeddings(
          result.chunks.map((c: any) => c.content),
        );

        for (let i = 0; i < result.chunks.length; i++) {
          await ctx.runMutation(
            internal.ragLargeMutations.updateChunkEmbedding,
            {
              chunkId: result.chunks[i]._id,
              embedding: embeddings[i],
            },
          );
        }

        await ctx.runMutation(internal.processingJobs.incrementProgress, {
          jobId: args.jobId,
          chunksProcessed: result.chunks.length,
        });

        await ctx.scheduler.runAfter(
          100,
          internal.ragLarge.generateEmbeddings,
          {
            ...args,
            startIndex: result.nextStartIndex,
          },
        );
        return;
      }

      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.COMPLETED,
      });
      await ctx.runMutation(internal.rag.patchDocument, {
        documentId: args.documentId,
        updates: { processingStatus: PROCESSING_STATUS.COMPLETED },
      });
    } catch (error: any) {
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.FAILED,
        error: error.message,
      });
    }
  },
});

export const processDirectly = internalAction({
  args: { documentId: v.id("documents"), jobId: v.id("processingJobs") },
  handler: async () => {},
});
