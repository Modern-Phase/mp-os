import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { apiKeyAuth } from "./middleware/auth";
import healthRoutes from "./routes/health";
import instanceRoutes from "./routes/instances";
import soulRoutes from "./routes/soul";
import sessionRoutes from "./routes/sessions";
import logRoutes from "./routes/logs";
import { CONFIG } from "./config";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "X-API-Key", "Authorization"],
  }),
);

// Health check (no auth)
app.route("/api", healthRoutes);

// All other routes require API key
app.use("/api/instances/*", apiKeyAuth);
app.route("/api", instanceRoutes);
app.route("/api", soulRoutes);
app.route("/api", sessionRoutes);
app.route("/api", logRoutes);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

console.log(`OpenClaw Orchestrator starting on port ${CONFIG.port}`);
console.log(`OpenClaw home: ${CONFIG.openclawHome}`);
console.log(`Service prefix: ${CONFIG.servicePrefix}`);
console.log(
  `API key: ${CONFIG.apiKey ? "configured" : "NOT SET (all requests will fail auth)"}`,
);

export default {
  port: CONFIG.port,
  fetch: app.fetch,
};
