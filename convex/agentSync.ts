// convex/agentSync.ts — Sync agent workspace files, session transcripts, and tool calls from VPS to Convex

import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// ---------- Helper ----------

async function orchestratorFetch(path: string): Promise<Response> {
  if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
    throw new Error("VPS_ORCHESTRATOR_URL or VPS_API_KEY not configured");
  }

  const response = await fetch(`${VPS_ORCHESTRATOR_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": VPS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Orchestrator error (${response.status}): ${error}`);
  }

  return response;
}

// ---------- Sync Actions ----------

/**
 * Sync all agent data: workspace files + session transcripts.
 * Called after agent responds (auto-sync) or manually via UI.
 */
export const syncAgentData = action({
  args: {
    agentId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const results = { files: 0, sessions: 0, errors: [] as string[] };

    // Sync workspace files
    try {
      const filesRes = await orchestratorFetch(`/api/instances/${args.agentId}/workspace/files`);
      const { files } = await filesRes.json();

      if (Array.isArray(files)) {
        await ctx.runMutation(internal.agentSync.upsertFiles, {
          orgId: args.orgId,
          agentId: args.agentId,
          files: files.map((f: any) => ({
            path: f.path,
            filename: f.filename,
            content: f.content?.slice(0, 1_000_000), // cap at 1MB
            mimeType: f.mimeType || "text/plain",
            sizeBytes: f.sizeBytes || 0,
            lastModifiedAt: f.lastModifiedAt || Date.now(),
          })),
        });
        results.files = files.length;
      }
    } catch (err) {
      results.errors.push(`Files: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    // Sync session transcripts
    try {
      const sessionsRes = await orchestratorFetch(`/api/instances/${args.agentId}/sessions`);
      const { sessions } = await sessionsRes.json();

      if (Array.isArray(sessions)) {
        for (const session of sessions) {
          try {
            const messagesRes = await orchestratorFetch(
              `/api/instances/${args.agentId}/sessions/${session.id}`,
            );
            const { messages } = await messagesRes.json();

            if (Array.isArray(messages) && messages.length > 0) {
              await ctx.runMutation(internal.agentSync.upsertSessionTranscript, {
                orgId: args.orgId,
                agentId: args.agentId,
                sessionId: session.id,
                messages: JSON.stringify(messages),
                messageCount: messages.length,
                startedAt: messages[0]?.timestamp || session.startedAt || Date.now(),
                lastActivityAt: messages[messages.length - 1]?.timestamp || Date.now(),
              });
              results.sessions++;
            }
          } catch {
            // Skip individual sessions that fail
          }
        }
      }
    } catch (err) {
      results.errors.push(`Sessions: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    return results;
  },
});

/**
 * Internal version for use by scheduler (no auth required).
 */
export const INTERNAL_syncAgentData = internalAction({
  args: {
    agentId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args): Promise<{ files: number; sessions: number; errors: string[] }> => {
    const results = { files: 0, sessions: 0, errors: [] as string[] };

    try {
      const filesRes = await orchestratorFetch(`/api/instances/${args.agentId}/workspace/files`);
      const { files } = await filesRes.json();
      if (Array.isArray(files)) {
        await ctx.runMutation(internal.agentSync.upsertFiles, {
          orgId: args.orgId,
          agentId: args.agentId,
          files: files.map((f: any) => ({
            path: f.path,
            filename: f.filename,
            content: f.content?.slice(0, 1_000_000),
            mimeType: f.mimeType || "text/plain",
            sizeBytes: f.sizeBytes || 0,
            lastModifiedAt: f.lastModifiedAt || Date.now(),
          })),
        });
        results.files = files.length;
      }
    } catch (err) {
      results.errors.push(`Files: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    try {
      const sessionsRes = await orchestratorFetch(`/api/instances/${args.agentId}/sessions`);
      const { sessions } = await sessionsRes.json();
      if (Array.isArray(sessions)) {
        for (const session of sessions) {
          try {
            const messagesRes = await orchestratorFetch(
              `/api/instances/${args.agentId}/sessions/${session.id}`,
            );
            const { messages } = await messagesRes.json();
            if (Array.isArray(messages) && messages.length > 0) {
              await ctx.runMutation(internal.agentSync.upsertSessionTranscript, {
                orgId: args.orgId,
                agentId: args.agentId,
                sessionId: session.id,
                messages: JSON.stringify(messages),
                messageCount: messages.length,
                startedAt: messages[0]?.timestamp || session.startedAt || Date.now(),
                lastActivityAt: messages[messages.length - 1]?.timestamp || Date.now(),
              });
              results.sessions++;
            }
          } catch {
            // Skip individual sessions that fail
          }
        }
      }
    } catch (err) {
      results.errors.push(`Sessions: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    return results;
  },
});

// ---------- Internal Mutations ----------

export const upsertFiles = internalMutation({
  args: {
    orgId: v.string(),
    agentId: v.string(),
    files: v.array(
      v.object({
        path: v.string(),
        filename: v.string(),
        content: v.optional(v.string()),
        mimeType: v.string(),
        sizeBytes: v.number(),
        lastModifiedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.db.normalizeId("organizations", args.orgId);
    if (!orgId) return;

    const now = Date.now();

    // Get all existing files for this agent
    const existing = await ctx.db
      .query("agentFiles")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .collect();

    const existingByPath = new Map(existing.map((f) => [f.path, f]));
    const incomingPaths = new Set(args.files.map((f) => f.path));

    // Upsert files
    for (const file of args.files) {
      const ex = existingByPath.get(file.path);
      if (ex) {
        // Only update if modified
        if (file.lastModifiedAt > ex.lastModifiedAt) {
          await ctx.db.patch(ex._id, {
            content: file.content,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            lastModifiedAt: file.lastModifiedAt,
            syncedAt: now,
          });
        }
      } else {
        await ctx.db.insert("agentFiles", {
          orgId,
          agentId: args.agentId,
          path: file.path,
          filename: file.filename,
          content: file.content,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          lastModifiedAt: file.lastModifiedAt,
          syncedAt: now,
        });
      }
    }

    // Delete files that no longer exist on VPS
    for (const ex of existing) {
      if (!incomingPaths.has(ex.path)) {
        await ctx.db.delete(ex._id);
      }
    }
  },
});

export const upsertSessionTranscript = internalMutation({
  args: {
    orgId: v.string(),
    agentId: v.string(),
    sessionId: v.string(),
    messages: v.string(),
    messageCount: v.number(),
    startedAt: v.number(),
    lastActivityAt: v.number(),
  },
  handler: async (ctx, args) => {
    const orgId = ctx.db.normalizeId("organizations", args.orgId);
    if (!orgId) return;

    // Check for existing transcript
    const existing = await ctx.db
      .query("agentSessionTranscripts")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      // Only update if new messages exist
      if (args.messageCount > existing.messageCount) {
        await ctx.db.patch(existing._id, {
          messages: args.messages,
          messageCount: args.messageCount,
          lastActivityAt: args.lastActivityAt,
          syncedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert("agentSessionTranscripts", {
        orgId,
        agentId: args.agentId,
        sessionId: args.sessionId,
        messages: args.messages,
        messageCount: args.messageCount,
        startedAt: args.startedAt,
        lastActivityAt: args.lastActivityAt,
        syncedAt: Date.now(),
      });
    }
  },
});

// ---------- Queries ----------

export const getAgentFiles = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentFiles")
      .withIndex("orgId_agentId", (q) =>
        q.eq("orgId", args.orgId).eq("agentId", args.agentId),
      )
      .collect();
  },
});

export const getAgentSessionTranscripts = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessionTranscripts")
      .withIndex("orgId_agentId", (q) =>
        q.eq("orgId", args.orgId).eq("agentId", args.agentId),
      )
      .collect();
  },
});

export const getSyncStatus = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("agentFiles")
      .withIndex("orgId_agentId", (q) =>
        q.eq("orgId", args.orgId).eq("agentId", args.agentId),
      )
      .collect();

    const transcripts = await ctx.db
      .query("agentSessionTranscripts")
      .withIndex("orgId_agentId", (q) =>
        q.eq("orgId", args.orgId).eq("agentId", args.agentId),
      )
      .collect();

    const lastSyncedFile = files.reduce(
      (max, f) => Math.max(max, f.syncedAt || 0),
      0,
    );
    const lastSyncedTranscript = transcripts.reduce(
      (max, t) => Math.max(max, t.syncedAt || 0),
      0,
    );

    return {
      fileCount: files.length,
      sessionCount: transcripts.length,
      lastSyncedAt: Math.max(lastSyncedFile, lastSyncedTranscript) || null,
    };
  },
});

export const getAgentMemories = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMemory")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId as any))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});
