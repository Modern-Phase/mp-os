// discord-bot/src/config.ts — Environment configuration

export const config = {
  /** Discord bot token from the Developer Portal */
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",

  /** Convex HTTP endpoint (e.g. https://xxx.convex.site) */
  CONVEX_SITE_URL: process.env.CONVEX_SITE_URL || "",

  /** Shared secret for bot ↔ Convex auth */
  BOT_API_KEY: process.env.BOT_API_KEY || "",

  /** Port for the Hono reply server */
  BOT_PORT: parseInt(process.env.BOT_PORT || "18801", 10),
} as const;

export function validateConfig() {
  const missing: string[] = [];
  if (!config.DISCORD_BOT_TOKEN) missing.push("DISCORD_BOT_TOKEN");
  if (!config.CONVEX_SITE_URL) missing.push("CONVEX_SITE_URL");
  if (!config.BOT_API_KEY) missing.push("BOT_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
