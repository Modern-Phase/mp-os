// vps-orchestrator/src/services/gateway-ws.ts
// Persistent WebSocket client to OpenClaw Gateway (v3 JSON protocol)

import { readFileSync } from "fs";
import { createPrivateKey, createPublicKey, sign as cryptoSign } from "crypto";
import { CONFIG } from "../config";
import { sendWebhook, type WebhookPayload } from "./webhook-sender";

// Device identity for gateway auth
interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

let deviceIdentity: DeviceIdentity | null = null;

function loadDeviceIdentity(): DeviceIdentity | null {
  try {
    const raw = readFileSync(CONFIG.deviceIdentityPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && parsed.deviceId && parsed.publicKeyPem && parsed.privateKeyPem) {
      console.log(`[gateway-ws] Loaded device identity: ${parsed.deviceId.slice(0, 12)}...`);
      return parsed;
    }
  } catch (err) {
    console.warn("[gateway-ws] Could not load device identity:", err);
  }
  return null;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" });
  // Ed25519 SPKI = 12-byte prefix + 32-byte raw key
  return Buffer.from(spki).subarray(12);
}

function buildAndSignDeviceAuth(token: string): {
  device: { id: string; publicKey: string; signature: string; signedAt: number };
  scopes: string[];
} | null {
  if (!deviceIdentity) return null;

  const signedAtMs = Date.now();
  const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];

  // Build payload: v1|deviceId|clientId|clientMode|role|scopes|signedAtMs|token
  const payload = [
    "v1",
    deviceIdentity.deviceId,
    "gateway-client",
    "backend",
    "operator",
    scopes.join(","),
    String(signedAtMs),
    token || "",
  ].join("|");

  const key = createPrivateKey(deviceIdentity.privateKeyPem);
  const signature = base64UrlEncode(
    cryptoSign(null, Buffer.from(payload, "utf8"), key),
  );
  const publicKey = base64UrlEncode(derivePublicKeyRaw(deviceIdentity.publicKeyPem));

  return {
    device: {
      id: deviceIdentity.deviceId,
      publicKey,
      signature,
      signedAt: signedAtMs,
    },
    scopes,
  };
}

export interface CallbackInfo {
  agentId: string;
  orgId: string;
  messageId: string;
}

interface PendingRequest {
  resolve: (runId: string) => void;
  reject: (error: Error) => void;
  callbackInfo: CallbackInfo;
  timer: ReturnType<typeof setTimeout>;
}

interface DeltaBuffer {
  content: string;
  callbackInfo: CallbackInfo;
  timer: ReturnType<typeof setTimeout> | null;
}

let ws: WebSocket | null = null;
let requestId = 0;
let reconnectDelay = 1000;
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let handshakeComplete = false;
let handshakeRequestId = "";

const MAX_RECONNECT_DELAY = 30_000;
const REQUEST_TIMEOUT = 30_000;
const KEEPALIVE_INTERVAL = 15_000;
const DELTA_FLUSH_MS = 200;

// Maps request IDs to pending acks
const pendingRequests = new Map<string, PendingRequest>();
// Maps runIds to callback info for routing events
const runCallbacks = new Map<string, CallbackInfo>();
// Delta buffers for batching streaming content
const deltaBuffers = new Map<string, DeltaBuffer>();

export function getStatus(): {
  connected: boolean;
  handshake: boolean;
  pendingRequests: number;
  activeRuns: number;
} {
  return {
    connected: ws?.readyState === WebSocket.OPEN,
    handshake: handshakeComplete,
    pendingRequests: pendingRequests.size,
    activeRuns: runCallbacks.size,
  };
}

export function connect(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  intentionalClose = false;
  handshakeComplete = false;

  // Load device identity on first connect
  if (!deviceIdentity) {
    deviceIdentity = loadDeviceIdentity();
  }

  const url = `ws://127.0.0.1:${CONFIG.gatewayPort}/ws`;
  console.log(`[gateway-ws] Connecting to ${url}`);

  try {
    ws = new WebSocket(url);
  } catch (err) {
    console.error("[gateway-ws] Failed to create WebSocket:", err);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    console.log("[gateway-ws] TCP connected, sending handshake...");

    const token = CONFIG.gatewayToken || "";
    const deviceAuth = buildAndSignDeviceAuth(token);

    // Send the required "connect" handshake frame (OpenClaw protocol v3)
    const connectFrame: any = {
      type: "req",
      id: String(++requestId),
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "gateway-client",
          displayName: "MP-OS Orchestrator",
          version: "1.0.0",
          platform: "linux",
          mode: "backend",
        },
        role: "operator",
        ...(token && { auth: { token } }),
        ...(deviceAuth && {
          device: deviceAuth.device,
          scopes: deviceAuth.scopes,
        }),
      },
    };

    handshakeRequestId = connectFrame.id;
    ws!.send(JSON.stringify(connectFrame));
  });

  ws.addEventListener("message", (event) => {
    try {
      const frame = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      handleFrame(frame);
    } catch (err) {
      console.error("[gateway-ws] Failed to parse message:", err);
    }
  });

  ws.addEventListener("close", (event) => {
    console.log(`[gateway-ws] Connection closed: code=${event.code} reason=${event.reason}`);
    cleanup();
    if (!intentionalClose) {
      scheduleReconnect();
    }
  });

  ws.addEventListener("error", (event) => {
    console.error("[gateway-ws] WebSocket error:", event);
  });
}

export function disconnect(): void {
  intentionalClose = true;
  cleanup();
  if (ws) {
    ws.close(1000, "Orchestrator shutting down");
    ws = null;
  }
}

/**
 * Send a chat message to an agent via the Gateway WS.
 * Returns the runId once the gateway acknowledges.
 */
export function sendMessage(
  agentId: string,
  sessionKey: string,
  content: string,
  callbackInfo: CallbackInfo,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !handshakeComplete) {
      reject(new Error("Gateway WebSocket not connected or handshake incomplete"));
      return;
    }

    const id = String(++requestId);
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Gateway request ${id} timed out after ${REQUEST_TIMEOUT}ms`));
    }, REQUEST_TIMEOUT);

    pendingRequests.set(id, { resolve, reject, callbackInfo, timer });

    const idempotencyKey = `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const frame = {
      type: "req",
      id,
      method: "chat.send",
      params: {
        sessionKey,
        message: content,
        idempotencyKey,
      },
    };

    ws.send(JSON.stringify(frame));
    console.log(`[gateway-ws] Sent chat.send id=${id} session=${sessionKey} (${content.length} chars)`);
  });
}

function handleFrame(frame: any): void {
  switch (frame.type) {
    case "res":
      handleResponse(frame);
      break;
    case "event":
      handleEvent(frame);
      break;
    case "tick":
    case "pong":
      // Keepalive ack — ignore
      break;
    default:
      // Ignore unknown frames silently (e.g. tick responses)
      break;
  }
}

function handleResponse(frame: { id: string | number; result?: any; payload?: any; error?: any; ok?: boolean }): void {
  // Handle handshake response
  if (String(frame.id) === handshakeRequestId) {
    if (frame.ok === false || frame.error) {
      const errMsg = frame.error?.message || JSON.stringify(frame.error);
      console.error(`[gateway-ws] Handshake rejected: ${errMsg}`);
      ws?.close(1000, "Handshake rejected");
      return;
    }

    handshakeComplete = true;
    reconnectDelay = 1000; // Reset backoff on successful handshake
    console.log("[gateway-ws] Handshake complete — connected to gateway");

    // Start keepalive now that handshake succeeded
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    keepaliveTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "req", id: String(++requestId), method: "ping" }));
      }
    }, KEEPALIVE_INTERVAL);
    return;
  }

  const pending = pendingRequests.get(String(frame.id));
  if (!pending) {
    // Silently ignore tick/pong responses and other non-tracked frames
    return;
  }

  clearTimeout(pending.timer);
  pendingRequests.delete(String(frame.id));

  if (frame.ok === false || frame.error) {
    pending.reject(new Error(frame.error?.message || JSON.stringify(frame.error)));
    return;
  }

  // Extract runId from whichever field the gateway uses
  const data = frame.payload || frame.result || frame;
  const runId = data?.runId || data?.id || data?.run_id || data?.conversationId || data?.taskId;

  if (!runId) {
    // Log full frame for debugging and pass it through in the error
    const frameStr = JSON.stringify(frame);
    console.error(`[gateway-ws] Response missing runId. Full frame: ${frameStr}`);
    pending.reject(new Error(`Gateway response missing runId. Frame: ${frameStr}`));
    return;
  }

  // Register this runId for event routing
  runCallbacks.set(runId, pending.callbackInfo);
  console.log(`[gateway-ws] Registered runId=${runId} for agent=${pending.callbackInfo.agentId}`);

  pending.resolve(runId);
}

function handleEvent(frame: { event: string; data?: any; payload?: any }): void {
  if (frame.event !== "chat") return;

  // Gateway uses "payload" (not "data") for event payloads
  const eventData = frame.payload || frame.data || {};
  const { runId, state, message, errorMessage } = eventData;
  if (!runId) return;

  const callbackInfo = runCallbacks.get(runId);
  if (!callbackInfo) {
    // Ignore events for unknown runIds (e.g. from other sessions)
    return;
  }

  // Extract text content from message
  // Gateway format: { role: "assistant", content: [{ type: "text", text: "..." }] }
  const textContent = extractTextContent(message);

  switch (state) {
    case "delta":
      console.log(`[gateway-ws] Chat delta runId=${runId} (${textContent.length} chars)`);
      bufferDelta(runId, textContent, callbackInfo);
      break;

    case "final":
      console.log(`[gateway-ws] Chat final runId=${runId}: "${textContent.slice(0, 80)}"`);
      // Flush any remaining delta buffer first
      flushDelta(runId);
      // Clean up the run
      runCallbacks.delete(runId);
      // Send final webhook
      sendWebhook({
        agentId: callbackInfo.agentId,
        orgId: callbackInfo.orgId,
        messageId: callbackInfo.messageId,
        content: textContent,
        state: "final",
        runId,
      }).catch((err) =>
        console.error(`[gateway-ws] Failed to send final webhook for runId=${runId}:`, err),
      );
      break;

    case "aborted":
      flushDelta(runId);
      runCallbacks.delete(runId);
      sendWebhook({
        agentId: callbackInfo.agentId,
        orgId: callbackInfo.orgId,
        messageId: callbackInfo.messageId,
        content: errorMessage || "Agent run aborted",
        state: "error",
        runId,
      }).catch((err) =>
        console.error(`[gateway-ws] Failed to send aborted webhook for runId=${runId}:`, err),
      );
      break;

    case "error":
      // Flush any remaining delta buffer
      flushDelta(runId);
      runCallbacks.delete(runId);
      sendWebhook({
        agentId: callbackInfo.agentId,
        orgId: callbackInfo.orgId,
        messageId: callbackInfo.messageId,
        content: errorMessage || "Unknown agent error",
        state: "error",
        runId,
      }).catch((err) =>
        console.error(`[gateway-ws] Failed to send error webhook for runId=${runId}:`, err),
      );
      break;
  }
}

/**
 * Extract plain text from gateway message format.
 * Handles: string, { content: string }, { text: string },
 * and { content: [{ type: "text", text: "..." }] } (OpenClaw format)
 */
function extractTextContent(message: any): string {
  if (!message) return "";
  if (typeof message === "string") return message;
  // OpenClaw format: { role, content: [{ type: "text", text: "..." }] }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((part: any) => part.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text)
      .join("");
  }
  if (typeof message.content === "string") return message.content;
  if (typeof message.text === "string") return message.text;
  return "";
}

function bufferDelta(runId: string, content: string, callbackInfo: CallbackInfo): void {
  const existing = deltaBuffers.get(runId);
  if (existing) {
    existing.content += content;
    return; // Timer already running
  }

  const buffer: DeltaBuffer = {
    content,
    callbackInfo,
    timer: null,
  };

  buffer.timer = setTimeout(() => flushDelta(runId), DELTA_FLUSH_MS);
  deltaBuffers.set(runId, buffer);
}

function flushDelta(runId: string): void {
  const buffer = deltaBuffers.get(runId);
  if (!buffer) return;

  if (buffer.timer) clearTimeout(buffer.timer);
  deltaBuffers.delete(runId);

  if (!buffer.content) return;

  sendWebhook({
    agentId: buffer.callbackInfo.agentId,
    orgId: buffer.callbackInfo.orgId,
    messageId: buffer.callbackInfo.messageId,
    content: buffer.content,
    state: "delta",
    runId,
  }).catch((err) =>
    console.error(`[gateway-ws] Failed to send delta webhook for runId=${runId}:`, err),
  );
}

function cleanup(): void {
  handshakeComplete = false;

  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }

  // Reject all pending requests
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error("WebSocket connection lost"));
  }
  pendingRequests.clear();

  // Flush all delta buffers
  for (const runId of deltaBuffers.keys()) {
    flushDelta(runId);
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  console.log(`[gateway-ws] Reconnecting in ${reconnectDelay}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}
