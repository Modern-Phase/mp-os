// convex/discord.ts — Discord bot integration
// Handles inbound Discord messages and outbound agent replies

import { v } from "convex/values";
import {
  internalMutation,
  internalAction,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { DISCORD_BOT_URL, DISCORD_BOT_API_KEY } from "./env";

// ========== INBOUND: Discord message → Convex pipeline ==========

/**
 * Create a chat message from a Discord user.
 * Mirrors the web `createChatMessage` flow: inserts agentChatMessages + agentChatQueue,
 * then schedules dispatchChatMessage (shared RAG + memory + directives pipeline).
 */
export const INTERNAL_createDiscordMessage = internalMutation({
  args: {
    discordUserId: v.string(),
    discordUsername: v.string(),
    channelId: v.string(),
    guildId: v.string(),
    discordMessageId: v.string(),
    agentId: v.string(),
    content: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Resolve Discord user → Convex user via discordLinks
    const link = await ctx.db
      .query("discordLinks")
      .withIndex("discordUserId", (q) => q.eq("discordUserId", args.discordUserId))
      .first();

    if (!link) {
      return { success: false, error: "unlinked" };
    }

    const userId = link.userId;

    // Create the chat message with Discord metadata
    const messageId = await ctx.db.insert("agentChatMessages", {
      orgId: args.orgId,
      agentId: args.agentId as any,
      userId,
      content: args.content,
      role: "user",
      status: "pending",
      metadata: {
        source: "discord",
        discordChannelId: args.channelId,
        discordMessageId: args.discordMessageId,
        discordUserId: args.discordUserId,
        discordUsername: args.discordUsername,
      },
      timestamp: Date.now(),
    });

    // Queue for agent processing
    const queueId = await ctx.db.insert("agentChatQueue", {
      orgId: args.orgId,
      messageId,
      agentId: args.agentId as any,
      userId,
      status: "queued",
      attempts: 0,
      queuedAt: Date.now(),
    });

    // Schedule dispatch through the shared pipeline (RAG + memory + directives)
    await ctx.scheduler.runAfter(0, internal.agentChat.dispatchChatMessage, {
      queueId,
      messageId: messageId as string,
      agentId: args.agentId,
      orgId: args.orgId as string,
      content: args.content,
      userId: userId as string,
    });

    return { success: true, messageId: String(messageId) };
  },
});

// ========== OUTBOUND: Agent reply → Discord bot ==========

/**
 * Send an agent's response back to the Discord channel.
 * Called from receiveAgentResponse when metadata.source === "discord".
 */
export const INTERNAL_sendDiscordReply = internalAction({
  args: {
    channelId: v.string(),
    discordMessageId: v.string(),
    agentId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    if (!DISCORD_BOT_URL || !DISCORD_BOT_API_KEY) {
      console.log("[discord] Bot URL/key not configured, skipping reply");
      return;
    }

    // Look up agent name/emoji for formatting
    const agentConfig = await ctx.runQuery(internal.agents.getAgentConfig, {
      agentId: args.agentId as any,
    });

    const agentName = agentConfig?.name || args.agentId;
    const agentEmoji = agentConfig?.emoji || "🤖";

    try {
      const response = await fetch(`${DISCORD_BOT_URL}/api/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-API-Key": DISCORD_BOT_API_KEY,
        },
        body: JSON.stringify({
          channelId: args.channelId,
          content: args.content,
          replyToMessageId: args.discordMessageId,
          agentName,
          agentEmoji,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[discord] Reply failed (${response.status}): ${errorText}`);
      } else {
        console.log(`[discord] Reply sent to channel ${args.channelId} by ${agentName}`);
      }
    } catch (error) {
      console.error("[discord] Failed to send reply:", error);
    }
  },
});

// ========== DISCORD ACCOUNT LINKING ==========

/**
 * Generate a 6-digit link code for the current user.
 * User shares this code in Discord via `!link <code>`.
 */
export const linkDiscordUser = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Remove any existing codes for this user
    const existing = await ctx.db
      .query("discordLinkCodes")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const code of existing) {
      await ctx.db.delete(code._id);
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    await ctx.db.insert("discordLinkCodes", {
      userId: user._id,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    return code;
  },
});

/**
 * Verify a link code from Discord and create the discordLinks row.
 * Called from the Discord webhook when a user sends `!link <code>`.
 */
export const INTERNAL_verifyDiscordLink = internalMutation({
  args: {
    code: v.string(),
    discordUserId: v.string(),
    discordUsername: v.string(),
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the code
    const linkCode = await ctx.db
      .query("discordLinkCodes")
      .withIndex("code", (q) => q.eq("code", args.code))
      .first();

    if (!linkCode) {
      return { success: false, error: "Invalid code" };
    }

    if (linkCode.expiresAt < Date.now()) {
      await ctx.db.delete(linkCode._id);
      return { success: false, error: "Code expired" };
    }

    // Check if this Discord user is already linked
    const existingLink = await ctx.db
      .query("discordLinks")
      .withIndex("discordUserId", (q) => q.eq("discordUserId", args.discordUserId))
      .first();

    if (existingLink) {
      await ctx.db.delete(linkCode._id);
      return { success: false, error: "Discord account already linked" };
    }

    // Create the link
    await ctx.db.insert("discordLinks", {
      userId: linkCode.userId,
      discordUserId: args.discordUserId,
      discordUsername: args.discordUsername,
      guildId: args.guildId,
      linkedAt: Date.now(),
    });

    // Clean up the code
    await ctx.db.delete(linkCode._id);

    return { success: true };
  },
});

/**
 * Get Discord link status for the current user.
 */
export const getDiscordLinkStatus = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const link = await ctx.db
      .query("discordLinks")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .first();

    if (!link) return { linked: false };

    return {
      linked: true,
      discordUsername: link.discordUsername,
      linkedAt: link.linkedAt,
    };
  },
});

/**
 * Unlink Discord account for the current user.
 */
export const unlinkDiscord = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const user = await ctx.db
      .query("users")
      .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const link = await ctx.db
      .query("discordLinks")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .first();

    if (link) {
      await ctx.db.delete(link._id);
    }

    return true;
  },
});

// ========== CHANNEL MAP MANAGEMENT ==========

/**
 * Get channel map for an org (used by the webhook to resolve channelId → orgId).
 */
export const INTERNAL_getChannelMap = internalMutation({
  args: { channelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("discordChannelMap")
      .withIndex("channelId", (q) => q.eq("channelId", args.channelId))
      .first();
  },
});
