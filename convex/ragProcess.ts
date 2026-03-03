"use node";

import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { DOCUMENT_TYPES, PROCESSING_STATUS } from "./schema";

// Embedding config — prefer OpenRouter, fall back to OpenAI direct
const OPEN_ROUTER = process.env.OPEN_ROUTER;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_API_KEY = OPEN_ROUTER || OPENAI_API_KEY;
const EMBEDDING_BASE_URL = OPEN_ROUTER
  ? "https://openrouter.ai/api/v1"
  : "https://api.openai.com/v1";
const EMBEDDING_MODEL = OPEN_ROUTER
  ? "openai/text-embedding-3-small"
  : "text-embedding-3-small";

const UNSTRUCTURED_API_KEY = process.env.UNSTRUCTURED_API_KEY;
const UNSTRUCTURED_URL =
  process.env.UNSTRUCTURED_URL ||
  "https://api.unstructuredapp.io/general/v0/general";

const CHILD_CHUNK_SIZE = 400;
const CHILD_CHUNK_OVERLAP = 80;
const PAGES_PER_UNSTRUCTURED_BATCH = 20; // Small batches to stay within timeouts

async function generateEmbedding(text: string): Promise<number[]> {
  if (!EMBEDDING_API_KEY) throw new Error("OPEN_ROUTER or OPENAI_API_KEY not configured");

  const response = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EMBEDDING_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!response.ok)
    throw new Error(`Embedding failed: ${await response.text()}`);
  const data = await response.json();
  return data.data[0].embedding;
}

function chunkText(
  text: string,
  size: number = CHILD_CHUNK_SIZE,
  overlap: number = CHILD_CHUNK_OVERLAP,
): string[] {
  if (!text || text.trim().length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start + size * 0.8) end = lastSpace;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length - overlap) break;
  }
  return chunks;
}

export const processTextOrPdf = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    jobId: v.optional(v.id("processingJobs")),
    startPage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startPage = args.startPage || 1;

    try {
      const document = await ctx.runQuery(api.rag.getDocumentById, {
        documentId: args.documentId,
      });
      if (!document) throw new Error("Document not found");

      const blob = await ctx.storage.get(document.storageId);
      if (!blob) throw new Error("Storage file missing");

      if (document.type === DOCUMENT_TYPES.PDF && UNSTRUCTURED_API_KEY) {
        // 1. Determine page range
        const endPage = startPage + PAGES_PER_UNSTRUCTURED_BATCH - 1;

        if (args.jobId) {
          await ctx.runMutation(internal.processingJobs.updateStatus, {
            jobId: args.jobId as Id<"processingJobs">,
            status: "parsing",
            statusMessage: `Unstructured parsing pages ${startPage}-${endPage}...`,
            progress: { processedPages: startPage - 1 },
          });
        }

        // 2. Prepare request (using R2 URL to avoid body limits)
        const metadata = document.metadata as any;
        const formData = new FormData();

        if (metadata?.isLargeDocument && metadata?.r2Key) {
          const presignedUrl = await ctx.runAction(
            internal.largeUpload.generateR2PresignedGetUrl,
            { key: metadata.r2Key },
          );
          formData.append("url", presignedUrl);
        } else {
          formData.append(
            "files",
            new File([blob], document.name, { type: "application/pdf" }),
          );
        }

        formData.append("strategy", "hi_res");
        formData.append("chunking_strategy", "by_title");
        // Use an array of numbers for Unstructured API
        const pages = Array.from(
          { length: PAGES_PER_UNSTRUCTURED_BATCH },
          (_, i) => startPage + i,
        );
        formData.append("page_numbers", JSON.stringify(pages));

        const response = await fetch(UNSTRUCTURED_URL, {
          method: "POST",
          headers: { "unstructured-api-key": UNSTRUCTURED_API_KEY },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          // If we reached the end of document, it might 422 or return empty
          if (response.status === 422 || errorText.includes("out of range")) {
            console.log("Reached end of document during batching");
            await finalizeDocument(ctx, args.documentId, args.jobId);
            return;
          }
          throw new Error(`Unstructured failed: ${errorText}`);
        }

        const elements = await response.json();
        if (elements.length === 0) {
          await finalizeDocument(ctx, args.documentId, args.jobId);
          return;
        }

        // 3. Process elements into Parent-Child chunks
        let totalChildChunks = 0;
        for (const el of elements) {
          const parentContent = el.text || el.content || "";
          if (parentContent.length < 20) continue;

          const parentId = await ctx.runMutation(internal.rag.insertParent, {
            documentId: args.documentId,
            userId: args.userId,
            content: parentContent,
            metadata: el.metadata,
          });

          const childTexts = chunkText(parentContent);
          for (const childText of childTexts) {
            const contextPrefix = `Document: ${document.name}\nSection: ${el.metadata?.category || "General"}\n\n`;
            const contentWithContext = contextPrefix + childText;
            const embedding = await generateEmbedding(contentWithContext);

            await ctx.runMutation(internal.rag.insertChunk, {
              documentId: args.documentId,
              userId: args.userId,
              collectionId: document.collectionId,
              parentId,
              chunkIndex: totalChildChunks++,
              content: contentWithContext,
              embedding,
              metadata: {
                pageNumber: el.metadata?.page_number,
                section: el.metadata?.parent_id || el.metadata?.category,
              },
            });
          }
        }

        // 4. Schedule next batch
        await ctx.scheduler.runAfter(
          500,
          internal.ragProcess.processTextOrPdf,
          {
            ...args,
            startPage: endPage + 1,
          },
        );
      } else {
        // Standard non-batched processing for small/other files
        const text = await blob.text();
        const parentId = await ctx.runMutation(internal.rag.insertParent, {
          documentId: args.documentId,
          userId: args.userId,
          content: text,
        });

        const chunks = chunkText(text);
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i]);
          await ctx.runMutation(internal.rag.insertChunk, {
            documentId: args.documentId,
            userId: args.userId,
            collectionId: document.collectionId,
            parentId,
            chunkIndex: i,
            content: chunks[i],
            embedding,
          });
        }
        await finalizeDocument(ctx, args.documentId, args.jobId);
      }
    } catch (error: any) {
      console.error("Batch processing error:", error);
      if (args.jobId) {
        await ctx.runMutation(internal.processingJobs.updateStatus, {
          jobId: args.jobId as Id<"processingJobs">,
          status: "failed",
          error: error.message,
        });
      }
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

async function finalizeDocument(
  ctx: any,
  documentId: Id<"documents">,
  jobId?: Id<"processingJobs">,
) {
  if (jobId) {
    await ctx.runMutation(internal.processingJobs.updateStatus, {
      jobId,
      status: "completed",
    });
  }
  await ctx.runMutation(internal.rag.patchDocument, {
    documentId,
    updates: { processingStatus: PROCESSING_STATUS.COMPLETED },
  });
}

export const processImage = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    jobId: v.optional(v.id("processingJobs")),
  },
  handler: async (_ctx, _args) => {
    // ... (Keep existing image logic)
  },
});

export const processAudio = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    jobId: v.optional(v.id("processingJobs")),
  },
  handler: async (_ctx, _args) => {
    // ... (Keep existing audio logic)
  },
});

export const processVideo = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    jobId: v.optional(v.id("processingJobs")),
  },
  handler: async (ctx, args) => {
    await ctx.runAction(internal.ragProcess.processAudio, args);
  },
});
