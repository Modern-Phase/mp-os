// convex/agentChat.ts — Agent chat system for in-app messaging

import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { agentIdValidator, PROCESSING_STATUS } from "./schema";
import { VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// Task directive instructions injected into every message to the agent
const TASK_DIRECTIVE_INSTRUCTIONS = `<system_instructions>
TASK MANAGEMENT: You are connected to a Mission Control dashboard. When you need to create, track, or manage tasks:
- Include a <task_directives> block at the END of your text response
- This is the ONLY way tasks appear in the Mission Control Kanban board
- Do NOT write task files to disk — disk files are ephemeral and not visible to the team
- The <task_directives> block will be automatically parsed and stripped from the displayed message

Actions: create | update | complete | handoff
Format: <task_directives>[{"action":"create","title":"Imperative title","description":"Details","priority":"medium","tags":["tag"]}]</task_directives>
For handoff: <task_directives>[{"action":"handoff","taskId":"<convex_id>","toAgentId":"<agent_id>","note":"optional reason"}]</task_directives>
Priority: low | medium | high | urgent

MEMORY MANAGEMENT: You can store important facts, preferences, and learnings for future reference.
- Include a <memory_directives> block at the END of your response (after any task_directives)
- Memories persist across sessions and are automatically recalled when relevant
- Store things like: user preferences, team conventions, project decisions, learned facts
- Only store genuinely useful long-term knowledge — not transient conversation details

Format: <memory_directives>[{"action":"store","content":"The team uses Bun, not npm","category":"preference","importance":"medium"}]</memory_directives>
Categories: fact | preference | procedure | context | relationship
Importance: low | medium | high
To forget: <memory_directives>[{"action":"forget","memoryId":"<id>"}]</memory_directives>

OUTBOUND EMAIL: You can manage email campaigns through Instantly.
- add_to_campaign: Add a lead to an Instantly campaign
- check_analytics: Get campaign performance metrics
- list_campaigns: List all available campaigns
- check_lead_status: Check a lead's status in a campaign
Format: <outbound_directives>[{"action":"add_to_campaign","campaignId":"...","email":"...","firstName":"...","lastName":"...","company":"..."}]</outbound_directives>
Other actions:
<outbound_directives>[{"action":"check_analytics","campaignId":"..."}]</outbound_directives>
<outbound_directives>[{"action":"list_campaigns"}]</outbound_directives>
<outbound_directives>[{"action":"check_lead_status","email":"...","campaignId":"..."}]</outbound_directives>
</system_instructions>
`;

// Chat message schema
export const createChatMessage = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    sessionId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    attachment: v.optional(
      v.object({
        name: v.string(),
        storageId: v.id("_storage"),
        fileSize: v.number(),
        mimeType: v.string(),
        textContent: v.string(), // File content read on frontend (capped at 32KB)
      }),
    ),
  },
  returns: v.id("agentChatMessages"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Build metadata with attachment info if present
    const metadata = args.attachment
      ? {
          ...(args.metadata || {}),
          attachment: {
            name: args.attachment.name,
            storageId: args.attachment.storageId,
            fileSize: args.attachment.fileSize,
            mimeType: args.attachment.mimeType,
          },
        }
      : args.metadata;

    // Build content — prepend file content in <attached_file> tags for the agent
    let contentForAgent = args.content;
    if (args.attachment) {
      const ext = args.attachment.name.split(".").pop()?.toLowerCase() || "txt";
      const sizeLabel =
        args.attachment.fileSize < 1024
          ? `${args.attachment.fileSize}B`
          : `${Math.round(args.attachment.fileSize / 1024)}KB`;
      contentForAgent = `<attached_file name="${args.attachment.name}" type="${ext}" size="${sizeLabel}">\n${args.attachment.textContent}\n</attached_file>\n\n${args.content}`;
    }

    const messageId = await ctx.db.insert("agentChatMessages", {
      orgId: args.orgId,
      agentId: args.agentId,
      userId,
      content: contentForAgent,
      role: args.role,
      sessionId: args.sessionId,
      status: args.role === "user" ? "pending" : "delivered",
      metadata,
      timestamp: Date.now(),
    });

    // If user message, queue for agent processing and dispatch immediately
    if (args.role === "user") {
      const queueId = await ctx.db.insert("agentChatQueue", {
        orgId: args.orgId,
        messageId,
        agentId: args.agentId,
        userId,
        status: "queued",
        attempts: 0,
        queuedAt: Date.now(),
      });

      // Schedule immediate dispatch to VPS Orchestrator (includes RAG injection)
      await ctx.scheduler.runAfter(0, internal.agentChat.dispatchChatMessage, {
        queueId,
        messageId: messageId as string,
        agentId: args.agentId,
        orgId: args.orgId as string,
        content: contentForAgent,
        sessionId: args.sessionId,
        userId: userId as string,
      });

      // If attachment present, schedule RAG pipeline processing
      if (args.attachment) {
        await ctx.scheduler.runAfter(
          0,
          internal.agentChat.INTERNAL_createDocumentFromAttachment,
          {
            orgId: args.orgId,
            userId,
            name: args.attachment.name,
            storageId: args.attachment.storageId,
            fileSize: args.attachment.fileSize,
            mimeType: args.attachment.mimeType,
          },
        );
      }
    }

    return messageId;
  },
});

// Get chat history for an agent
export const getAgentChatHistory = query({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("agentChatMessages")
      .withIndex("orgId_agentId", (q) => 
        q.eq("orgId", args.orgId).eq("agentId", args.agentId)
      )
      .order("desc")
      .take(args.limit || 50);
    
    return messages.reverse();
  },
});

// Get pending messages (for agent processing)
export const getPendingMessages = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(agentIdValidator),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("agentChatQueue")
      .withIndex("orgId_status", (q) => 
        q.eq("orgId", args.orgId).eq("status", "queued")
      );
    
    if (args.agentId) {
      // Filter by agent
      const all = await q.collect();
      return all.filter(item => item.agentId === args.agentId);
    }
    
    return await q.take(10);
  },
});

// Mark message as processed (agent responded)
export const markMessageProcessed = mutation({
  args: {
    queueId: v.id("agentChatQueue"),
    response: v.string(),
    sessionId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const queueItem = await ctx.db.get(args.queueId);
    if (!queueItem) throw new Error("Queue item not found");

    // Update queue status
    await ctx.db.patch(args.queueId, {
      status: "completed",
      processedAt: Date.now(),
    });

    // Create agent response message
    await ctx.db.insert("agentChatMessages", {
      orgId: queueItem.orgId,
      agentId: queueItem.agentId,
      userId: queueItem.userId,
      content: args.response,
      role: "agent",
      sessionId: args.sessionId,
      status: "delivered",
      replyTo: queueItem.messageId,
      timestamp: Date.now(),
    });

    // Update original message status
    await ctx.db.patch(queueItem.messageId, {
      status: "responded",
    });

    return true;
  },
});

// Get or create chat session
export const getOrCreateSession = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Look for existing active session
    const existing = await ctx.db
      .query("agentChatSessions")
      .withIndex("orgId_agentId_userId", (q) => 
        q.eq("orgId", args.orgId)
          .eq("agentId", args.agentId)
          .eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (existing) return existing.sessionId;

    // Create new session
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await ctx.db.insert("agentChatSessions", {
      orgId: args.orgId,
      agentId: args.agentId,
      userId,
      sessionId,
      status: "active",
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return sessionId;
  },
});

// Internal: Patch RAG citation data onto a user message
export const patchMessageRagData = internalMutation({
  args: {
    messageId: v.id("agentChatMessages"),
    retrievedChunks: v.array(v.string()),
    citationMeta: v.array(
      v.object({
        documentName: v.string(),
        content: v.string(),
        pageNumber: v.optional(v.number()),
        parser: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      retrievedChunks: args.retrievedChunks,
      citationMeta: args.citationMeta,
    });
  },
});

// Internal: Dispatch a chat message to the VPS Orchestrator → Gateway WS bridge
// Now includes RAG context injection before sending to agent
export const dispatchChatMessage = internalAction({
  args: {
    queueId: v.id("agentChatQueue"),
    messageId: v.string(),
    agentId: v.string(),
    orgId: v.string(),
    content: v.string(),
    sessionId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) {
      console.log("[agentChat] VPS Orchestrator not configured, skipping dispatch");
      return;
    }

    try {
      // Mark queue item as processing
      await ctx.runMutation(internal.agentChat.updateQueueStatus, {
        queueId: args.queueId,
        status: "processing",
      });

      // ── System Instructions + RAG Context Injection ──
      // Prepend task directive instructions to every message
      let enrichedMessage = TASK_DIRECTIVE_INSTRUCTIONS + args.content;
      if (args.userId) {
        try {
          const userId = args.userId as any; // Id<"users">
          const orgId = args.orgId as any; // Id<"organizations">

          // 1. Get agent config for collection filtering
          const agentConfig = await ctx.runQuery(internal.agents.getAgentConfig, {
            agentId: args.agentId as any,
          });

          // 2. Determine which collections to search
          let collectionIds: any[] = [];
          if (agentConfig?.collectionIds && agentConfig.collectionIds.length > 0) {
            collectionIds = agentConfig.collectionIds;
          } else {
            // Fall back to all org collections
            const orgCollections = await ctx.runQuery(
              internal.collections.getCollectionsByOrgId,
              { orgId },
            );
            collectionIds = orgCollections.map((c: any) => c._id);
          }

          // 3. Run RAG search if we have collections
          if (collectionIds.length > 0) {
            const ragResults = await ctx.runAction(internal.rag.internalSearchCatalog, {
              userId,
              collectionIds,
              query: args.content,
              limit: 6,
            });

            if (ragResults.length > 0) {
              // 4. Build context block
              const contextChunks = ragResults.map(
                (r: any) =>
                  `[${r.documentName}${r.pageNumber ? ` p.${r.pageNumber}` : ""}]\n${r.content}`,
              );
              const contextBlock = `<document_context>\n${contextChunks.join("\n---\n")}\n</document_context>`;
              enrichedMessage = `${contextBlock}\n\n${args.content}`;

              // 5. Store citation metadata on the user message
              await ctx.runMutation(internal.agentChat.patchMessageRagData, {
                messageId: args.messageId as any,
                retrievedChunks: ragResults.map((r: any) => String(r._id)),
                citationMeta: ragResults.map((r: any) => ({
                  documentName: r.documentName || "Unknown",
                  content: r.snippet || r.content?.slice(0, 200) || "",
                  pageNumber: r.pageNumber,
                  parser: r.parser,
                })),
              });

              console.log(
                `[agentChat] RAG injected ${ragResults.length} chunks for agent ${args.agentId}`,
              );
            }
          }
        } catch (ragError) {
          // RAG failure should NOT block message delivery
          console.error("[agentChat] RAG injection failed (non-blocking):", ragError);
        }

        // ── Agent Memory Injection ──
        try {
          const memories = await ctx.runAction(internal.agentMemory.searchMemory, {
            agentId: args.agentId,
            query: args.content,
            limit: 8,
          });

          if (memories.length > 0) {
            const memoryLines = memories.map(
              (m: any) => `[${m.category}] ${m.content}`,
            );
            const memoryBlock = `<agent_memory>\n${memoryLines.join("\n")}\n</agent_memory>`;
            // Prepend memory before existing enriched content
            enrichedMessage = `${memoryBlock}\n\n${enrichedMessage}`;

            console.log(
              `[agentChat] Memory injected ${memories.length} items for agent ${args.agentId}`,
            );
          }
        } catch (memoryError) {
          // Memory failure should NOT block message delivery
          console.error("[agentChat] Memory injection failed (non-blocking):", memoryError);
        }
      }

      const sessionKey = args.sessionId || `agent:main:${args.agentId}`;

      const response = await fetch(
        `${VPS_ORCHESTRATOR_URL}/api/instances/${args.agentId}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": VPS_API_KEY,
          },
          body: JSON.stringify({
            message: enrichedMessage,
            sessionId: sessionKey,
            messageId: args.messageId,
            orgId: args.orgId,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Orchestrator error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log(`[agentChat] Dispatched to orchestrator: runId=${result.runId}`);
    } catch (error) {
      console.error("[agentChat] Failed to dispatch:", error);
      await ctx.runMutation(internal.agentChat.updateQueueStatus, {
        queueId: args.queueId,
        status: "failed",
        error: String(error),
      });
    }
  },
});

// Internal: Update chat queue item status
export const updateQueueStatus = internalMutation({
  args: {
    queueId: v.id("agentChatQueue"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: args.status,
      ...(args.error && { error: args.error }),
      ...(args.status === "completed" || args.status === "failed"
        ? { processedAt: Date.now() }
        : {}),
    });
  },
});

// Internal: Scan agent workspace for task files and convert to Convex tasks
// This is a fallback for when agents write .md files instead of using task_directives
export const scanAgentWorkspaceForTasks = internalAction({
  args: {
    agentId: v.string(),
    orgId: v.string(),
    userId: v.string(),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!VPS_ORCHESTRATOR_URL || !VPS_API_KEY) return;

    try {
      // 1. Fetch task files from agent workspace
      const response = await fetch(
        `${VPS_ORCHESTRATOR_URL}/api/instances/${args.agentId}/workspace/tasks`,
        {
          headers: { "X-API-Key": VPS_API_KEY },
        },
      );

      if (!response.ok) {
        console.log(`[agentChat] Workspace scan returned ${response.status}`);
        return;
      }

      const data = await response.json();
      if (!data.files || data.files.length === 0) return;

      console.log(`[agentChat] Found ${data.files.length} task file(s) in ${args.agentId} workspace`);

      // 2. Parse each file and create tasks
      for (const file of data.files) {
        try {
          // Extract title from filename or first heading
          const filename = file.path.split("/").pop()?.replace(/\.(md|txt)$/, "") || "Untitled";
          const headingMatch = file.content.match(/^#\s+(.+)$/m);
          const title = headingMatch ? headingMatch[1].trim() : filename.replace(/[-_]/g, " ");

          // Extract description from content (first paragraph after heading, or full content)
          const lines = file.content.split("\n").filter((l: string) => l.trim());
          const descriptionLines = lines.filter(
            (l: string) => !l.startsWith("#") && !l.startsWith("---"),
          );
          const description = descriptionLines.slice(0, 10).join("\n").trim() || file.content.slice(0, 500);

          // Detect priority from content
          let priority: "low" | "medium" | "high" | "urgent" = "medium";
          const lowerContent = file.content.toLowerCase();
          if (lowerContent.includes("urgent") || lowerContent.includes("critical")) priority = "urgent";
          else if (lowerContent.includes("high priority") || lowerContent.includes("important")) priority = "high";
          else if (lowerContent.includes("low priority")) priority = "low";

          // Extract tags from content
          const tags: string[] = [];
          if (lowerContent.includes("lead") || lowerContent.includes("prospect")) tags.push("leads");
          if (lowerContent.includes("outreach") || lowerContent.includes("email")) tags.push("outreach");
          if (lowerContent.includes("research")) tags.push("research");
          if (lowerContent.includes("meeting") || lowerContent.includes("standup")) tags.push("meeting");
          if (tags.length === 0) tags.push("agent-created");

          // Create the task in Convex
          await ctx.runMutation(internal.agentChat.createTaskFromWorkspace, {
            orgId: args.orgId as any,
            userId: args.userId as any,
            agentId: args.agentId as any,
            title,
            description,
            priority,
            tags,
            sourceFile: file.path,
            messageId: args.messageId,
          });

          // 3. Delete the processed file from the workspace
          await fetch(
            `${VPS_ORCHESTRATOR_URL}/api/instances/${args.agentId}/workspace/tasks`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": VPS_API_KEY,
              },
              body: JSON.stringify({ path: file.path }),
            },
          );

          console.log(`[agentChat] Created task from workspace file: ${file.path} → "${title}"`);
        } catch (fileError) {
          console.error(`[agentChat] Failed to process workspace file ${file.path}:`, fileError);
        }
      }
    } catch (error) {
      console.error("[agentChat] Workspace scan failed:", error);
    }
  },
});

// Internal: Create a task from a workspace file scan
export const createTaskFromWorkspace = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    agentId: agentIdValidator,
    title: v.string(),
    description: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    tags: v.array(v.string()),
    sourceFile: v.string(),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate (same title + agent in last hour)
    const recent = await ctx.db
      .query("agentTasks")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    const isDuplicate = recent.some(
      (t) =>
        t.title === args.title &&
        t._creationTime > Date.now() - 3600_000,
    );
    if (isDuplicate) {
      console.log(`[agentChat] Skipping duplicate task: "${args.title}"`);
      return;
    }

    const taskId = await ctx.db.insert("agentTasks", {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      agentId: args.agentId,
      status: "todo",
      priority: args.priority,
      createdBy: args.userId,
      assignedTo: args.userId,
      createdByAgent: args.agentId,
      tags: args.tags,
    });

    await ctx.db.insert("agentActivity", {
      orgId: args.orgId,
      agentId: args.agentId,
      action: "task_created",
      target: args.title,
      taskId,
      metadata: { source: "workspace_scan", file: args.sourceFile },
      timestamp: Date.now(),
    });

    return taskId;
  },
});

// Internal: Close all active sessions (forces agents to start fresh with updated SOUL.md)
export const closeAllSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const activeSessions = await ctx.db
      .query("agentChatSessions")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    let closed = 0;
    for (const session of activeSessions) {
      await ctx.db.patch(session._id, { status: "closed" });
      closed++;
    }
    console.log(`[agentChat] Closed ${closed} active sessions`);
    return closed;
  },
});

// Internal: Find or create the "Agent Uploads" collection for an organization
export const INTERNAL_ensureAgentUploadsCollection = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Look for existing "Agent Uploads" collection in this org
    const existing = await ctx.db
      .query("documentCollections")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("name"), "Agent Uploads"))
      .first();

    if (existing) return existing._id;

    // Create it
    return await ctx.db.insert("documentCollections", {
      userId: args.userId,
      orgId: args.orgId,
      name: "Agent Uploads",
      description: "Files uploaded through agent chat",
      isDefault: false,
    });
  },
});

// Internal: Create a document from an agent chat attachment and schedule RAG processing
export const INTERNAL_createDocumentFromAttachment = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    // Get or create the "Agent Uploads" collection
    const collectionId = await ctx.db
      .query("documentCollections")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("name"), "Agent Uploads"))
      .first()
      .then((c) => c?._id);

    const finalCollectionId =
      collectionId ??
      (await ctx.db.insert("documentCollections", {
        userId: args.userId,
        orgId: args.orgId,
        name: "Agent Uploads",
        description: "Files uploaded through agent chat",
        isDefault: false,
      }));

    // Determine document type from mime
    const ext = args.name.split(".").pop()?.toLowerCase() || "";
    let type: "text" | "pdf" | "csv" | "image" | "audio" | "video" = "text";
    if (ext === "csv" || ext === "tsv") type = "csv";
    else if (ext === "pdf") type = "pdf";
    else if (args.mimeType.startsWith("image/")) type = "image";

    // Insert document
    const documentId = await ctx.db.insert("documents", {
      userId: args.userId,
      orgId: args.orgId,
      collectionId: finalCollectionId,
      name: args.name,
      type,
      storageId: args.storageId,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      processingStatus: PROCESSING_STATUS.PENDING,
    });

    // Create processing job
    const jobId = await ctx.db.insert("processingJobs", {
      documentId,
      userId: args.userId,
      status: "queued",
      processedPages: 0,
      processedChunks: 0,
      startedAt: Date.now(),
      statusMessage: "Queued for processing (agent upload)...",
    });

    // Schedule RAG pipeline
    await ctx.scheduler.runAfter(0, internal.rag.processDocument, {
      documentId,
      userId: args.userId,
      jobId,
    });

    console.log(
      `[agentChat] Created document "${args.name}" in Agent Uploads collection → RAG processing scheduled`,
    );

    return documentId;
  },
});

// Helper to get auth user
async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}
