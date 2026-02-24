// discord-bot/src/handlers/reply.ts — Hono route for receiving agent replies from Convex

import { Hono } from "hono";
import type { Client, TextChannel } from "discord.js";
import { config } from "../config";
import { DISCORD_MAX_MESSAGE_LENGTH } from "../constants";

/**
 * Create the Hono reply router.
 * Convex calls POST /api/reply to send agent responses back to Discord.
 */
export function createReplyRouter(client: Client) {
  const app = new Hono();

  app.post("/api/reply", async (c) => {
    // Verify API key
    const apiKey = c.req.header("X-Bot-API-Key");
    if (apiKey !== config.BOT_API_KEY) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { channelId, content, replyToMessageId, agentName, agentEmoji } = body;

    if (!channelId || !content) {
      return c.json({ error: "Missing channelId or content" }, 400);
    }

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !("send" in channel)) {
        return c.json({ error: "Channel not found or not a text channel" }, 404);
      }

      const textChannel = channel as TextChannel;

      // Format the message with agent identity
      const prefix = agentEmoji && agentName
        ? `${agentEmoji} **${agentName}**\n`
        : "";

      const fullContent = prefix + content;

      // Split messages that exceed Discord's 2000 char limit
      const chunks = splitMessage(fullContent);

      for (let i = 0; i < chunks.length; i++) {
        const options: Record<string, unknown> = { content: chunks[i] };

        // Reply to the original message for the first chunk
        if (i === 0 && replyToMessageId) {
          try {
            const originalMsg = await textChannel.messages.fetch(replyToMessageId);
            if (originalMsg) {
              options.reply = { messageReference: replyToMessageId };
            }
          } catch {
            // Original message may have been deleted — send without reply
          }
        }

        await textChannel.send(options as any);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("[reply] Failed to send Discord message:", error);
      return c.json(
        { error: error instanceof Error ? error.message : "Send failed" },
        500,
      );
    }
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      uptime: process.uptime(),
      guilds: client.guilds.cache.size,
    });
  });

  return app;
}

/**
 * Split a message into chunks that fit within Discord's character limit.
 * Tries to split on newlines, then spaces, then hard-cuts.
 */
function splitMessage(content: string): string[] {
  if (content.length <= DISCORD_MAX_MESSAGE_LENGTH) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point
    let splitAt = remaining.lastIndexOf("\n", DISCORD_MAX_MESSAGE_LENGTH);
    if (splitAt === -1 || splitAt < DISCORD_MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = remaining.lastIndexOf(" ", DISCORD_MAX_MESSAGE_LENGTH);
    }
    if (splitAt === -1 || splitAt < DISCORD_MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = DISCORD_MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
