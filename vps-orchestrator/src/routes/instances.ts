import { Hono } from "hono";
import { CONFIG, validateAgentId, getAgentDir } from "../config";
import {
  getGatewayStatus,
  startGateway,
  stopGateway,
  restartGateway,
} from "../services/systemd";
import { listAgents, readSoul, ensureAgentDir, writeSoul } from "../services/filesystem";
import type { InstanceInfo } from "../types";
import { rm } from "fs/promises";

const app = new Hono();

// Check if Gateway is reachable
async function checkGatewayHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(
      `http://127.0.0.1:${CONFIG.gatewayPort}/`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

// List all agent instances (each agent is a "virtual instance" on the single gateway)
app.get("/instances", async (c) => {
  const agentIds = await listAgents();
  const gateway = await getGatewayStatus();
  const gatewayReachable =
    gateway.state === "active" ? await checkGatewayHealth() : false;

  const instances: InstanceInfo[] = agentIds.map((id) => ({
    id,
    name: id,
    serviceUnit: `${CONFIG.serviceName}.service`,
    systemdState: gateway.state,
    gatewayPort: CONFIG.gatewayPort,
    gatewayUrl: `http://127.0.0.1:${CONFIG.gatewayPort}`,
    gatewayReachable,
    workspaceDir: CONFIG.workspaceDir,
    pid: gateway.pid,
    uptime: gateway.uptime,
    lastStarted: gateway.lastStarted,
    memoryUsage: gateway.memoryUsage,
  }));

  return c.json(instances);
});

// Get single agent instance
app.get("/instances/:id", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  const agents = await listAgents();
  if (!agents.includes(id)) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const gateway = await getGatewayStatus();
  const gatewayReachable =
    gateway.state === "active" ? await checkGatewayHealth() : false;

  const instance: InstanceInfo = {
    id,
    name: id,
    serviceUnit: `${CONFIG.serviceName}.service`,
    systemdState: gateway.state,
    gatewayPort: CONFIG.gatewayPort,
    gatewayUrl: `http://127.0.0.1:${CONFIG.gatewayPort}`,
    gatewayReachable,
    workspaceDir: CONFIG.workspaceDir,
    pid: gateway.pid,
    uptime: gateway.uptime,
    lastStarted: gateway.lastStarted,
    memoryUsage: gateway.memoryUsage,
  };

  return c.json(instance);
});

// Create a new agent (creates SOUL.md directory, not a separate service)
app.post("/instances", async (c) => {
  const body = await c.req.json<{
    id: string;
    name: string;
    soulContent?: string;
  }>();

  if (!body.id || !body.name) {
    return c.json({ error: "Missing required fields: id, name" }, 400);
  }

  if (!validateAgentId(body.id)) {
    return c.json(
      {
        error:
          "ID must be lowercase alphanumeric with hyphens, starting with a letter (max 64 chars)",
      },
      400,
    );
  }

  try {
    await ensureAgentDir(body.id);

    const MAX_SOUL_SIZE = 1_000_000; // 1MB
    const soulContent =
      body.soulContent ||
      `# SOUL.md — ${body.name}\n\n## Identity\n**Name:** ${body.name}\n\n## Core Purpose\nDescribe this agent's purpose.\n\n## Personality\n- Helpful and direct\n\n## Boundaries\n- Stay in your lane\n`;

    if (soulContent.length > MAX_SOUL_SIZE) {
      return c.json({ error: "SOUL.md content exceeds 1MB limit" }, 413);
    }

    await writeSoul(body.id, soulContent);

    const gateway = await getGatewayStatus();
    const gatewayReachable =
      gateway.state === "active" ? await checkGatewayHealth() : false;

    return c.json(
      {
        id: body.id,
        name: body.name,
        serviceUnit: `${CONFIG.serviceName}.service`,
        systemdState: gateway.state,
        gatewayPort: CONFIG.gatewayPort,
        gatewayUrl: `http://127.0.0.1:${CONFIG.gatewayPort}`,
        gatewayReachable,
        workspaceDir: CONFIG.workspaceDir,
        pid: gateway.pid,
        uptime: gateway.uptime,
        lastStarted: gateway.lastStarted,
        memoryUsage: gateway.memoryUsage,
      },
      201,
    );
  } catch (error) {
    return c.json(
      {
        error: "Failed to create agent",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Gateway lifecycle controls (shared across all agents)
app.post("/instances/:id/start", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    await startGateway();
    await new Promise((r) => setTimeout(r, 2000));
    const gateway = await getGatewayStatus();
    return c.json({
      ...gateway,
      id,
      serviceUnit: `${CONFIG.serviceName}.service`,
      gatewayPort: CONFIG.gatewayPort,
      gatewayReachable: await checkGatewayHealth(),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to start" },
      500,
    );
  }
});

app.post("/instances/:id/stop", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    await stopGateway();
    return c.json({
      id,
      systemdState: "inactive",
      serviceUnit: `${CONFIG.serviceName}.service`,
      gatewayPort: CONFIG.gatewayPort,
      gatewayReachable: false,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to stop" },
      500,
    );
  }
});

app.post("/instances/:id/restart", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    await restartGateway();
    await new Promise((r) => setTimeout(r, 2000));
    const gateway = await getGatewayStatus();
    return c.json({
      ...gateway,
      id,
      serviceUnit: `${CONFIG.serviceName}.service`,
      gatewayPort: CONFIG.gatewayPort,
      gatewayReachable: await checkGatewayHealth(),
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to restart" },
      500,
    );
  }
});

// Delete agent (remove SOUL.md directory)
app.delete("/instances/:id", async (c) => {
  const { id } = c.req.param();
  if (!validateAgentId(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }

  try {
    const dir = getAgentDir(id); // Safe — validates + resolves path
    await rm(dir, { recursive: true });
    return c.json({ success: true, message: `Agent ${id} removed` });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      500,
    );
  }
});

export default app;
