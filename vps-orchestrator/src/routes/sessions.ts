import { Hono } from "hono";
import { listAgentSessions, readSession } from "../services/filesystem";
import { CONFIG, validateAgentId } from "../config";
import type { GatewayMessageRequest } from "../types";

const app = new Hono();

const MAX_MESSAGE_SIZE = 64_000; // 64KB
const SESSION_ID_RE = /^[\w:.@_-]{1,255}$/;

// List sessions for an agent
app.get("/instances/:id/sessions", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

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
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  const decoded = decodeURIComponent(sessionId);
  if (!SESSION_ID_RE.test(decoded)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  try {
    const messages = await readSession(decoded);
    return c.json({ sessionId: decoded, agentId: id, messages });
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
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  const body = await c.req.json<GatewayMessageRequest>();

  if (!body.message || typeof body.message !== "string") {
    return c.json({ error: "Missing message field" }, 400);
  }

  if (body.message.length > MAX_MESSAGE_SIZE) {
    return c.json({ error: "Message exceeds 64KB limit" }, 413);
  }

  const sessionId = body.sessionId || `agent:${id}:main`;
  if (!SESSION_ID_RE.test(sessionId)) {
    return c.json({ error: "Invalid session ID format" }, 400);
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
