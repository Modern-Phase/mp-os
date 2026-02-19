import { Hono } from "hono";
import { getGatewayStatus } from "../services/systemd";
import { getStatus as getWsStatus } from "../services/gateway-ws";

const app = new Hono();

// Minimal health check — no sensitive details (instance count, PID, uptime)
app.get("/health", async (c) => {
  const gateway = await getGatewayStatus();
  const ws = getWsStatus();

  return c.json({
    status: gateway.state === "active" && ws.connected && ws.handshake ? "ok" : "degraded",
    wsConnected: ws.connected,
    wsHandshake: ws.handshake,
    timestamp: new Date().toISOString(),
  });
});

export default app;
