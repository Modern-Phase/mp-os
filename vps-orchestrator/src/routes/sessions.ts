import { Hono } from "hono";
import { listAgentSessions, readSession } from "../services/filesystem";
import { validateAgentId } from "../config";
import { sendMessage, getStatus } from "../services/gateway-ws";
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

// Send message to agent via Gateway WebSocket
app.post("/instances/:id/message", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  const body = await c.req.json<GatewayMessageRequest & { messageId?: string; orgId?: string }>();

  if (!body.message || typeof body.message !== "string") {
    return c.json({ error: "Missing message field" }, 400);
  }

  if (body.message.length > MAX_MESSAGE_SIZE) {
    return c.json({ error: "Message exceeds 64KB limit" }, 413);
  }

  const sessionKey = body.sessionId || `agent:main:${id}`;
  if (!SESSION_ID_RE.test(sessionKey)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  // Check WS connection status
  const status = getStatus();
  if (!status.connected || !status.handshake) {
    return c.json(
      { error: "Gateway WebSocket not connected or handshake pending. Is the service running?" },
      503,
    );
  }

  try {
    const runId = await sendMessage(id, sessionKey, body.message, {
      agentId: id,
      orgId: body.orgId || "",
      messageId: body.messageId || "",
    });

    return c.json({
      success: true,
      status: "dispatched",
      sessionKey,
      runId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[sessions] Failed to send message to Gateway:`, msg);
    return c.json(
      {
        error: "Failed to send message to Gateway",
        details: msg,
      },
      502,
    );
  }
});

export default app;
