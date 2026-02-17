import { Hono } from "hono";
import { listAgents } from "../services/filesystem";
import { getGatewayStatus } from "../services/systemd";

const app = new Hono();

app.get("/health", async (c) => {
  const agents = await listAgents();
  const gateway = await getGatewayStatus();

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    instanceCount: agents.length,
    gateway: {
      state: gateway.state,
      uptime: gateway.uptime,
      pid: gateway.pid,
    },
  });
});

export default app;
