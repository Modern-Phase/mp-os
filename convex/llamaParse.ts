"use node";

import { internalAction } from "@cvx/_generated/server";
import { internal } from "@cvx/_generated/api";
import { v } from "convex/values";
import { Id } from "@cvx/_generated/dataModel";
import { JOB_STATUS } from "@cvx/schema";

const LLAMA_PARSE_API_KEY = process.env.LLAMA_PARSE_API_KEY;
const LLAMA_PARSE_BASE_URL = "https://api.cloud.llamaindex.ai/api/parsing";
const MAX_PAGES_PER_BATCH = 600;

function isLlamaParseConfigured(): boolean {
  return !!LLAMA_PARSE_API_KEY;
}

export const submitForParsing = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    storageUrl: v.string(),
    totalPages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isLlamaParseConfigured()) {
      console.log(
        "LlamaParse not configured, falling back to direct processing",
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
      await ctx.scheduler.runAfter(0, internal.llamaParse.submitBatch, {
        documentId: args.documentId,
        jobId: args.jobId,
        storageUrl: args.storageUrl,
        batchNumber: 1,
        startPage: 1,
        endPage: MAX_PAGES_PER_BATCH,
        allBatchResults: [],
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

export const submitBatch = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    storageUrl: v.string(),
    batchNumber: v.number(),
    startPage: v.number(),
    endPage: v.number(),
    allBatchResults: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isLlamaParseConfigured()) throw new Error("LlamaParse not configured");

    try {
      const pageRange = `${args.startPage}-${args.endPage}`;
      const formData = new FormData();
      formData.append("input_url", args.storageUrl);
      formData.append("target_pages", pageRange);
      formData.append(
        "parsing_instruction",
        "Extract part numbers and descriptions from this motorcycle catalog.",
      );
      formData.append("result_type", "markdown");

      const response = await fetch(`${LLAMA_PARSE_BASE_URL}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${LLAMA_PARSE_API_KEY}` },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (
          errorText.includes("DOCUMENT_TOO_LARGE") ||
          errorText.includes("out of range")
        ) {
          if (args.allBatchResults.length > 0) {
            await processAllBatchResults(
              ctx,
              args.documentId,
              args.jobId,
              args.allBatchResults,
            );
          } else {
            await ctx.runMutation(internal.processingJobs.updateStatus, {
              jobId: args.jobId,
              status: JOB_STATUS.FAILED,
              error: "No content extracted",
            });
          }
          return;
        }
        throw new Error(`LlamaParse failed: ${response.status}`);
      }

      const data = await response.json();
      const externalJobId = data.id || data.job_id;

      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.PARSING,
        statusMessage: `LlamaParse batch ${args.batchNumber} processing...`,
        progress: { totalPages: args.batchNumber }, // Placeholder
      });

      await ctx.scheduler.runAfter(10000, internal.llamaParse.pollBatch, {
        documentId: args.documentId,
        jobId: args.jobId,
        storageUrl: args.storageUrl,
        batchNumber: args.batchNumber,
        externalJobId,
        startPage: args.startPage,
        endPage: args.endPage,
        allBatchResults: args.allBatchResults,
        attempts: 0,
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

export const pollBatch = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    storageUrl: v.string(),
    batchNumber: v.number(),
    externalJobId: v.string(),
    startPage: v.number(),
    endPage: v.number(),
    allBatchResults: v.array(v.string()),
    attempts: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.attempts >= 120) {
      if (args.allBatchResults.length > 0) {
        await processAllBatchResults(
          ctx,
          args.documentId,
          args.jobId,
          args.allBatchResults,
        );
        return;
      }
      await ctx.runMutation(internal.processingJobs.updateStatus, {
        jobId: args.jobId,
        status: JOB_STATUS.FAILED,
        error: "Timed out",
      });
      return;
    }

    try {
      const response = await fetch(
        `${LLAMA_PARSE_BASE_URL}/job/${args.externalJobId}`,
        {
          headers: { Authorization: `Bearer ${LLAMA_PARSE_API_KEY}` },
        },
      );
      if (!response.ok)
        throw new Error(`Status check failed: ${response.status}`);
      const data = await response.json();

      if (data.status === "SUCCESS" || data.status === "completed") {
        const resultUrl =
          data.result_url ||
          `${LLAMA_PARSE_BASE_URL}/job/${args.externalJobId}/result/markdown`;
        const resultResponse = await fetch(resultUrl, {
          headers: { Authorization: `Bearer ${LLAMA_PARSE_API_KEY}` },
        });
        const batchContent = await resultResponse.text();
        const updatedResults = [...args.allBatchResults, batchContent];

        if (batchContent.length > 500000) {
          await ctx.scheduler.runAfter(1000, internal.llamaParse.submitBatch, {
            documentId: args.documentId,
            jobId: args.jobId,
            storageUrl: args.storageUrl,
            batchNumber: args.batchNumber + 1,
            startPage: args.endPage + 1,
            endPage: args.endPage + MAX_PAGES_PER_BATCH,
            allBatchResults: updatedResults,
          });
        } else {
          await processAllBatchResults(
            ctx,
            args.documentId,
            args.jobId,
            updatedResults,
          );
        }
      } else if (
        data.status === "FAILURE" ||
        data.status === "failed" ||
        data.status === "ERROR"
      ) {
        await ctx.runMutation(internal.processingJobs.updateStatus, {
          jobId: args.jobId,
          status: JOB_STATUS.FAILED,
          error: "LlamaParse batch failed",
        });
      } else {
        await ctx.scheduler.runAfter(10000, internal.llamaParse.pollBatch, {
          ...args,
          attempts: args.attempts + 1,
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

async function processAllBatchResults(
  ctx: any,
  documentId: Id<"documents">,
  jobId: Id<"processingJobs">,
  batchResults: string[],
) {
  const combinedContent = batchResults.join("\n\n--- BATCH SEPARATOR ---\n\n");
  const contentBlob = new Blob([combinedContent], { type: "text/plain" });
  const storageId = await ctx.storage.store(contentBlob);

  await ctx.runMutation(internal.processingJobs.updateStatus, {
    jobId,
    status: JOB_STATUS.CHUNKING,
    statusMessage: "Processing LlamaParse results...",
  });

  await ctx.scheduler.runAfter(0, internal.ragLarge.processFromStorage, {
    documentId,
    jobId,
    storageId,
    totalPages: batchResults.length * 600, // Estimate
  });
}

export const recoverFromLlamaParse = internalAction({
  args: {
    documentId: v.id("documents"),
    jobId: v.id("processingJobs"),
    llamaParseJobIds: v.array(v.string()),
  },
  handler: async () => {},
});

export const triggerRecovery = internalAction({
  args: {
    documentId: v.id("documents"),
    llamaParseJobIds: v.array(v.string()),
  },
  handler: async () => ({ success: false, jobId: "" }),
});

export const handleWebhook = internalAction({
  args: {
    externalJobId: v.string(),
    status: v.string(),
    resultUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async () => {},
});
