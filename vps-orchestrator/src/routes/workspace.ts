import { Hono } from "hono";
import { validateAgentId } from "../config";
import { scanWorkspaceForTasks, archiveTaskFile, scanWorkspaceForMemory } from "../services/filesystem";

const app = new Hono();

// Scan agent workspace for task-related files
app.get("/instances/:id/workspace/tasks", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    const files = await scanWorkspaceForTasks(id);
    return c.json({ agentId: id, files, count: files.length });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to scan workspace" },
      500,
    );
  }
});

// Delete a processed task file from agent workspace
app.delete("/instances/:id/workspace/tasks", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  const body = await c.req.json<{ path: string }>();
  if (!body.path || typeof body.path !== "string") {
    return c.json({ error: "Missing path field" }, 400);
  }

  // Basic path validation
  if (body.path.includes("..") || body.path.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  try {
    await archiveTaskFile(id, body.path);
    return c.json({ success: true, deleted: body.path });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete file" },
      500,
    );
  }
});

// List memory files from agent workspace
app.get("/instances/:id/workspace/memory", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    const files = await scanWorkspaceForMemory(id);
    return c.json({ agentId: id, files, count: files.length });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to scan memory" },
      500,
    );
  }
});

export default app;
