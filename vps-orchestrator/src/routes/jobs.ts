// vps-orchestrator/src/routes/jobs.ts
// POST /api/jobs — accept a job from Convex and run it asynchronously

import { Hono } from "hono";
import { runJob, type JobParams } from "../services/job-runner";

const app = new Hono();

// Accept a new job and kick off async execution
app.post("/jobs", async (c) => {
  const body = await c.req.json<JobParams>();

  if (!body.jobId || !body.repoFullName || !body.githubToken || !body.prompt) {
    return c.json(
      { error: "Missing required fields: jobId, repoFullName, githubToken, prompt" },
      400,
    );
  }

  const sessionId = `job:${body.jobId}`;

  // Fire and forget — don't block the response
  runJob(body).catch((err) => {
    console.error(`[jobs] Unhandled error in runJob ${body.jobId}:`, err);
  });

  return c.json({ success: true, sessionId }, 202);
});

export default app;
