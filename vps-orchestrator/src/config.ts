import { join } from "path";

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
} as const;

export function getAgentSoulPath(agentId: string): string {
  return join(CONFIG.workspaceDir, "agents", agentId, "SOUL.md");
}

export function getAgentDir(agentId: string): string {
  return join(CONFIG.workspaceDir, "agents", agentId);
}

export function getSessionsDir(): string {
  return join(CONFIG.openclawHome, "agents", "main", "sessions");
}
