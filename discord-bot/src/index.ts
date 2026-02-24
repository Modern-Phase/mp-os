// discord-bot/src/index.ts — Bot startup, event registration, and Hono reply server

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { serve } from "@hono/node-server";
import { config, validateConfig } from "./config";
import { handleMessage } from "./handlers/message";
import { createReplyRouter } from "./handlers/reply";

// Validate env before anything else
validateConfig();

// Create Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// Register message handler
client.on("messageCreate", (message) => {
  handleMessage(message, client).catch((err) => {
    console.error("[bot] Unhandled error in message handler:", err);
  });
});

client.once("ready", () => {
  console.log(`[bot] Logged in as ${client.user?.tag}`);
  console.log(`[bot] Serving ${client.guilds.cache.size} guild(s)`);
});

// Start the Hono reply server (receives callbacks from Convex)
const replyApp = createReplyRouter(client);
serve({ fetch: replyApp.fetch, port: config.BOT_PORT }, () => {
  console.log(`[bot] Reply server listening on port ${config.BOT_PORT}`);
});

// Connect to Discord
client.login(config.DISCORD_BOT_TOKEN).catch((err) => {
  console.error("[bot] Failed to login:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[bot] Shutting down...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[bot] Shutting down...");
  client.destroy();
  process.exit(0);
});
