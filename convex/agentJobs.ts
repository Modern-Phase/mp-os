// convex/agentJobs.ts — Autonomous GitHub issue resolution via AI agent jobs

import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "./utils/auth";
import { getGitHubToken, githubFetch } from "./github";
import {
  agentJobStatusValidator,
  agentJobTriggerModeValidator,
  AGENT_JOB_STATUSES,
} from "./schema";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY, OPEN_ROUTER } from "./env";

// Terminal statuses — jobs in these states are considered "done"
const TERMINAL_STATUSES = new Set([
  AGENT_JOB_STATUSES.MERGED,
  AGENT_JOB_STATUSES.CLOSED,
  AGENT_JOB_STATUSES.FAILED,
  AGENT_JOB_STATUSES.NEEDS_HUMAN,
]);

// ─── Queries ───────────────────────────────────────────────────

export const getJobs = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(agentJobStatusValidator),
    repoFullName: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let q;
    if (args.status) {
      q = ctx.db
        .query("agentJobs")
        .withIndex("orgId_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", args.status!),
        );
    } else {
      q = ctx.db
        .query("agentJobs")
        .withIndex("orgId", (q) => q.eq("orgId", args.orgId));
    }

    let jobs = await q.order("desc").collect();

    if (args.repoFullName) {
      jobs = jobs.filter((j) => j.repoFullName === args.repoFullName);
    }

    return jobs;
  },
});

export const getJob = query({
  args: { jobId: v.id("agentJobs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db.get(args.jobId);
  },
});

export const getJobForIssue = query({
  args: {
    repoFullName: v.string(),
    githubIssueNumber: v.number(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("repoFullName_githubIssueNumber", (q) =>
        q
          .eq("repoFullName", args.repoFullName)
          .eq("githubIssueNumber", args.githubIssueNumber),
      )
      .collect();

    // Return most recent non-terminal job, or most recent terminal job
    const activeJob = jobs.find((j) => !TERMINAL_STATUSES.has(j.status as any));
    if (activeJob) return activeJob;
    return jobs.length > 0 ? jobs[jobs.length - 1] : null;
  },
});

// Internal query for use by actions
export const getJobInternal = internalQuery({
  args: { jobId: v.id("agentJobs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return ctx.db.get(args.jobId);
  },
});

// ─── Mutations ─────────────────────────────────────────────────

export const enqueueJob = mutation({
  args: {
    orgId: v.id("organizations"),
    ticketId: v.optional(v.id("tickets")),
    githubIssueUrl: v.string(),
    githubIssueNumber: v.number(),
    githubIssueTitle: v.string(),
    githubIssueBody: v.optional(v.string()),
    repoFullName: v.string(),
    defaultBranch: v.string(),
    triggerMode: agentJobTriggerModeValidator,
  },
  returns: v.id("agentJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Duplicate prevention: check for active jobs on the same issue
    const existing = await ctx.db
      .query("agentJobs")
      .withIndex("repoFullName_githubIssueNumber", (q) =>
        q
          .eq("repoFullName", args.repoFullName)
          .eq("githubIssueNumber", args.githubIssueNumber),
      )
      .collect();

    const activeJob = existing.find(
      (j) => !TERMINAL_STATUSES.has(j.status as any),
    );
    if (activeJob) {
      throw new Error(
        `An active job already exists for issue #${args.githubIssueNumber} (status: ${activeJob.status})`,
      );
    }

    const branch = `agent/issue-${args.githubIssueNumber}`;

    const jobId = await ctx.db.insert("agentJobs", {
      orgId: args.orgId,
      ticketId: args.ticketId,
      githubIssueUrl: args.githubIssueUrl,
      githubIssueNumber: args.githubIssueNumber,
      githubIssueTitle: args.githubIssueTitle,
      githubIssueBody: args.githubIssueBody,
      repoFullName: args.repoFullName,
      defaultBranch: args.defaultBranch,
      branch,
      status: AGENT_JOB_STATUSES.QUEUED,
      attempts: 0,
      maxAttempts: 5,
      triggerMode: args.triggerMode,
      triggeredBy: userId,
      logs: [
        {
          timestamp: Date.now(),
          level: "info" as const,
          message: `Job queued for issue #${args.githubIssueNumber}: ${args.githubIssueTitle}`,
        },
      ],
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    // Schedule immediate dispatch
    await ctx.scheduler.runAfter(
      0,
      internal.agentJobs.dispatchJob,
      { jobId, orgId: args.orgId },
    );

    return jobId;
  },
});

export const cancelJob = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (TERMINAL_STATUSES.has(job.status as any)) {
      throw new Error("Cannot cancel a job that is already in a terminal state");
    }

    const logs = job.logs || [];
    logs.push({
      timestamp: Date.now(),
      level: "info",
      message: "Job cancelled by user",
    });

    await ctx.db.patch(args.jobId, {
      status: AGENT_JOB_STATUSES.CLOSED,
      logs,
      completedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return null;
  },
});

export const retryJob = mutation({
  args: { jobId: v.id("agentJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    if (
      job.status !== AGENT_JOB_STATUSES.FAILED &&
      job.status !== AGENT_JOB_STATUSES.NEEDS_HUMAN
    ) {
      throw new Error("Can only retry failed or needs_human jobs");
    }

    const logs = job.logs || [];
    logs.push({
      timestamp: Date.now(),
      level: "info",
      message: "Job manually retried by user",
    });

    await ctx.db.patch(args.jobId, {
      status: AGENT_JOB_STATUSES.QUEUED,
      attempts: 0,
      logs,
      errorMessage: undefined,
      completedAt: undefined,
      lastActivityAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.agentJobs.dispatchJob,
      { jobId: args.jobId, orgId: job.orgId },
    );

    return null;
  },
});

// ─── Internal Mutations ────────────────────────────────────────

export const PREAUTH_updateJobStatus = internalMutation({
  args: {
    jobId: v.id("agentJobs"),
    status: agentJobStatusValidator,
    logMessage: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    sessionId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    tokenUsage: v.optional(
      v.object({
        inputTokens: v.number(),
        outputTokens: v.number(),
        totalCost: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const logs = job.logs || [];
    if (args.logMessage) {
      logs.push({
        timestamp: Date.now(),
        level: args.errorMessage ? "error" : "info",
        message: args.logMessage,
      });
    }

    const patch: Record<string, any> = {
      status: args.status,
      logs,
      lastActivityAt: Date.now(),
    };

    if (args.prUrl !== undefined) patch.prUrl = args.prUrl;
    if (args.prNumber !== undefined) patch.prNumber = args.prNumber;
    if (args.sessionId !== undefined) patch.sessionId = args.sessionId;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.tokenUsage !== undefined) patch.tokenUsage = args.tokenUsage;

    if (TERMINAL_STATUSES.has(args.status as any)) {
      patch.completedAt = Date.now();
    }

    await ctx.db.patch(args.jobId, patch);

    // Send notification on terminal states or PR creation
    if (
      TERMINAL_STATUSES.has(args.status as any) ||
      args.status === AGENT_JOB_STATUSES.PR_CREATED
    ) {
      const title =
        args.status === AGENT_JOB_STATUSES.PR_CREATED
          ? `PR opened for #${job.githubIssueNumber}`
          : args.status === AGENT_JOB_STATUSES.MERGED
            ? `PR merged for #${job.githubIssueNumber}`
            : args.status === AGENT_JOB_STATUSES.NEEDS_HUMAN
              ? `Agent needs help with #${job.githubIssueNumber}`
              : args.status === AGENT_JOB_STATUSES.FAILED
                ? `Agent job failed for #${job.githubIssueNumber}`
                : `Agent job ${args.status} for #${job.githubIssueNumber}`;

      const body =
        args.status === AGENT_JOB_STATUSES.PR_CREATED
          ? `${job.githubIssueTitle} — PR ready for review`
          : args.errorMessage || job.githubIssueTitle;

      await ctx.scheduler.runAfter(
        0,
        internal.notifications.INTERNAL_createNotification,
        {
          userId: job.triggeredBy,
          orgId: job.orgId,
          type: "agent_job" as any,
          title,
          body,
          resourceType: "agent_job" as any,
          resourceId: args.jobId,
        },
      );
    }
  },
});

export const receiveJobWebhook = internalMutation({
  args: {
    jobId: v.id("agentJobs"),
    status: agentJobStatusValidator,
    message: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    tokenUsage: v.optional(
      v.object({
        inputTokens: v.number(),
        outputTokens: v.number(),
        totalCost: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    // Handle test failure retry logic
    if (
      args.status === AGENT_JOB_STATUSES.FAILED &&
      args.errorMessage?.startsWith("tests_failed:")
    ) {
      const newAttempts = job.attempts + 1;
      if (newAttempts < job.maxAttempts) {
        // Retry — increment attempts and re-dispatch
        const logs = job.logs || [];
        logs.push({
          timestamp: Date.now(),
          level: "warn",
          message: `Test failure (attempt ${newAttempts}/${job.maxAttempts}): ${args.errorMessage}`,
        });

        await ctx.db.patch(args.jobId, {
          status: AGENT_JOB_STATUSES.TESTING,
          attempts: newAttempts,
          logs,
          lastActivityAt: Date.now(),
        });

        await ctx.scheduler.runAfter(
          0,
          internal.agentJobs.dispatchRetry,
          { jobId: args.jobId, orgId: job.orgId, attempt: newAttempts },
        );
        return;
      }

      // Exhausted retries — needs human
      const logs = job.logs || [];
      logs.push({
        timestamp: Date.now(),
        level: "error",
        message: `Tests failed after ${newAttempts} attempts. Needs human intervention.`,
      });

      await ctx.db.patch(args.jobId, {
        status: AGENT_JOB_STATUSES.NEEDS_HUMAN,
        attempts: newAttempts,
        logs,
        errorMessage: args.errorMessage,
        completedAt: Date.now(),
        lastActivityAt: Date.now(),
      });

      await ctx.scheduler.runAfter(
        0,
        internal.notifications.INTERNAL_createNotification,
        {
          userId: job.triggeredBy,
          orgId: job.orgId,
          type: "agent_job" as any,
          title: `Agent needs help with #${job.githubIssueNumber}`,
          body: `Tests failed after ${newAttempts} attempts for: ${job.githubIssueTitle}`,
          resourceType: "agent_job" as any,
          resourceId: args.jobId,
        },
      );
      return;
    }

    // Normal status update
    await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
      jobId: args.jobId,
      status: args.status,
      logMessage: args.message,
      prUrl: args.prUrl,
      prNumber: args.prNumber,
      errorMessage: args.errorMessage,
      tokenUsage: args.tokenUsage,
    });
  },
});

export const handlePRReviewRequested = internalMutation({
  args: {
    repoFullName: v.string(),
    prNumber: v.number(),
    reviewBody: v.string(),
    reviewerLogin: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the job associated with this PR
    const jobs = await ctx.db.query("agentJobs").collect();
    const job = jobs.find(
      (j) =>
        j.repoFullName === args.repoFullName &&
        j.prNumber === args.prNumber &&
        !TERMINAL_STATUSES.has(j.status as any),
    );
    if (!job) return;

    const logs = job.logs || [];
    logs.push({
      timestamp: Date.now(),
      level: "info",
      message: `PR review from @${args.reviewerLogin}: changes requested`,
    });

    await ctx.db.patch(job._id, {
      status: AGENT_JOB_STATUSES.REVISION,
      logs,
      lastActivityAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.agentJobs.dispatchRevision,
      {
        jobId: job._id,
        orgId: job.orgId,
        reviewComments: args.reviewBody,
      },
    );
  },
});

export const handlePRMerged = internalMutation({
  args: {
    repoFullName: v.string(),
    prNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db.query("agentJobs").collect();
    const job = jobs.find(
      (j) =>
        j.repoFullName === args.repoFullName &&
        j.prNumber === args.prNumber &&
        !TERMINAL_STATUSES.has(j.status as any),
    );
    if (!job) return;

    const logs = job.logs || [];
    logs.push({
      timestamp: Date.now(),
      level: "info",
      message: "PR merged successfully",
    });

    await ctx.db.patch(job._id, {
      status: AGENT_JOB_STATUSES.MERGED,
      logs,
      completedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.INTERNAL_createNotification,
      {
        userId: job.triggeredBy,
        orgId: job.orgId,
        type: "agent_job" as any,
        title: `PR merged for #${job.githubIssueNumber}`,
        body: job.githubIssueTitle,
        resourceType: "agent_job" as any,
        resourceId: job._id,
      },
    );
  },
});

export const handleAutoTrigger = internalMutation({
  args: {
    repoFullName: v.string(),
    issueNumber: v.number(),
    issueTitle: v.string(),
    issueBody: v.optional(v.string()),
    issueUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Find repo → project → check autoAssignAgent flag
    const repo = await ctx.db
      .query("githubRepos")
      .filter((q) => q.eq(q.field("repoFullName"), args.repoFullName))
      .first();
    if (!repo || !repo.linkedProjectId) return;

    const project = await ctx.db.get(repo.linkedProjectId);
    if (!project || !project.autoAssignAgent) return;

    // Check for existing active jobs on this issue
    const existing = await ctx.db
      .query("agentJobs")
      .withIndex("repoFullName_githubIssueNumber", (q) =>
        q
          .eq("repoFullName", args.repoFullName)
          .eq("githubIssueNumber", args.issueNumber),
      )
      .collect();
    const activeJob = existing.find(
      (j) => !TERMINAL_STATUSES.has(j.status as any),
    );
    if (activeJob) return;

    // Find a user to attribute (project creator)
    const triggeredBy = project.createdBy;
    const branch = `agent/issue-${args.issueNumber}`;

    const jobId = await ctx.db.insert("agentJobs", {
      orgId: project.orgId,
      githubIssueUrl: args.issueUrl,
      githubIssueNumber: args.issueNumber,
      githubIssueTitle: args.issueTitle,
      githubIssueBody: args.issueBody,
      repoFullName: args.repoFullName,
      defaultBranch: repo.defaultBranch,
      branch,
      status: AGENT_JOB_STATUSES.QUEUED,
      attempts: 0,
      maxAttempts: 5,
      triggerMode: "auto",
      triggeredBy,
      logs: [
        {
          timestamp: Date.now(),
          level: "info",
          message: `Auto-triggered job for issue #${args.issueNumber}: ${args.issueTitle}`,
        },
      ],
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.agentJobs.dispatchJob,
      { jobId, orgId: project.orgId },
    );
  },
});

// ─── Internal Actions ──────────────────────────────────────────

export const dispatchJob = internalAction({
  args: {
    jobId: v.id("agentJobs"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.agentJobs.getJobInternal, {
      jobId: args.jobId,
    });
    if (!job) return;

    try {
      const token = await getGitHubToken(ctx, args.orgId as string);

      // Fetch full issue body from GitHub if not stored
      let issueBody = job.githubIssueBody || "";
      if (!issueBody) {
        try {
          const [owner, repo] = job.repoFullName.split("/");
          const issue = await githubFetch(
            token,
            `/repos/${owner}/${repo}/issues/${job.githubIssueNumber}`,
          );
          issueBody = issue.body || "";
        } catch {
          // Non-fatal — proceed without body
        }
      }

      const prompt = buildJobPrompt(job, issueBody);

      if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
        throw new Error("VPS_ORCHESTRATOR_URL or VPS_API_KEY not configured");
      }

      const response = await fetch(`${VPS_ORCHESTRATOR_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": VPS_API_KEY,
        },
        body: JSON.stringify({
          jobId: args.jobId,
          orgId: args.orgId,
          repoFullName: job.repoFullName,
          branch: job.branch,
          defaultBranch: job.defaultBranch,
          githubToken: token,
          openRouterKey: OPEN_ROUTER || "",
          prompt,
          issueNumber: job.githubIssueNumber,
          issueTitle: job.githubIssueTitle,
          maxAttempts: job.maxAttempts,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Orchestrator returned ${response.status}: ${text}`);
      }

      const result = await response.json();

      await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
        jobId: args.jobId,
        status: AGENT_JOB_STATUSES.CLONING,
        logMessage: "Job dispatched to orchestrator",
        sessionId: result.sessionId,
      });
    } catch (error) {
      await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
        jobId: args.jobId,
        status: AGENT_JOB_STATUSES.FAILED,
        logMessage: `Dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

export const dispatchRevision = internalAction({
  args: {
    jobId: v.id("agentJobs"),
    orgId: v.id("organizations"),
    reviewComments: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.agentJobs.getJobInternal, {
      jobId: args.jobId,
    });
    if (!job) return;

    try {
      const token = await getGitHubToken(ctx, args.orgId as string);

      if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
        throw new Error("VPS_ORCHESTRATOR_URL or VPS_API_KEY not configured");
      }

      const prompt = buildRevisionPrompt(job, args.reviewComments);

      const response = await fetch(`${VPS_ORCHESTRATOR_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": VPS_API_KEY,
        },
        body: JSON.stringify({
          jobId: args.jobId,
          orgId: args.orgId,
          repoFullName: job.repoFullName,
          branch: job.branch,
          defaultBranch: job.defaultBranch,
          githubToken: token,
          openRouterKey: OPEN_ROUTER || "",
          prompt,
          issueNumber: job.githubIssueNumber,
          issueTitle: job.githubIssueTitle,
          maxAttempts: job.maxAttempts,
          isRevision: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Orchestrator returned ${response.status}: ${text}`);
      }

      await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
        jobId: args.jobId,
        status: AGENT_JOB_STATUSES.WORKING,
        logMessage: "Revision dispatched — addressing PR review feedback",
      });
    } catch (error) {
      await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
        jobId: args.jobId,
        status: AGENT_JOB_STATUSES.FAILED,
        logMessage: `Revision dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

export const dispatchRetry = internalAction({
  args: {
    jobId: v.id("agentJobs"),
    orgId: v.id("organizations"),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.agentJobs.getJobInternal, {
      jobId: args.jobId,
    });
    if (!job) return;

    try {
      const token = await getGitHubToken(ctx, args.orgId as string);

      if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
        throw new Error("VPS_ORCHESTRATOR_URL or VPS_API_KEY not configured");
      }

      const prompt = buildRetryPrompt(job, args.attempt);

      const response = await fetch(`${VPS_ORCHESTRATOR_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": VPS_API_KEY,
        },
        body: JSON.stringify({
          jobId: args.jobId,
          orgId: args.orgId,
          repoFullName: job.repoFullName,
          branch: job.branch,
          defaultBranch: job.defaultBranch,
          githubToken: token,
          openRouterKey: OPEN_ROUTER || "",
          prompt,
          issueNumber: job.githubIssueNumber,
          issueTitle: job.githubIssueTitle,
          maxAttempts: job.maxAttempts,
          isRetry: true,
          attempt: args.attempt,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Orchestrator returned ${response.status}: ${text}`);
      }

      await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
        jobId: args.jobId,
        status: AGENT_JOB_STATUSES.WORKING,
        logMessage: `Retry attempt ${args.attempt}/${job.maxAttempts} dispatched — fixing test failures`,
      });
    } catch (error) {
      await ctx.runMutation(internal.agentJobs.PREAUTH_updateJobStatus, {
        jobId: args.jobId,
        status: AGENT_JOB_STATUSES.FAILED,
        logMessage: `Retry dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },
});

// ─── Prompt Builders ───────────────────────────────────────────

function buildJobPrompt(job: any, issueBody: string): string {
  return `You are an autonomous software engineering agent. Your task is to resolve a GitHub issue by reading the codebase, implementing changes, running tests, and creating a pull request.

## Issue
**Repository:** ${job.repoFullName}
**Issue #${job.githubIssueNumber}:** ${job.githubIssueTitle}
**Branch:** ${job.branch} (from ${job.defaultBranch})

${issueBody ? `### Issue Description\n${issueBody}` : ""}

## Instructions

1. **Read the codebase** — Understand the project structure, conventions, and relevant files. Look for CLAUDE.md, README.md, or similar docs.
2. **Plan your approach** — Think about what changes are needed and where.
3. **Implement the changes** — Write clean, production-quality code that follows existing patterns.
4. **Run tests** — Execute the test suite. If tests exist (\`npm test\`, \`bun test\`, \`make test\`, etc.), run them.
5. **Fix any test failures** — If tests fail, read the errors carefully and fix your code.
6. **Commit your changes** — Use descriptive commit messages.
7. **Report your progress** — Use these status directives in your output:
   - \`<job_status>working</job_status>\` — when you start implementing
   - \`<job_status>testing</job_status>\` — when running tests
   - \`<job_status>done</job_status>\` — when implementation is complete and tests pass

## Rules
- Do NOT push or create PRs — the orchestrator handles that.
- Stay focused on the issue — don't refactor unrelated code.
- If you cannot resolve the issue, output \`<job_status>failed: [reason]</job_status>\`.
- Keep all changes on the \`${job.branch}\` branch.`;
}

function buildRevisionPrompt(job: any, reviewComments: string): string {
  return `You are an autonomous software engineering agent. A PR reviewer has requested changes on your pull request. Address their feedback.

## Context
**Repository:** ${job.repoFullName}
**Issue #${job.githubIssueNumber}:** ${job.githubIssueTitle}
**Branch:** ${job.branch}
**PR #${job.prNumber}**

## Review Comments
${reviewComments}

## Instructions
1. Read the review comments carefully.
2. Make the requested changes.
3. Run tests to ensure nothing is broken.
4. Commit with a descriptive message referencing the review.
5. Report status via \`<job_status>done</job_status>\` when complete.

## Rules
- Do NOT push — the orchestrator handles that.
- Only address the requested changes — don't refactor beyond scope.
- If you cannot address the feedback, output \`<job_status>failed: [reason]</job_status>\`.`;
}

function buildRetryPrompt(job: any, attempt: number): string {
  return `You are an autonomous software engineering agent. Tests failed on your previous attempt. Fix the failures.

## Context
**Repository:** ${job.repoFullName}
**Issue #${job.githubIssueNumber}:** ${job.githubIssueTitle}
**Branch:** ${job.branch}
**Attempt:** ${attempt}/${job.maxAttempts}

## Instructions
1. Run the test suite to see the current failures.
2. Read the error output carefully.
3. Fix the code to make tests pass.
4. Re-run tests to confirm the fix.
5. Commit with a message like "fix: resolve test failures (attempt ${attempt})".
6. Report status via \`<job_status>done</job_status>\` when tests pass.

## Rules
- Do NOT push — the orchestrator handles that.
- Focus only on fixing test failures.
- If tests still fail after your fixes, output \`<job_status>failed: tests_failed: [error summary]</job_status>\`.`;
}
