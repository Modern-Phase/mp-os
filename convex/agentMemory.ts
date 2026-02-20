// convex/agentMemory.ts — Agent memory with vector search for cross-session recall

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { agentIdValidator } from "./schema";
import { generateEmbedding } from "./rag";
import type { Id, Doc } from "./_generated/dataModel";

// Memory categories and importance levels
const memoryCategoryValidator = v.union(
  v.literal("fact"),
  v.literal("preference"),
  v.literal("procedure"),
  v.literal("context"),
  v.literal("relationship"),
);

const memoryImportanceValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

// ── Search Memory (vector similarity) ──

export const searchMemory = internalAction({
  args: {
    agentId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<(Doc<"agentMemory"> & { _score: number })[]> => {
    const limit = args.limit || 8;

    const queryEmbedding = await generateEmbedding(args.query);

    // Vector search filtered by agentId; post-filter isActive
    const results = await ctx.vectorSearch("agentMemory", "memory_embedding", {
      vector: queryEmbedding,
      limit: limit * 2,
      filter: (q) => q.eq("agentId", args.agentId as any),
    });

    // Fetch full documents and filter to active memories
    const memories: (Doc<"agentMemory"> & { _score: number })[] = [];
    for (const result of results) {
      if (memories.length >= limit) break;
      const memory = await ctx.runQuery(internal.agentMemory.getMemoryById, {
        memoryId: result._id,
      });
      if (memory && memory.isActive) {
        memories.push({
          ...memory,
          _score: result._score,
        });
      }
    }

    return memories;
  },
});

// Internal query to fetch a memory by ID
export const getMemoryById = internalQuery({
  args: { memoryId: v.id("agentMemory") },
  handler: async (ctx, args): Promise<Doc<"agentMemory"> | null> => {
    return ctx.db.get(args.memoryId);
  },
});

// ── Store Memory ──

export const storeMemory = internalAction({
  args: {
    orgId: v.string(),
    agentId: v.string(),
    content: v.string(),
    category: memoryCategoryValidator,
    importance: memoryImportanceValidator,
    source: v.union(v.literal("conversation"), v.literal("migration"), v.literal("manual")),
    sourceMessageId: v.optional(v.string()),
    migratedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"agentMemory">> => {
    const embedding = await generateEmbedding(args.content);

    const memoryId: Id<"agentMemory"> = await ctx.runMutation(
      internal.agentMemory.insertMemory,
      {
        orgId: args.orgId as Id<"organizations">,
        agentId: args.agentId as any,
        content: args.content,
        category: args.category,
        importance: args.importance,
        source: args.source,
        sourceMessageId: args.sourceMessageId
          ? (args.sourceMessageId as Id<"agentChatMessages">)
          : undefined,
        embedding,
        migratedFrom: args.migratedFrom,
      },
    );

    return memoryId;
  },
});

// Internal mutation to insert memory + log entry
export const insertMemory = internalMutation({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    content: v.string(),
    category: memoryCategoryValidator,
    importance: memoryImportanceValidator,
    source: v.union(v.literal("conversation"), v.literal("migration"), v.literal("manual")),
    sourceMessageId: v.optional(v.id("agentChatMessages")),
    embedding: v.array(v.float64()),
    migratedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"agentMemory">> => {
    const memoryId = await ctx.db.insert("agentMemory", {
      orgId: args.orgId,
      agentId: args.agentId,
      content: args.content,
      category: args.category,
      importance: args.importance,
      source: args.source,
      sourceMessageId: args.sourceMessageId,
      embedding: args.embedding,
      isActive: true,
      migratedFrom: args.migratedFrom,
    });

    await ctx.db.insert("agentMemoryLog", {
      orgId: args.orgId,
      agentId: args.agentId,
      action: args.source === "migration" ? "migrate" : "store",
      memoryId,
      content: args.content,
      timestamp: Date.now(),
    });

    return memoryId;
  },
});

// ── Deactivate Memory (soft delete) ──

export const deactivateMemory = internalMutation({
  args: { memoryId: v.id("agentMemory") },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);
    if (!memory) return;

    await ctx.db.patch(args.memoryId, { isActive: false });

    await ctx.db.insert("agentMemoryLog", {
      orgId: memory.orgId,
      agentId: memory.agentId,
      action: "deactivate",
      memoryId: args.memoryId,
      content: memory.content,
      timestamp: Date.now(),
    });
  },
});

// ── Process Memory Directives (from agent responses) ──

export const processMemoryDirectives = internalAction({
  args: {
    directives: v.array(v.any()),
    orgId: v.string(),
    agentId: v.string(),
    sourceMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<number> => {
    let processed = 0;

    for (const directive of args.directives) {
      try {
        if (directive.action === "store" && directive.content) {
          await ctx.runAction(internal.agentMemory.storeMemory, {
            orgId: args.orgId,
            agentId: args.agentId,
            content: directive.content,
            category: directive.category || "fact",
            importance: directive.importance || "medium",
            source: "conversation",
            sourceMessageId: args.sourceMessageId,
          });
          processed++;
          console.log(
            `[agentMemory] Stored memory for ${args.agentId}: "${directive.content.slice(0, 60)}..."`,
          );
        } else if (directive.action === "forget" && directive.memoryId) {
          await ctx.runMutation(internal.agentMemory.deactivateMemory, {
            memoryId: directive.memoryId as Id<"agentMemory">,
          });
          processed++;
          console.log(
            `[agentMemory] Deactivated memory ${directive.memoryId} for ${args.agentId}`,
          );
        }
      } catch (error) {
        console.error(`[agentMemory] Failed to process directive:`, error);
      }
    }

    // Update the source message with processed count
    if (args.sourceMessageId && processed > 0) {
      await ctx.runMutation(internal.agentMemory.patchMessageMemoryCount, {
        messageId: args.sourceMessageId as Id<"agentChatMessages">,
        count: processed,
      });
    }

    return processed;
  },
});

// Internal mutation to patch memory directive count on a message
export const patchMessageMemoryCount = internalMutation({
  args: {
    messageId: v.id("agentChatMessages"),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      processedMemoryDirectives: args.count,
    });
  },
});

// ── Check for duplicate migrated memory ──

export const hasMigratedMemory = internalQuery({
  args: {
    agentId: agentIdValidator,
    migratedFrom: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("agentMemory")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .filter((q) =>
        q.and(
          q.eq(q.field("migratedFrom"), args.migratedFrom),
          q.eq(q.field("isActive"), true),
        ),
      )
      .first();
    return !!existing;
  },
});
