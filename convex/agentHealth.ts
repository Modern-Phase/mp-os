// convex/agentHealth.ts — Agent health monitoring queries

import { v } from "convex/values";
import { query } from "./_generated/server";

// ========== INFRASTRUCTURE HEALTH ==========

export const getAgentInfraHealth = query({
  args: { agentId: v.string() },
  handler: async (ctx, { agentId }) => {
    const instance = await ctx.db
      .query("vpsInstances")
      .withIndex("agentId", (q) => q.eq("agentId", agentId))
      .first();

    if (!instance) {
      return {
        status: "offline" as const,
        systemdState: "unknown" as const,
        gatewayReachable: false,
        memoryUsageMb: 0,
        uptime: null,
        lastSyncedAt: null,
        syncFreshness: null,
        gatewayPort: null,
        pid: null,
      };
    }

    const syncFreshness = Date.now() - instance.lastSyncedAt;
    const memoryUsageMb = instance.memoryUsage
      ? Math.round(instance.memoryUsage / 1024 / 1024)
      : 0;

    const isActive = instance.systemdState === "active";
    const isFailed = instance.systemdState === "failed";

    let status: "healthy" | "degraded" | "critical" | "offline";
    if (isActive && instance.gatewayReachable) {
      status = "healthy";
    } else if (isActive) {
      status = "degraded";
    } else if (isFailed) {
      status = "critical";
    } else {
      status = "offline";
    }

    return {
      status,
      systemdState: instance.systemdState,
      gatewayReachable: instance.gatewayReachable,
      memoryUsageMb,
      uptime: instance.uptime ?? null,
      lastSyncedAt: instance.lastSyncedAt,
      syncFreshness,
      gatewayPort: instance.gatewayPort,
      pid: instance.pid ?? null,
    };
  },
});

// ========== OPERATIONAL HEALTH ==========

export const getAgentOperationalHealth = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  handler: async (ctx, { orgId: _orgId, agentId }) => {
    // Queue items for success rate + latency + errors
    const queueItems = await ctx.db
      .query("agentChatQueue")
      .withIndex("agentId", (q) => q.eq("agentId", agentId as any))
      .collect();

    const completed = queueItems.filter((q) => q.status === "completed");
    const failed = queueItems.filter((q) => q.status === "failed");
    const total = completed.length + failed.length;

    const successRate = total > 0 ? Math.round((completed.length / total) * 100) : 100;

    // Average latency from completed items
    const latencies = completed
      .filter((q) => q.processedAt && q.queuedAt)
      .map((q) => q.processedAt! - q.queuedAt);
    const avgLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;

    // Recent errors (last 10)
    const recentErrors = failed
      .sort((a, b) => (b.queuedAt || 0) - (a.queuedAt || 0))
      .slice(0, 10)
      .map((q) => ({
        timestamp: q.queuedAt,
        error: q.error || "Unknown error",
        attempts: q.attempts,
      }));

    // Messages in last hour/day
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentMessages = await ctx.db
      .query("agentChatMessages")
      .withIndex("agentId_timestamp", (q) =>
        q.eq("agentId", agentId as any).gte("timestamp", oneDayAgo),
      )
      .collect();

    const messagesLastHour = recentMessages.filter(
      (m) => m.timestamp >= oneHourAgo,
    ).length;
    const messagesLastDay = recentMessages.length;

    // Active sessions
    const sessions = await ctx.db
      .query("agentChatSessions")
      .withIndex("agentId", (q) => q.eq("agentId", agentId as any))
      .collect();
    const activeSessionCount = sessions.filter(
      (s) => s.status === "active",
    ).length;

    // Memory count
    const memories = await ctx.db
      .query("agentMemory")
      .withIndex("agentId", (q) => q.eq("agentId", agentId as any))
      .collect();
    const memoryCount = memories.filter((m) => m.isActive).length;

    // Task completion
    const tasks = await ctx.db
      .query("agentTasks")
      .withIndex("agentId", (q) => q.eq("agentId", agentId as any))
      .collect();
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "done").length;
    const taskCompletionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      successRate,
      avgLatencyMs,
      failedCount: failed.length,
      messagesLastHour,
      messagesLastDay,
      recentErrors,
      activeSessionCount,
      memoryCount,
      taskCompletionRate,
      totalTasks,
      completedTasks,
    };
  },
});

// ========== COMPOSITE HEALTH SCORE ==========

export const getAgentHealthScore = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  handler: async (ctx, { orgId: _orgId, agentId }) => {
    // Infrastructure score (50%)
    const instance = await ctx.db
      .query("vpsInstances")
      .withIndex("agentId", (q) => q.eq("agentId", agentId))
      .first();

    let infraScore = 0;
    if (instance) {
      const syncFreshness = Date.now() - instance.lastSyncedAt;
      // systemd active = 40pts
      if (instance.systemdState === "active") infraScore += 40;
      // gateway reachable = 40pts
      if (instance.gatewayReachable) infraScore += 40;
      // sync fresh (<60s) = 20pts, (<120s) = 10pts
      if (syncFreshness < 60_000) infraScore += 20;
      else if (syncFreshness < 120_000) infraScore += 10;
    }

    // Operational score (50%)
    const queueItems = await ctx.db
      .query("agentChatQueue")
      .withIndex("agentId", (q) => q.eq("agentId", agentId as any))
      .collect();

    const completed = queueItems.filter((q) => q.status === "completed").length;
    const failed = queueItems.filter((q) => q.status === "failed").length;
    const total = completed + failed;
    const successRate = total > 0 ? completed / total : 1;

    // Success rate maps directly to ops score (0-100)
    const opsScore = Math.round(successRate * 100);

    // Composite: 50% infra + 50% ops
    const score = Math.round(infraScore * 0.5 + opsScore * 0.5);

    let label: "healthy" | "degraded" | "critical" | "unknown";
    if (!instance) {
      label = "unknown";
    } else if (score >= 70) {
      label = "healthy";
    } else if (score >= 40) {
      label = "degraded";
    } else {
      label = "critical";
    }

    return { score, label, infraScore, opsScore };
  },
});
