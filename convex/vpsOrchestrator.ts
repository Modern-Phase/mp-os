// convex/vpsOrchestrator.ts — VPS Orchestrator integration for managing OpenClaw instances

import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// ---------- Helper ----------

async function orchestratorFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
    throw new Error(
      "VPS_ORCHESTRATOR_URL or VPS_API_KEY not configured. Set via: npx convex env set VPS_ORCHESTRATOR_URL <url>",
    );
  }

  const response = await fetch(`${VPS_ORCHESTRATOR_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": VPS_API_KEY,
      ...(options?.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Orchestrator error (${response.status}): ${error}`);
  }

  return response;
}

/** Actions don't have ctx.db — only check that the caller is authenticated. */
async function requireAuth(ctx: { auth: { getUserIdentity: () => Promise<any> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity;
}

// ---------- Actions (called by UI, make HTTP requests to VPS) ----------

export const listInstances = action({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch("/api/instances");
    const instances = await response.json();

    // Sync to Convex DB for reactive UI
    await ctx.runMutation(internal.vpsOrchestrator.syncInstances, {
      instances,
    });

    return instances;
  },
});

export const controlInstance = action({
  args: {
    instanceId: v.string(),
    command: v.union(
      v.literal("start"),
      v.literal("stop"),
      v.literal("restart"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch(
      `/api/instances/${args.instanceId}/${args.command}`,
      { method: "POST" },
    );

    const instance = await response.json();
    await ctx.runMutation(internal.vpsOrchestrator.syncInstance, { instance });
    return instance;
  },
});

export const createInstance = action({
  args: {
    id: v.string(),
    name: v.string(),
    gatewayPort: v.number(),
    soulContent: v.optional(v.string()),
    model: v.optional(v.string()),
    orgId: v.optional(v.string()),
    emoji: v.optional(v.string()),
    role: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch("/api/instances", {
      method: "POST",
      body: JSON.stringify({
        id: args.id,
        name: args.name,
        gatewayPort: args.gatewayPort,
        soulContent: args.soulContent,
        model: args.model,
      }),
    });

    const instance = await response.json();
    await ctx.runMutation(internal.vpsOrchestrator.syncInstance, { instance });

    // Also register in the agents table so custom agents appear in chat sidebar
    if (args.orgId) {
      await ctx.runMutation(internal.vpsOrchestrator.registerCustomAgent, {
        agentId: args.id,
        orgId: args.orgId,
        name: args.name,
        emoji: args.emoji || "🤖",
        role: args.role || "Custom Agent",
        color: args.color || "#6366F1",
      });
    }

    return instance;
  },
});

export const deleteInstance = action({
  args: { instanceId: v.string(), orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    await orchestratorFetch(`/api/instances/${args.instanceId}`, {
      method: "DELETE",
    });

    await ctx.runMutation(internal.vpsOrchestrator.removeInstance, {
      agentId: args.instanceId,
    });

    // Clean up related Convex data (agents table, sessions, queue items)
    if (args.orgId) {
      await ctx.runMutation(internal.vpsOrchestrator.cleanupAgentData, {
        agentId: args.instanceId,
        orgId: args.orgId,
      });
    }

    return { success: true };
  },
});

export const getSoul = action({
  args: { instanceId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch(
      `/api/instances/${args.instanceId}/soul`,
    );
    return await response.json();
  },
});

export const updateSoul = action({
  args: { instanceId: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    await orchestratorFetch(`/api/instances/${args.instanceId}/soul`, {
      method: "PUT",
      body: JSON.stringify({ content: args.content }),
    });

    return { success: true };
  },
});

export const getSessions = action({
  args: { instanceId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch(
      `/api/instances/${args.instanceId}/sessions`,
    );
    return await response.json();
  },
});

export const getSessionMessages = action({
  args: { instanceId: v.string(), sessionId: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch(
      `/api/instances/${args.instanceId}/sessions/${args.sessionId}`,
    );
    return await response.json();
  },
});

export const sendMessage = action({
  args: {
    instanceId: v.string(),
    message: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const response = await orchestratorFetch(
      `/api/instances/${args.instanceId}/message`,
      {
        method: "POST",
        body: JSON.stringify({
          message: args.message,
          sessionId: args.sessionId,
        }),
      },
    );

    return await response.json();
  },
});

export const checkConnection = action({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);

    try {
      const response = await orchestratorFetch("/api/health");
      const data = await response.json();
      return { connected: true, ...data };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// ---------- Internal mutations (sync VPS state to Convex DB) ----------

export const syncInstances = internalMutation({
  args: { instances: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const instance of args.instances) {
      const existing = await ctx.db
        .query("vpsInstances")
        .withIndex("agentId", (q) => q.eq("agentId", instance.id))
        .unique();

      const data = {
        agentId: instance.id as string,
        serviceUnit: instance.serviceUnit as string,
        systemdState: instance.systemdState as
          | "active"
          | "inactive"
          | "failed"
          | "activating"
          | "deactivating"
          | "unknown",
        gatewayPort: instance.gatewayPort as number,
        gatewayReachable: instance.gatewayReachable as boolean,
        pid: instance.pid as number | undefined,
        uptime: instance.uptime as string | undefined,
        lastStarted: instance.lastStarted as string | undefined,
        memoryUsage: instance.memoryUsage as number | undefined,
        lastSyncedAt: Date.now(),
      };

      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("vpsInstances", data);
      }
    }
  },
});

export const syncInstance = internalMutation({
  args: { instance: v.any() },
  handler: async (ctx, args) => {
    const instance = args.instance;
    const existing = await ctx.db
      .query("vpsInstances")
      .withIndex("agentId", (q) => q.eq("agentId", instance.id))
      .unique();

    const data = {
      agentId: instance.id as string,
      serviceUnit: instance.serviceUnit as string,
      systemdState: instance.systemdState as
        | "active"
        | "inactive"
        | "failed"
        | "activating"
        | "deactivating"
        | "unknown",
      gatewayPort: instance.gatewayPort as number,
      gatewayReachable: instance.gatewayReachable as boolean,
      pid: instance.pid as number | undefined,
      uptime: instance.uptime as string | undefined,
      lastStarted: instance.lastStarted as string | undefined,
      memoryUsage: instance.memoryUsage as number | undefined,
      lastSyncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("vpsInstances", data);
    }
  },
});

export const removeInstance = internalMutation({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vpsInstances")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const registerCustomAgent = internalMutation({
  args: {
    agentId: v.string(),
    orgId: v.string(),
    name: v.string(),
    emoji: v.string(),
    role: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (existing) {
      // Reactivate if previously deleted
      await ctx.db.patch(existing._id, { isActive: true });
      return;
    }

    const orgId = ctx.db.normalizeId("organizations", args.orgId);
    await ctx.db.insert("agents", {
      agentId: args.agentId,
      orgId: orgId || undefined,
      name: args.name,
      role: args.role,
      emoji: args.emoji,
      color: args.color,
      department: "custom",
      description: `Custom agent: ${args.name}`,
      expertise: [],
      isActive: true,
      isCustom: true,
      soulPath: `agents/${args.agentId}/SOUL.md`,
    });
  },
});

export const cleanupAgentData = internalMutation({
  args: { agentId: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    // Deactivate in agents table
    const agent = await ctx.db
      .query("agents")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .first();
    if (agent) {
      await ctx.db.patch(agent._id, { isActive: false });
    }

    // Clean up chat queue items
    const queueItems = await ctx.db
      .query("agentChatQueue")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId as any))
      .collect();
    for (const item of queueItems) {
      if (item.status === "queued" || item.status === "processing") {
        await ctx.db.patch(item._id, { status: "failed", error: "Agent instance deleted" });
      }
    }

    // Clean up agent sessions
    const sessions = await ctx.db
      .query("agentSessions")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId as any))
      .collect();
    for (const session of sessions) {
      await ctx.db.patch(session._id, { status: "offline" });
    }

    // Clean up synced files
    const files = await ctx.db
      .query("agentFiles")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const file of files) {
      await ctx.db.delete(file._id);
    }

    // Clean up synced transcripts
    const transcripts = await ctx.db
      .query("agentSessionTranscripts")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .collect();
    for (const t of transcripts) {
      await ctx.db.delete(t._id);
    }
  },
});

// ---------- Reactive queries (for real-time UI subscriptions) ----------

export const getVpsInstances = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vpsInstances").collect();
  },
});

export const getVpsInstance = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vpsInstances")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .unique();
  },
});
