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
import { connect as connectGateway, disconnect as disconnectGateway } from "./services/gateway-ws";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    // Only allow requests from your frontend and Convex cloud
    origin: (origin) => {
      if (!origin) return origin; // Allow non-browser requests (Convex actions, curl)
      const allowed = [
        "http://localhost:5173",
        "http://localhost:3000",
      ];
      // Also allow *.convex.site and your production domain
      if (
        origin.endsWith(".convex.site") ||
        origin.endsWith(".convex.cloud") ||
        origin.endsWith(".netlify.app") ||
        allowed.includes(origin)
      ) {
        return origin;
      }
      return null; // Block other origins
    },
    allowHeaders: ["Content-Type", "X-API-Key", "Authorization"],
  }),
);

// Health check — minimal info, no auth required (used for uptime monitoring)
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
console.log(
  `API key: ${CONFIG.apiKey ? "configured" : "NOT SET (all requests will fail auth)"}`,
);
console.log(
  `Webhook: ${CONFIG.convexSiteUrl ? CONFIG.convexSiteUrl : "NOT SET (agent responses won't be delivered)"}`,
);

// Connect to OpenClaw Gateway via WebSocket
connectGateway();

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  disconnectGateway();
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down...");
  disconnectGateway();
  process.exit(0);
});

export default {
  port: CONFIG.port,
  fetch: app.fetch,
};
