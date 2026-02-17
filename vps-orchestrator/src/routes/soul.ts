import { Hono } from "hono";
import { readSoul, writeSoul } from "../services/filesystem";

const app = new Hono();

// Get SOUL.md
app.get("/instances/:id/soul", async (c) => {
  const { id } = c.req.param();

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
  const body = await c.req.json<{ content: string }>();

  if (typeof body.content !== "string") {
    return c.json({ error: "Missing content field" }, 400);
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
