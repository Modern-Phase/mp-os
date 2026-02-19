// vps-orchestrator/src/services/webhook-sender.ts
// HTTP client that POSTs agent responses back to Convex via HMAC-signed webhooks

import { CONFIG } from "../config";

export interface WebhookPayload {
  agentId: string;
  orgId: string;
  messageId: string;
  content: string;
  state: "delta" | "final" | "error";
  runId: string;
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

/**
 * Compute HMAC-SHA256 signature for webhook payload.
 * Format: t=<timestamp>,s=<hex-signature>
 */
async function sign(timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CONFIG.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${timestamp}.${body}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},s=${hex}`;
}

/**
 * POST a webhook payload to Convex with HMAC signing and retry.
 */
export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  if (!CONFIG.convexSiteUrl) {
    console.warn("[webhook] CONVEX_SITE_URL not configured, skipping webhook");
    return;
  }

  const url = `${CONFIG.convexSiteUrl}/webhooks/agent-response`;
  const body = JSON.stringify(payload);

  let signature = "";
  if (CONFIG.webhookSecret) {
    signature = await sign(Date.now(), body);
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signature && { "X-Webhook-Signature": signature }),
        },
        body,
      });

      if (response.ok) {
        return;
      }

      const text = await response.text();
      console.error(
        `[webhook] POST ${url} returned ${response.status}: ${text} (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );

      // Don't retry on 4xx (client errors)
      if (response.status >= 400 && response.status < 500) {
        return;
      }
    } catch (err) {
      console.error(
        `[webhook] POST ${url} failed (attempt ${attempt + 1}/${MAX_RETRIES}):`,
        err,
      );
    }

    // Exponential backoff before retry
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_MS * Math.pow(2, attempt)),
      );
    }
  }

  console.error(`[webhook] Exhausted ${MAX_RETRIES} retries for ${payload.state} event runId=${payload.runId}`);
}
