import { Hono } from "hono";
import { getGatewayStatus } from "../services/systemd";

const app = new Hono();

// Minimal health check — no sensitive details (instance count, PID, uptime)
app.get("/health", async (c) => {
  const gateway = await getGatewayStatus();

  return c.json({
    status: gateway.state === "active" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
  });
});

export default app;
