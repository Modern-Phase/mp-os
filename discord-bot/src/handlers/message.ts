// discord-bot/src/handlers/message.ts — Discord messageCreate handler

import type { Message, Client } from "discord.js";
import { config } from "../config";
import { AGENT_MENTION_MAP, DEPARTMENT_DEFAULT_AGENTS } from "../constants";

/**
 * Handle incoming Discord messages.
 * - Ignores bot messages
 * - Resolves @mentions to agentIds
 * - Falls back to department default agent
 * - POSTs to Convex /webhooks/discord-message
 */
export async function handleMessage(message: Message, client: Client) {
  // Ignore bot messages (including self)
  if (message.author.bot) return;

  // Ignore DMs — only process guild (server) messages
  if (!message.guild) return;

  const channelId = message.channel.id;
  const content = message.content.trim();
  if (!content) return;

  // Handle !link command for account linking
  if (content.startsWith("!link ")) {
    const code = content.slice(6).trim();
    if (!/^\d{6}$/.test(code)) {
      await message.reply("Please provide a valid 6-digit code. Usage: `!link 123456`");
      return;
    }

    try {
      const response = await fetch(`${config.CONVEX_SITE_URL}/webhooks/discord-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-API-Key": config.BOT_API_KEY,
        },
        body: JSON.stringify({
          type: "link",
          code,
          discordUserId: message.author.id,
          discordUsername: message.author.username,
          guildId: message.guild.id,
        }),
      });

      const result = await response.json() as { success: boolean; error?: string };
      if (result.success) {
        await message.reply("Account linked successfully! You can now chat with agents in mapped channels.");
      } else {
        await message.reply(`Link failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("[message] Link command failed:", error);
      await message.reply("Failed to process link command. Please try again.");
    }
    return;
  }

  // Resolve @mention to agentId
  let agentId: string | null = null;
  let cleanContent = content;

  // Check for role mentions that match agent names
  for (const role of message.mentions.roles.values()) {
    const roleName = role.name.toLowerCase();
    if (AGENT_MENTION_MAP[roleName]) {
      agentId = AGENT_MENTION_MAP[roleName];
      // Strip the role mention from content
      cleanContent = cleanContent.replace(new RegExp(`<@&${role.id}>\\s*`, "g"), "").trim();
      break;
    }
  }

  // Check for user mentions that match bot accounts named after agents
  if (!agentId) {
    for (const user of message.mentions.users.values()) {
      const userName = user.username.toLowerCase();
      if (AGENT_MENTION_MAP[userName]) {
        agentId = AGENT_MENTION_MAP[userName];
        cleanContent = cleanContent.replace(new RegExp(`<@!?${user.id}>\\s*`, "g"), "").trim();
        break;
      }
    }
  }

  // Check for plain text @agent at the start
  if (!agentId) {
    const mentionMatch = content.match(/^@(\w+)\s+/i);
    if (mentionMatch) {
      const name = mentionMatch[1].toLowerCase();
      if (AGENT_MENTION_MAP[name]) {
        agentId = AGENT_MENTION_MAP[name];
        cleanContent = content.slice(mentionMatch[0].length).trim();
      }
    }
  }

  // If no @mention found, this message isn't directed at an agent — skip it
  // (unless we want to use department defaults for all messages in mapped channels)
  if (!agentId) {
    // No agent mentioned — skip. Users must @mention an agent.
    return;
  }

  if (!cleanContent) {
    await message.reply("Please include a message after the @mention.");
    return;
  }

  // POST to Convex
  try {
    const response = await fetch(`${config.CONVEX_SITE_URL}/webhooks/discord-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-API-Key": config.BOT_API_KEY,
      },
      body: JSON.stringify({
        type: "message",
        discordUserId: message.author.id,
        discordUsername: message.author.username,
        channelId,
        guildId: message.guild.id,
        messageId: message.id,
        agentId,
        content: cleanContent,
      }),
    });

    const result = await response.json() as { success: boolean; error?: string };

    if (!result.success) {
      if (result.error === "unlinked") {
        await message.reply(
          "Your Discord account is not linked. Please link it first:\n" +
          "1. Go to the MP-OS web app → Settings → Discord\n" +
          "2. Click **Link Discord** to get a 6-digit code\n" +
          "3. Come back here and type `!link <code>`"
        );
      } else {
        console.error("[message] Convex returned error:", result.error);
      }
      return;
    }

    // Add a reaction to acknowledge receipt
    await message.react("⏳");
  } catch (error) {
    console.error("[message] Failed to send to Convex:", error);
    await message.react("❌");
  }
}
