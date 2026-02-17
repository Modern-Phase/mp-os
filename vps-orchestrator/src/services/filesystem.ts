import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join } from "path";
import { CONFIG, getAgentSoulPath, getAgentDir, getSessionsDir } from "../config";
import type { SessionInfo, SessionMessage } from "../types";

export async function listAgents(): Promise<string[]> {
  const agentsDir = join(CONFIG.workspaceDir, "agents");
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

export async function readSoul(agentId: string): Promise<string> {
  const path = getAgentSoulPath(agentId);
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

export async function writeSoul(
  agentId: string,
  content: string,
): Promise<void> {
  const dir = getAgentDir(agentId);
  await mkdir(dir, { recursive: true });
  const path = getAgentSoulPath(agentId);
  await writeFile(path, content, "utf-8");
}

export async function listSessions(): Promise<SessionInfo[]> {
  const sessionsDir = getSessionsDir();

  try {
    const files = await readdir(sessionsDir);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

    const sessions: SessionInfo[] = [];
    for (const file of jsonlFiles) {
      const filePath = join(sessionsDir, file);
      try {
        const fileStat = await stat(filePath);
        const content = await readFile(filePath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);

        // Try to extract agent from session filename
        const sessionId = file.replace(".jsonl", "");
        const agentMatch = sessionId.match(/^agent:([^:]+):/);
        const agentId = agentMatch ? agentMatch[1] : "main";

        sessions.push({
          id: sessionId,
          agentId,
          messageCount: lines.length,
          lastActivity: fileStat.mtime.toISOString(),
          sizeBytes: fileStat.size,
        });
      } catch {
        // Skip unreadable files
      }
    }

    return sessions.sort(
      (a, b) =>
        new Date(b.lastActivity).getTime() -
        new Date(a.lastActivity).getTime(),
    );
  } catch {
    return [];
  }
}

export async function listAgentSessions(
  agentId: string,
): Promise<SessionInfo[]> {
  const all = await listSessions();
  return all.filter((s) => s.agentId === agentId || s.id.includes(agentId));
}

export async function readSession(
  sessionId: string,
): Promise<SessionMessage[]> {
  const sessionsDir = getSessionsDir();
  // Session files might use : in names which gets encoded
  const possibleNames = [
    `${sessionId}.jsonl`,
    `${sessionId.replace(/:/g, "_")}.jsonl`,
  ];

  for (const name of possibleNames) {
    const filePath = join(sessionsDir, name);
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      return lines.map((line) => {
        try {
          const parsed = JSON.parse(line);
          return {
            role: parsed.role || parsed.type || "unknown",
            content:
              parsed.content ||
              parsed.message ||
              parsed.text ||
              JSON.stringify(parsed),
            timestamp: parsed.timestamp || parsed.ts,
            metadata: parsed.metadata,
          };
        } catch {
          return { role: "unknown", content: line };
        }
      });
    } catch {
      continue;
    }
  }

  return [];
}

export async function ensureAgentDir(agentId: string): Promise<void> {
  const dir = getAgentDir(agentId);
  await mkdir(dir, { recursive: true });
}
