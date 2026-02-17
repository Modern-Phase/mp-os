import { Hono } from "hono";
import { listAgentSessions, readSession } from "../services/filesystem";
import { CONFIG } from "../config";
import type { GatewayMessageRequest } from "../types";

const app = new Hono();

// List sessions for an agent
app.get("/instances/:id/sessions", async (c) => {
  const { id } = c.req.param();

  try {
    const sessions = await listAgentSessions(id);
    return c.json(sessions);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list sessions",
      },
      500,
    );
  }
});

// Get session messages
app.get("/instances/:id/sessions/:sessionId", async (c) => {
  const { id, sessionId } = c.req.param();

  try {
    const messages = await readSession(decodeURIComponent(sessionId));
    return c.json({ sessionId, agentId: id, messages });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to read session",
      },
      500,
    );
  }
});

// Send message to agent via Gateway
app.post("/instances/:id/message", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<GatewayMessageRequest>();

  if (!body.message) {
    return c.json({ error: "Missing message field" }, 400);
  }

  // Check gateway is reachable
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    await fetch(`http://127.0.0.1:${CONFIG.gatewayPort}/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    return c.json(
      { error: "Gateway is not reachable. Is the service running?" },
      503,
    );
  }

  const sessionId = body.sessionId || `agent:${id}:main`;

  try {
    // Proxy message to OpenClaw Gateway
    const response = await fetch(
      `http://127.0.0.1:${CONFIG.gatewayPort}/api/message`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          content: body.message,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return c.json(
        { error: `Gateway returned ${response.status}: ${text}` },
        502,
      );
    }

    const result = await response.json();
    return c.json({
      success: true,
      sessionId,
      response: result,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to send message to Gateway",
        details: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }
});

export default app;
