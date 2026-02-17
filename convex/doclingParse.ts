"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { JOB_STATUS } from "./schema";

const DOCLING_SERVE_URL = process.env.DOCLING_SERVE_URL;
const DOCLING_API_KEY = process.env.DOCLING_API_KEY;

// Pages per batch — reduced to prevent OOM on memory-limited containers (Railway)
const PAGES_PER_BATCH = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function isDoclingConfigured(): boolean {
  return !!DOCLING_SERVE_URL;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (DOCLING_API_KEY) {
    headers["Authorization"] = `Bearer ${DOCLING_API_KEY}`;
  }
  return headers;
}

function extractMarkdown(data: any): string {
  if (data.document?.md_content) return data.document.md_content;
  if (data.md_content) return data.md_content;
  if (data.content) return data.content;
  if (data.result)
    return typeof data.result === "string"
      ? data.result
      : JSON.stringify(data.result);
  if (Array.isArray(data.document_results)) {
    return data.document_results
      .map(
        (r: { md_content?: string; content?: string }) =>
          r.md_content || r.content || "",
      )
      .join("\n\n");
  }
  return JSON.stringify(data);
}

export const submitForParsing = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    storageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isDoclingConfigured()) {
      console.log(
        "Docling-Serve not configured, falling back to direct processing",
      );
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.CHUNKING,
      });
      await ctx.scheduler.runAfter(0, internal.ragLarge.processDirectly, {
        documentId: args.documentId,
        jobId: args.jobId,
      });
      return;
    }

    try {
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.PARSING,
        statusMessage: "Starting Docling conversion (batch 1)...",
      });

      await ctx.scheduler.runAfter(0, internal.doclingParse.convertBatch, {
        documentId: args.documentId,
        jobId: args.jobId,
        storageUrl: args.storageUrl,
        startPage: 1,
        batchNumber: 1,
        allMarkdown: "",
      });
    } catch (error) {
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.FAILED,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

export const convertBatch = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    storageUrl: v.string(),
    startPage: v.number(),
    batchNumber: v.number(),
    allMarkdown: v.string(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const endPage = args.startPage + PAGES_PER_BATCH - 1;

    try {
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.PARSING,
        statusMessage: `Docling converting pages ${args.startPage}-${endPage} (batch ${args.batchNumber})...`,
        progress: {
          processedPages: args.startPage - 1,
        },
      });

      let response: Response | null = null;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        response = await fetch(`${DOCLING_SERVE_URL}/v1/convert/source`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            sources: [{ kind: "http", url: args.storageUrl }],
            options: {
              to_formats: ["md"],
              do_ocr: false, // Huge memory saver
              do_table_structure: true,
              image_export_mode: "placeholder", // Prevent massive base64 strings in memory
              images_scale: 0.8,
              page_range: [args.startPage, endPage],
            },
          }),
        });

        if (response.ok || (response.status < 500 && response.status !== 429)) {
          break;
        }

        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      if (!response!.ok) {
        if (response!.status === 422 && args.batchNumber > 1) {
          await finalizeParsing(ctx, args);
          return;
        }
        throw new Error(
          `Docling batch ${args.batchNumber} failed: ${response!.status}`,
        );
      }

      const data = await response!.json();
      const batchMarkdown = extractMarkdown(data);

      if (!batchMarkdown || batchMarkdown.length < 10) {
        await finalizeParsing(ctx, args);
        return;
      }

      const pageMarker = `\n<!-- Page ${args.startPage} -->\n`;
      const newContent = pageMarker + batchMarkdown;

      let previousMarkdown = args.allMarkdown;
      if (args.storageId) {
        const blob = await ctx.storage.get(args.storageId);
        if (blob) previousMarkdown = await blob.text();
        await ctx.storage.delete(args.storageId);
      }

      const accumulated = previousMarkdown + newContent;
      const contentBlob = new Blob([accumulated], { type: "text/plain" });
      const storageId = await ctx.storage.store(contentBlob);

      await ctx.scheduler.runAfter(500, internal.doclingParse.convertBatch, {
        documentId: args.documentId,
        jobId: args.jobId,
        storageUrl: args.storageUrl,
        startPage: args.startPage + PAGES_PER_BATCH,
        batchNumber: args.batchNumber + 1,
        allMarkdown: "",
        storageId,
      });
    } catch (error) {
      if (
        args.batchNumber > 1 &&
        (args.allMarkdown.length > 0 || args.storageId)
      ) {
        await finalizeParsing(ctx, args);
      } else {
        await ctx.runMutation(internal.processingJobs.updateStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.FAILED,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  },
});

async function finalizeParsing(
  ctx: any,
  args: {
    documentId: Id<"documents">;
    jobId: Id<"processingJobs">;
    allMarkdown: string;
    storageId?: Id<"_storage">;
  },
) {
  let finalMarkdown = args.allMarkdown;
  if (args.storageId) {
    const blob = await ctx.storage.get(args.storageId);
    if (blob) finalMarkdown = await blob.text();
    await ctx.storage.delete(args.storageId);
  }

  if (!finalMarkdown || finalMarkdown.length < 10) {
    await ctx.runMutation(internal.processingJobs.updateStatus, {
      jobId: args.jobId,
      status: JOB_STATUS.FAILED,
      error: "Docling returned no usable content",
    });
    return;
  }

  const pages = splitIntoPages(finalMarkdown);

  await ctx.runMutation(internal.processingJobs.updateStatus, {
    jobId: args.jobId,
    status: JOB_STATUS.CHUNKING,
    progress: { totalPages: pages.length },
  });

  const contentBlob = new Blob([finalMarkdown], { type: "text/plain" });
  const storageId = await ctx.storage.store(contentBlob);

  await ctx.scheduler.runAfter(0, internal.ragLarge.processFromStorage, {
    documentId: args.documentId,
    jobId: args.jobId,
    storageId,
    totalPages: pages.length,
  });
}

function splitIntoPages(content: string): string[] {
  const pagePatterns = [
    /\n<!--\s*Page\s+\d+\s*-->\n/gi,
    /\n---\s*Page\s+\d+\s*---\n/gi,
    /\n---\s*BATCH SEPARATOR\s*---\n/gi,
    /\n-{3,}\n/g,
    /\n#{1,2}\s*Page\s+\d+/gi,
  ];

  let pages: string[] = [];
  for (const pattern of pagePatterns) {
    const splits = content.split(pattern);
    if (splits.length > 1) {
      pages = splits.filter((p) => p.trim().length > 0);
      break;
    }
  }

  if (pages.length === 0) {
    const CHARS_PER_PAGE = 3000;
    for (let i = 0; i < content.length; i += CHARS_PER_PAGE) {
      const page = content.slice(i, i + CHARS_PER_PAGE);
      if (page.trim().length > 0) pages.push(page);
    }
  }

  return pages.length > 0 ? pages : [content];
}

export const handleWebhook = internalAction({
  args: {
    externalJobId: v.string(),
    status: v.string(),
    resultUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    console.log(
      `[Docling Webhook] Received: ${args.externalJobId} - ${args.status}`,
    );
  },
});
