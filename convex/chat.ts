import {
  mutation,
  query,
  internalAction,
  internalMutation,
} from "@cvx/_generated/server";
import { internal } from "@cvx/_generated/api";
import { v } from "convex/values";
import { QueryCtx, MutationCtx } from "@cvx/_generated/server";
import { Id } from "@cvx/_generated/dataModel";

// Auth helper
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

// Create a new chat session
export const createSession = mutation({
  args: {
    title: v.optional(v.string()),
    collectionIds: v.optional(v.array(v.id("documentCollections"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to create session");
    }

    // Verify all collections belong to user
    if (args.collectionIds && args.collectionIds.length > 0) {
      for (const collectionId of args.collectionIds) {
        const collection = await ctx.db.get(collectionId);
        if (!collection || collection.userId !== userId) {
          throw new Error("Collection not found or access denied");
        }
      }
    }

    const sessionId = await ctx.db.insert("chatSessions", {
      userId,
      title: args.title || "New Chat",
      collectionIds: args.collectionIds || [],
      lastMessageAt: Date.now(),
    });

    return sessionId;
  },
});

// List all chat sessions for the current user
export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return sessions;
  },
});

// Get citation data for retrieved chunks
export const getCitationData = query({
  args: {
    chunkIds: v.array(v.id("documentChunks")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Fetch all chunks with their documents
    const citations = await Promise.all(
      args.chunkIds.map(async (chunkId) => {
        const chunk = await ctx.db.get(chunkId);
        if (!chunk || chunk.userId !== userId) {
          return null;
        }

        const document = await ctx.db.get(chunk.documentId);
        return {
          chunkId: chunk._id,
          documentName: document?.name || "Unknown Document",
          content: chunk.content,
        };
      }),
    );

    // Filter out nulls and return valid citations
    return citations.filter(
      (citation): citation is NonNullable<typeof citation> => citation !== null,
    );
  },
});

// Get a specific session with its messages
export const getSession = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      // Return null instead of throwing so UI can handle gracefully
      return null;
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return {
      session,
      messages,
    };
  },
});

// Update session title
export const updateSessionTitle = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to update session");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or access denied");
    }

    await ctx.db.patch(args.sessionId, {
      title: args.title,
    });

    return args.sessionId;
  },
});

// Delete a session and all its messages
export const deleteSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to delete session");
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or access denied");
    }

    // Delete all messages in the session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      // Delete any feedback for this message
      const feedback = await ctx.db
        .query("messageFeedback")
        .withIndex("messageId", (q) => q.eq("messageId", message._id))
        .unique();

      if (feedback) {
        await ctx.db.delete(feedback._id);
      }

      await ctx.db.delete(message._id);
    }

    // Delete the session
    await ctx.db.delete(args.sessionId);

    return args.sessionId;
  },
});

// Save a message (called from http.ts)
export const saveMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    retrievedChunks: v.optional(v.array(v.id("documentChunks"))),
    citationMeta: v.optional(
      v.array(
        v.object({
          documentName: v.string(),
          content: v.string(),
          pageNumber: v.optional(v.number()),
          parser: v.optional(v.string()),
        }),
      ),
    ),
    heliconeRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to save message");
    }

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found or access denied");
    }

    // Insert the message
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId,
      role: args.role,
      content: args.content,
      retrievedChunks: args.retrievedChunks,
      citationMeta: args.citationMeta,
      heliconeRequestId: args.heliconeRequestId,
    });

    // Update session lastMessageAt
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});

// Add feedback to a message
export const rateMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to rate message");
    }

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) {
      throw new Error("Message not found or access denied");
    }

    // Check if feedback already exists
    const existing = await ctx.db
      .query("messageFeedback")
      .withIndex("messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (existing) {
      // Update existing feedback
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        comment: args.comment,
      });
    } else {
      // Create new feedback
      await ctx.db.insert("messageFeedback", {
        messageId: args.messageId,
        userId,
        rating: args.rating,
        comment: args.comment,
        heliconeRequestId: message.heliconeRequestId,
      });
    }

    // Sync to Helicone if we have a request ID
    if (message.heliconeRequestId) {
      await ctx.scheduler.runAfter(0, internal.helicone.syncFeedback, {
        heliconeRequestId: message.heliconeRequestId,
        rating: args.rating,
      });
    }

    return args.messageId;
  },
});

// Get feedback for a message
export const getMessageFeedback = query({
  args: {
    messageId: v.id("chatMessages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required to get feedback");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message || message.userId !== userId) {
      throw new Error("Message not found or access denied");
    }

    const feedback = await ctx.db
      .query("messageFeedback")
      .withIndex("messageId", (q) => q.eq("messageId", args.messageId))
      .unique();

    return feedback;
  },
});

// Get all feedback for messages in a session (for hydrating UI)
export const getFeedbackForSession = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      // Return empty array instead of throwing so UI can handle gracefully
      return [];
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const messageIds = messages.map((m) => m._id);
    const feedbackList = await Promise.all(
      messageIds.map(async (messageId) => {
        const feedback = await ctx.db
          .query("messageFeedback")
          .withIndex("messageId", (q) => q.eq("messageId", messageId))
          .unique();
        return feedback ? { messageId, rating: feedback.rating } : null;
      }),
    );

    return feedbackList.filter(
      (
        f,
      ): f is {
        messageId: Id<"chatMessages">;
        rating: "positive" | "negative";
      } => f !== null,
    );
  },
});

// Internal action to save messages from HTTP endpoint
export const PREAUTH_saveMessage = internalAction({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    retrievedChunks: v.optional(v.array(v.id("documentChunks"))),
    citationMeta: v.optional(
      v.array(
        v.object({
          documentName: v.string(),
          content: v.string(),
          pageNumber: v.optional(v.number()),
          parser: v.optional(v.string()),
        }),
      ),
    ),
    heliconeRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.chat.insertMessage, {
      sessionId: args.sessionId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      retrievedChunks: args.retrievedChunks,
      citationMeta: args.citationMeta,
      heliconeRequestId: args.heliconeRequestId,
    });
  },
});

// Internal mutation to insert message
export const insertMessage = internalMutation({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    retrievedChunks: v.optional(v.array(v.id("documentChunks"))),
    citationMeta: v.optional(
      v.array(
        v.object({
          documentName: v.string(),
          content: v.string(),
          pageNumber: v.optional(v.number()),
          parser: v.optional(v.string()),
        }),
      ),
    ),
    heliconeRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      retrievedChunks: args.retrievedChunks,
      citationMeta: args.citationMeta,
      heliconeRequestId: args.heliconeRequestId,
    });

    // Update session lastMessageAt
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});
