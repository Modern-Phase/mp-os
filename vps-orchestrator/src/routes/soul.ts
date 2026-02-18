import { Hono } from "hono";
import { readSoul, writeSoul } from "../services/filesystem";
import { validateAgentId } from "../config";

const app = new Hono();

const MAX_SOUL_SIZE = 1_000_000; // 1MB

// Get SOUL.md
app.get("/instances/:id/soul", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    const content = await readSoul(id);
    return c.json({ agentId: id, content });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to read SOUL.md" },
      500,
    );
  }
});

// Update SOUL.md
app.put("/instances/:id/soul", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  const body = await c.req.json<{ content: string }>();

  if (typeof body.content !== "string") {
    return c.json({ error: "Missing content field" }, 400);
  }

  if (body.content.length > MAX_SOUL_SIZE) {
    return c.json({ error: "SOUL.md content exceeds 1MB limit" }, 413);
  }

  try {
    await writeSoul(id, body.content);
    return c.json({ success: true, agentId: id });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to write SOUL.md" },
      500,
    );
  }
});

export default app;
