import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function getAuthUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

// Internal mutation for creating default collection (called from app.ts when user is created)
export const createDefaultCollection = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if user already has a default collection
    const existing = await ctx.db
      .query("documentCollections")
      .withIndex("userId_name", (q) =>
        q.eq("userId", args.userId).eq("name", "Default"),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("documentCollections", {
      userId: args.userId,
      name: "Default",
      description: "Your default document collection",
      isDefault: true,
    });
  },
});

export const createCollection = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to create collection");
    }

    // Validate name
    if (!args.name.trim()) {
      throw new Error("Collection name is required");
    }
    if (args.name.length > 100) {
      throw new Error("Collection name must be less than 100 characters");
    }

    return await ctx.db.insert("documentCollections", {
      userId,
      name: args.name.trim(),
      description: args.description?.trim(),
      isDefault: false,
    });
  },
});

export const listCollections = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to list collections");
    }

    const collections = await ctx.db
      .query("documentCollections")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    return collections;
  },
});

export const getCollection = query({
  args: {
    collectionId: v.id("documentCollections"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to get collection");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    return collection;
  },
});

export const updateCollection = mutation({
  args: {
    collectionId: v.id("documentCollections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to update collection");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    // Don't allow renaming the default collection
    if (collection.isDefault && args.name) {
      throw new Error("Cannot rename the default collection");
    }

    const updates: Partial<typeof collection> = {};
    if (args.name !== undefined && args.name.trim()) {
      if (args.name.length > 100) {
        throw new Error("Collection name must be less than 100 characters");
      }
      updates.name = args.name.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description?.trim();
    }

    await ctx.db.patch(args.collectionId, updates);
    return args.collectionId;
  },
});

export const deleteCollection = mutation({
  args: {
    collectionId: v.id("documentCollections"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to delete collection");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or access denied");
    }

    if (collection.isDefault) {
      throw new Error("Cannot delete the default collection");
    }

    // Get all documents in this collection
    const documents = await ctx.db
      .query("documents")
      .withIndex("collectionId", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    // Delete all chunks and documents
    for (const doc of documents) {
      const chunks = await ctx.db
        .query("documentChunks")
        .withIndex("documentId", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
      }

      await ctx.db.delete(doc._id);
    }

    await ctx.db.delete(args.collectionId);
    return args.collectionId;
  },
});
