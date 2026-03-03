import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join, resolve } from "path";
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

/**
 * Recursively scan an agent's workspace for files that look like tasks.
 * Returns file paths + contents for any .md/.txt files that appear to be task-related.
 */
export async function scanWorkspaceForTasks(
  agentId: string,
): Promise<{ path: string; content: string; modified: string }[]> {
  const agentDir = getAgentDir(agentId);
  const results: { path: string; content: string; modified: string }[] = [];

  async function walkDir(dir: string, relPrefix: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Skip SOUL.md directory, sessions, .git, node_modules
          if (["sessions", ".git", "node_modules", ".cache"].includes(entry.name)) continue;
          await walkDir(fullPath, relPath);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".md") || entry.name.endsWith(".txt")) &&
          entry.name !== "SOUL.md"
        ) {
          // Check if this looks task-related by path or name
          const lowerPath = relPath.toLowerCase();
          const isTaskLike =
            lowerPath.includes("task") ||
            lowerPath.includes("todo") ||
            lowerPath.includes("action") ||
            lowerPath.includes("tracker") ||
            lowerPath.includes("lead") ||
            lowerPath.includes("outreach") ||
            lowerPath.includes("research") ||
            lowerPath.includes("status") ||
            lowerPath.includes("project");

          if (isTaskLike) {
            try {
              const fileStat = await stat(fullPath);
              const content = await readFile(fullPath, "utf-8");
              // Only include files under 50KB
              if (content.length < 50_000) {
                results.push({
                  path: relPath,
                  content,
                  modified: fileStat.mtime.toISOString(),
                });
              }
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  await walkDir(agentDir, "");
  return results;
}

/**
 * Scan an agent's memory directory for memory files.
 * Returns file paths + contents for any files in ~/.openclaw/agents/<id>/memory/
 */
export async function scanWorkspaceForMemory(
  agentId: string,
): Promise<{ path: string; content: string; size: number; modified: string }[]> {
  const agentDir = getAgentDir(agentId);
  const memoryDir = join(agentDir, "memory");
  const results: { path: string; content: string; size: number; modified: string }[] = [];

  try {
    const entries = await readdir(memoryDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = join(memoryDir, entry.name);
      try {
        const fileStat = await stat(fullPath);
        const content = await readFile(fullPath, "utf-8");
        // Only include files under 100KB
        if (content.length < 100_000) {
          results.push({
            path: `memory/${entry.name}`,
            content,
            size: fileStat.size,
            modified: fileStat.mtime.toISOString(),
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Memory directory doesn't exist
  }

  return results;
}

/**
 * List all workspace files for an agent (text files with content, metadata for binary).
 * Used by Convex agentSync to pull workspace state into the database.
 */
export async function listWorkspaceFiles(
  agentId: string,
): Promise<{ path: string; filename: string; content: string; mimeType: string; sizeBytes: number; lastModifiedAt: number }[]> {
  const agentDir = getAgentDir(agentId);
  const results: { path: string; filename: string; content: string; mimeType: string; sizeBytes: number; lastModifiedAt: number }[] = [];

  const SKIP_DIRS = new Set(["sessions", ".git", "node_modules", ".cache", ".local"]);
  const mimeMap: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    json: "application/json",
    ts: "text/typescript",
    js: "text/javascript",
    py: "text/x-python",
    yaml: "text/yaml",
    yml: "text/yaml",
    toml: "text/toml",
    csv: "text/csv",
    sh: "text/x-shellscript",
    html: "text/html",
    css: "text/css",
    jsx: "text/javascript",
    tsx: "text/typescript",
    sql: "text/x-sql",
    xml: "application/xml",
    rs: "text/x-rust",
    go: "text/x-go",
  };

  async function walkDir(dir: string, relPrefix: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await walkDir(fullPath, relPath);
        } else if (entry.isFile()) {
          try {
            const fileStat = await stat(fullPath);
            // Skip very large files (> 1MB)
            if (fileStat.size > 1_000_000) continue;

            const content = await readFile(fullPath, "utf-8");
            const ext = entry.name.split(".").pop()?.toLowerCase() || "";

            results.push({
              path: relPath,
              filename: entry.name,
              content,
              mimeType: mimeMap[ext] || "text/plain",
              sizeBytes: fileStat.size,
              lastModifiedAt: fileStat.mtime.getTime(),
            });
          } catch {
            // Skip unreadable files (binary etc.)
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  // Scan the agent's own directory
  await walkDir(agentDir, "");

  // Agents write files across the shared workspace — scan common locations
  const workspaceRoot = CONFIG.workspaceDir;

  // Scan content/ subdirectories (e.g. content/skool-dev-env-course/)
  const contentDir = resolve(workspaceRoot, "content");
  try {
    const contentEntries = await readdir(contentDir, { withFileTypes: true });
    for (const entry of contentEntries) {
      if (entry.isDirectory()) {
        await walkDir(join(contentDir, entry.name), `content/${entry.name}`);
      }
    }
  } catch {
    // Content directory doesn't exist — that's fine
  }

  // Scan root-level workspace files (agents write .md docs, scripts, etc. here)
  // Only grab files, NOT directories (those are handled above or are irrelevant)
  try {
    const rootEntries = await readdir(workspaceRoot, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile()) {
        try {
          const fullPath = join(workspaceRoot, entry.name);
          const fileStat = await stat(fullPath);
          if (fileStat.size > 1_000_000) continue;
          const content = await readFile(fullPath, "utf-8");
          const ext = entry.name.split(".").pop()?.toLowerCase() || "";
          results.push({
            path: entry.name,
            filename: entry.name,
            content,
            mimeType: mimeMap[ext] || "text/plain",
            sizeBytes: fileStat.size,
            lastModifiedAt: fileStat.mtime.getTime(),
          });
        } catch {
          // Skip unreadable
        }
      }
    }
  } catch {
    // Workspace root not readable
  }

  return results;
}

/**
 * Delete or archive a processed task file from an agent's workspace.
 */
export async function archiveTaskFile(
  agentId: string,
  relPath: string,
): Promise<void> {
  const agentDir = getAgentDir(agentId);
  const fullPath = join(agentDir, relPath);

  // Security: ensure resolved path stays inside agent dir
  const { resolve } = await import("path");
  const resolvedPath = resolve(fullPath);
  if (!resolvedPath.startsWith(resolve(agentDir) + "/")) {
    throw new Error("Path traversal detected");
  }

  const { unlink } = await import("fs/promises");
  await unlink(resolvedPath);
}
