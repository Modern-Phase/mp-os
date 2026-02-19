import { join, resolve } from "path";

export const CONFIG = {
  port: parseInt(process.env.ORCHESTRATOR_PORT || "18800"),
  apiKey: process.env.ORCHESTRATOR_API_KEY || "",
  // OpenClaw runs under a dedicated user
  openclawUser: process.env.OPENCLAW_USER || "openclaw",
  openclawHome: process.env.OPENCLAW_HOME || "/home/openclaw/.openclaw",
  // The workspace where agent SOUL.md files live
  workspaceDir:
    process.env.OPENCLAW_WORKSPACE || "/home/openclaw/.openclaw/workspace",
  // Single gateway service name
  serviceName: process.env.OPENCLAW_SERVICE || "openclaw",
  // Gateway port (single instance)
  gatewayPort: parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789"),
  // WebSocket bridge: webhook callback to Convex
  webhookSecret: process.env.WEBHOOK_SECRET || "",
  convexSiteUrl: process.env.CONVEX_SITE_URL || "",
  // Auth token for OpenClaw Gateway WS connection
  gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || "",
  // Device identity for gateway auth (Ed25519 keypair)
  deviceIdentityPath: process.env.OPENCLAW_DEVICE_IDENTITY || "/home/openclaw/.openclaw/identity/device.json",
} as const;

/** Validate agent ID: lowercase alphanumeric + hyphens, starts with a letter, max 64 chars */
const AGENT_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;

export function validateAgentId(id: string): boolean {
  return AGENT_ID_RE.test(id);
}

/** Safe path builder that validates the agent ID and ensures no traversal */
export function getAgentDir(agentId: string): string {
  if (!validateAgentId(agentId)) {
    throw new Error(`Invalid agent ID: ${agentId}`);
  }
  const base = resolve(CONFIG.workspaceDir, "agents");
  const target = resolve(base, agentId);
  // Double-check the resolved path stays inside the base directory
  if (!target.startsWith(base + "/")) {
    throw new Error("Path traversal detected");
  }
  return target;
}

export function getAgentSoulPath(agentId: string): string {
  return join(getAgentDir(agentId), "SOUL.md");
}

export function getSessionsDir(): string {
  return join(CONFIG.openclawHome, "agents", "main", "sessions");
}
