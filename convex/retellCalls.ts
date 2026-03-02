// convex/retellCalls.ts — Voice call integration via Retell AI

import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER, RETELL_TO_NUMBER, VPS_ORCHESTRATOR_URL, VPS_API_KEY } from "./env";

// ---------- Queries ----------

export const getCallsByOrg = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return await ctx.db
      .query("retellCalls")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit || 20);
  },
});

export const getActiveCall = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Check for initiating/registered/ongoing calls
    const activeCalls = await ctx.db
      .query("retellCalls")
      .withIndex("orgId_status", (q) => q.eq("orgId", args.orgId).eq("status", "ongoing"))
      .collect();

    const initiating = await ctx.db
      .query("retellCalls")
      .withIndex("orgId_status", (q) => q.eq("orgId", args.orgId).eq("status", "initiating"))
      .collect();

    const registered = await ctx.db
      .query("retellCalls")
      .withIndex("orgId_status", (q) => q.eq("orgId", args.orgId).eq("status", "registered"))
      .collect();

    const all = [...initiating, ...registered, ...activeCalls];

    // Filter by agentId if specified
    const filtered = args.agentId
      ? all.filter((c) => c.agentId === args.agentId)
      : all;

    if (filtered.length === 0) {
      // Return most recent ended/error call (within last 30 seconds) for brief post-call UI
      const recent = await ctx.db
        .query("retellCalls")
        .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
        .order("desc")
        .first();

      if (
        recent &&
        (recent.status === "ended" || recent.status === "error") &&
        recent._creationTime > Date.now() - 30_000
      ) {
        if (!args.agentId || recent.agentId === args.agentId) {
          return recent;
        }
      }
      return null;
    }

    // Return the most recently created active call
    return filtered.sort((a, b) => b._creationTime - a._creationTime)[0];
  },
});

// ---------- Mutations ----------

export const initiateCall = mutation({
  args: {
    orgId: v.id("organizations"),
    agentId: v.optional(v.string()),
  },
  returns: v.id("retellCalls"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (!RETELL_API_KEY || !RETELL_AGENT_ID || !RETELL_FROM_NUMBER || !RETELL_TO_NUMBER) {
      throw new Error(
        "Retell AI not configured. Set RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER, RETELL_TO_NUMBER via: npx convex env set",
      );
    }

    // Prevent duplicate active calls
    const existing = await ctx.db
      .query("retellCalls")
      .withIndex("orgId_status", (q) => q.eq("orgId", args.orgId).eq("status", "ongoing"))
      .first();
    if (existing) throw new Error("A call is already in progress");

    const existingInitiating = await ctx.db
      .query("retellCalls")
      .withIndex("orgId_status", (q) => q.eq("orgId", args.orgId).eq("status", "initiating"))
      .first();
    if (existingInitiating) throw new Error("A call is already being initiated");

    const callId = await ctx.db.insert("retellCalls", {
      orgId: args.orgId,
      userId,
      agentId: args.agentId,
      retellAgentId: RETELL_AGENT_ID,
      fromNumber: RETELL_FROM_NUMBER,
      toNumber: RETELL_TO_NUMBER,
      status: "initiating",
      direction: "outbound",
    });

    // Schedule the Retell API call
    await ctx.scheduler.runAfter(0, internal.retellCalls.INTERNAL_createRetellCall, {
      callRecordId: callId,
      orgId: args.orgId,
      userId,
      agentId: args.agentId,
    });

    return callId;
  },
});

// ---------- Internal Actions ----------

export const INTERNAL_createRetellCall = internalAction({
  args: {
    callRecordId: v.id("retellCalls"),
    orgId: v.id("organizations"),
    userId: v.id("users"),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch agent personality (SOUL.md) from VPS
      let agentPersonality = "";
      let agentName = "";
      if (args.agentId && VPS_ORCHESTRATOR_URL && VPS_API_KEY) {
        try {
          const soulResponse = await fetch(
            `${VPS_ORCHESTRATOR_URL}/api/instances/${args.agentId}/soul`,
            {
              headers: {
                "Content-Type": "application/json",
                "X-API-Key": VPS_API_KEY,
              },
            },
          );
          if (soulResponse.ok) {
            const soulData = await soulResponse.json();
            agentPersonality = (soulData.content || "").slice(0, 3000);
            agentName = soulData.name || args.agentId;
          }
        } catch (soulError) {
          console.warn("[RetellCalls] SOUL.md fetch failed, proceeding without:", soulError);
        }
      }

      // 2. Fetch agent's recent memories
      let agentMemoryContext = "";
      if (args.agentId) {
        try {
          const memories = await ctx.runAction(internal.agentMemory.searchMemory, {
            agentId: args.agentId,
            query: "important facts preferences company context",
            limit: 8,
          });
          if (memories.length > 0) {
            agentMemoryContext = memories
              .map((m: any) => `- [${m.category}] ${m.content}`)
              .join("\n")
              .slice(0, 2000);
          }
        } catch (memError) {
          console.warn("[RetellCalls] Memory fetch failed, proceeding without:", memError);
        }
      }

      // 3. Build RAG context from knowledge base
      let knowledgeContext = "";
      try {
        let collectionIds: any[] = [];
        if (args.agentId) {
          const agentConfig = await ctx.runQuery(internal.agents.getAgentConfig, {
            agentId: args.agentId as any,
          });
          if (agentConfig?.collectionIds && agentConfig.collectionIds.length > 0) {
            collectionIds = agentConfig.collectionIds;
          }
        }

        if (collectionIds.length === 0) {
          const orgCollections = await ctx.runQuery(
            internal.collections.getCollectionsByOrgId,
            { orgId: args.orgId },
          );
          collectionIds = orgCollections.map((c: any) => c._id);
        }

        if (collectionIds.length > 0) {
          const ragResults = await ctx.runAction(internal.rag.internalSearchCatalog, {
            userId: args.userId,
            collectionIds,
            query: "company overview services capabilities",
            limit: 10,
          });

          if (ragResults.length > 0) {
            const contextParts = ragResults.map((r: any, i: number) =>
              `[${i + 1}] ${r.documentName}: ${r.content}`,
            );
            knowledgeContext = contextParts.join("\n\n").slice(0, 4096);
          }
        }
      } catch (ragError) {
        console.warn("[RetellCalls] RAG context fetch failed, proceeding without:", ragError);
      }

      // 4. Call Retell API
      const body: Record<string, any> = {
        from_number: RETELL_FROM_NUMBER,
        to_number: RETELL_TO_NUMBER,
        override_agent_id: RETELL_AGENT_ID,
        metadata: {
          orgId: args.orgId,
          userId: args.userId,
          agentId: args.agentId || null,
          callRecordId: args.callRecordId,
        },
      };

      // Inject personality + memory + RAG as dynamic variables
      const dynamicVars: Record<string, string> = {};
      if (agentPersonality) {
        dynamicVars.agent_personality = agentPersonality;
        dynamicVars.agent_name = agentName;
      }
      if (agentMemoryContext) {
        dynamicVars.agent_memory = agentMemoryContext;
      }
      if (knowledgeContext) {
        dynamicVars.knowledge_context = knowledgeContext;
      }
      if (Object.keys(dynamicVars).length > 0) {
        body.retell_llm_dynamic_variables = dynamicVars;
      }

      const response = await fetch("https://api.retellai.com/v2/create-phone-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Retell API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // 3. Update call record with Retell's call ID
      await ctx.runMutation(internal.retellCalls.INTERNAL_updateCallStatus, {
        callRecordId: args.callRecordId,
        status: "registered",
        retellCallId: result.call_id,
        startTimestamp: Date.now(),
      });
    } catch (error) {
      console.error("[RetellCalls] Failed to create call:", error);
      await ctx.runMutation(internal.retellCalls.INTERNAL_updateCallStatus, {
        callRecordId: args.callRecordId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Failed to create call",
      });
    }
  },
});

// ---------- Internal Mutations ----------

export const INTERNAL_updateCallStatus = internalMutation({
  args: {
    callRecordId: v.id("retellCalls"),
    status: v.union(
      v.literal("initiating"),
      v.literal("registered"),
      v.literal("ongoing"),
      v.literal("ended"),
      v.literal("error"),
    ),
    retellCallId: v.optional(v.string()),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    disconnectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { callRecordId, ...updates } = args;
    // Filter out undefined values
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(callRecordId, patch);
  },
});

export const INTERNAL_storeCallResult = internalMutation({
  args: {
    callRecordId: v.id("retellCalls"),
    transcript: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    disconnectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { callRecordId, ...updates } = args;
    const patch: Record<string, any> = { status: "ended" };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(callRecordId, patch);

    // Post transcript into agent chat so the OpenClaw agent has call context
    const callRecord = await ctx.db.get(callRecordId);
    if (callRecord?.agentId && args.transcript) {
      const durationSec = args.durationMs ? Math.round(args.durationMs / 1000) : null;
      const summary = [
        `Voice call ended${durationSec ? ` (${durationSec}s)` : ""}.`,
        args.transcript ? `\nTranscript:\n${args.transcript.slice(0, 4000)}` : "",
      ].join("");

      await ctx.db.insert("agentChatMessages", {
        orgId: callRecord.orgId,
        agentId: callRecord.agentId as any,
        userId: callRecord.userId,
        content: summary,
        role: "system",
        status: "delivered",
        timestamp: Date.now(),
      });
    }
  },
});

export const INTERNAL_storeCallAnalysis = internalMutation({
  args: {
    callRecordId: v.id("retellCalls"),
    summary: v.optional(v.string()),
    sentiment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { callRecordId, ...updates } = args;
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(callRecordId, patch);
    }
  },
});

// Find call record by Retell call ID (used by webhook)
export const INTERNAL_getCallByRetellId = internalQuery({
  args: { retellCallId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("retellCalls")
      .withIndex("retellCallId", (q) => q.eq("retellCallId", args.retellCallId))
      .unique();
  },
});

// ---------- Inbound Call Support ----------

// Resolve default org context (single-tenant: first org + its owner)
export const INTERNAL_getDefaultOrgContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const org = await ctx.db.query("organizations").first();
    if (!org) return null;

    const membership = await ctx.db
      .query("memberships")
      .withIndex("orgId", (q) => q.eq("orgId", org._id))
      .first();
    if (!membership) return null;

    return { orgId: org._id, userId: membership.userId };
  },
});

// Create a call record for inbound calls (no pre-existing record)
export const INTERNAL_createInboundCallRecord = internalMutation({
  args: {
    retellCallId: v.string(),
    retellAgentId: v.optional(v.string()),
    fromNumber: v.optional(v.string()),
    toNumber: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Resolve org context
    const org = await ctx.db.query("organizations").first();
    if (!org) throw new Error("No organization found");

    const membership = await ctx.db
      .query("memberships")
      .withIndex("orgId", (q) => q.eq("orgId", org._id))
      .first();
    if (!membership) throw new Error("No org member found");

    return await ctx.db.insert("retellCalls", {
      orgId: org._id,
      userId: membership.userId,
      agentId: "max",
      retellCallId: args.retellCallId,
      retellAgentId: args.retellAgentId || "inbound",
      fromNumber: args.fromNumber || "inbound",
      toNumber: args.toNumber || "inbound",
      status: "ongoing",
      direction: "inbound",
      metadata: args.metadata,
    });
  },
});

// ---------- Max Voice Agent Tool-Call Functions ----------

export const INTERNAL_getTeamStatus = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const allTasks = await ctx.db
      .query("agentTasks")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Group tasks by agent
    const agentMap: Record<string, { total: number; in_progress: number; blocked: number; done: number }> = {};
    for (const task of allTasks) {
      if (!agentMap[task.agentId]) {
        agentMap[task.agentId] = { total: 0, in_progress: 0, blocked: 0, done: 0 };
      }
      agentMap[task.agentId].total++;
      if (task.status === "in_progress") agentMap[task.agentId].in_progress++;
      if (task.status === "blocked") agentMap[task.agentId].blocked++;
      if (task.status === "done") agentMap[task.agentId].done++;
    }

    const lines: string[] = [];
    for (const [agentId, counts] of Object.entries(agentMap)) {
      const active = counts.in_progress > 0 ? `${counts.in_progress} active` : "idle";
      const blocked = counts.blocked > 0 ? `, ${counts.blocked} blocked` : "";
      lines.push(`${agentId}: ${active}${blocked}, ${counts.done}/${counts.total} done`);
    }

    return lines.length > 0 ? lines.join("\n") : "No tasks assigned to any agents yet.";
  },
});

export const INTERNAL_getRecentActivityForMax = internalQuery({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const activity = await ctx.db
      .query("agentActivity")
      .withIndex("orgId_timestamp", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit || 10);

    return activity
      .map((a) => `[${a.agentId}] ${a.action}: ${a.target || ""}`)
      .join("\n") || "No recent activity.";
  },
});

export const INTERNAL_createTaskFromMax = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    agentId: v.string(),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("agentTasks", {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      agentId: args.agentId as any,
      status: "todo",
      priority: (args.priority as any) || "medium",
      createdBy: args.userId,
      assignedTo: args.userId,
      tags: ["from-max", "voice-created"],
    });

    await ctx.db.insert("agentActivity", {
      orgId: args.orgId,
      agentId: args.agentId as any,
      action: "task_created",
      target: `${args.title} [via Max voice call]`,
      taskId,
      timestamp: Date.now(),
    });

    return taskId;
  },
});

export const INTERNAL_sendAgentMessage = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    agentId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentChatMessages", {
      orgId: args.orgId,
      agentId: args.agentId as any,
      userId: args.userId,
      content: `[From Max, via voice call] ${args.message}`,
      role: "user",
      status: "delivered",
      timestamp: Date.now(),
    });

    return `Message sent to ${args.agentId}`;
  },
});

export const INTERNAL_handoffTaskFromMax = internalMutation({
  args: {
    orgId: v.id("organizations"),
    taskId: v.id("agentTasks"),
    toAgentId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return "Task not found";

    await ctx.db.patch(args.taskId, {
      handoffFrom: task.agentId,
      handoffTo: args.toAgentId as any,
      handoffNote: args.note || "Reassigned by Max via voice call",
      status: "todo",
    });

    await ctx.db.insert("agentActivity", {
      orgId: args.orgId,
      agentId: task.agentId,
      action: "task_handoff_sent",
      target: `${task.title} → ${args.toAgentId} [via Max voice call]`,
      taskId: args.taskId,
      timestamp: Date.now(),
    });

    return `Task "${task.title}" handed off to ${args.toAgentId}`;
  },
});

export const INTERNAL_logToolCall = internalMutation({
  args: {
    orgId: v.id("organizations"),
    functionName: v.string(),
    args: v.optional(v.any()),
    result: v.optional(v.string()),
    retellCallId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentActivity", {
      orgId: args.orgId,
      agentId: "max" as any,
      action: "voice_tool_call",
      target: `${args.functionName}${args.result ? `: ${args.result.slice(0, 200)}` : ""}`,
      timestamp: Date.now(),
    });
  },
});

export const INTERNAL_searchKnowledgeBase = internalAction({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    // Get all org collections
    const orgCollections: any[] = await ctx.runQuery(
      internal.collections.getCollectionsByOrgId,
      { orgId: args.orgId },
    );
    const collectionIds: any[] = orgCollections.map((c: any) => c._id);

    if (collectionIds.length === 0) {
      return "No knowledge base documents found. Upload documents to the knowledge base first.";
    }

    const results: any[] = await ctx.runAction(internal.rag.internalSearchCatalog, {
      userId: args.userId,
      collectionIds,
      query: args.query,
      limit: args.limit || 8,
    });

    if (results.length === 0) {
      return `No relevant documents found for "${args.query}".`;
    }

    return results
      .map((r: any, i: number) => `[${i + 1}] ${r.documentName || "Doc"}: ${(r.content || "").slice(0, 500)}`)
      .join("\n\n");
  },
});

// ---------- Retell LLM Provisioning ----------

const MAX_SYSTEM_PROMPT = `You are Max, the Operations Director at Modern Phase — a done-for-you software service business. You are the boss's right hand. When Scott calls you, he expects quick, confident answers and immediate action.

## Your Personality
- Direct and efficient — no fluff, no filler
- Confident but not robotic — you sound like a sharp operations manager on a phone call
- You call the team by name and know who does what
- When you take action, confirm what you did briefly. Don't over-explain.
- Keep responses conversational and concise — this is a phone call, not an email

## Your Team
- Larry — Sales & Marketing (lead gen, outreach, cold email, content, social media)
- Oliver — Operations (project management, scheduling, timelines, standups, admin)
- Fiona — Finance & Legal (invoicing, cash flow, contracts, SOWs, MSAs)
- Taylor — Delivery (architecture, design, code, UI/UX, QA, estimation)

## What You Can Do
You have real-time access to the company's systems. Use your tools:

- **get_team_status** — Check what every agent is working on, task counts, blockers. Use this when Scott asks "how's the team?" or "what's going on?"
- **get_agent_tasks** — Pull up a specific agent's task list. Use agent_id (lowercase: larry, oliver, fiona, taylor). Can filter by status.
- **create_task** — Create and assign a task to any agent. Always confirm the title and who it's assigned to.
- **get_projects** — List all active projects with status and client names.
- **send_agent_message** — Send a message to any agent's chat on Scott's behalf. Good for instructions, follow-ups, or questions.
- **get_recent_activity** — See what's happened recently across the team.
- **search_knowledge_base** — Search internal docs: contract templates, email sequences, SOWs, proposals, processes. Use when Scott asks about anything that might be documented.
- **handoff_task** — Move a task from one agent to another.

## How to Handle Requests
- If Scott asks about status or what's happening, call get_team_status or get_recent_activity first, then summarize verbally.
- If he wants something done, create the task immediately — don't ask for confirmation unless the request is genuinely ambiguous.
- If he asks you to tell an agent something, use send_agent_message.
- If Scott asks about contracts, templates, email sequences, processes, or terms — search the knowledge base first, then summarize what you found.
- If a task needs to move to a different agent, use handoff_task.
- If you're unsure which agent should handle something, make your best judgment based on their roles and tell Scott who you're assigning it to.

## Important
- Always use lowercase agent IDs in tool calls: larry, oliver, fiona, taylor
- Keep spoken responses under 3 sentences when possible
- When executing a tool, say something brief like "Let me check..." or "On it..." so there's no dead air`;

function buildMaxTools(functionsUrl: string) {
  return [
    {
      type: "custom",
      name: "get_team_status",
      description: "Get the current status of all agents — task counts, active work, and blockers.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Let me pull up the team status.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
    {
      type: "custom",
      name: "get_agent_tasks",
      description: "Get the task list for a specific agent. Use lowercase agent_id: larry, oliver, fiona, taylor.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Let me check their tasks.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {
          agent_id: { type: "string", description: "The agent ID (lowercase): larry, oliver, fiona, taylor" },
          status: { type: "string", description: "Optional filter: backlog, todo, in_progress, review, blocked, done" },
        },
        required: ["agent_id"],
      },
    },
    {
      type: "custom",
      name: "create_task",
      description: "Create a new task and assign it to an agent.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Creating that task now.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {
          title: { type: "string", description: "Short task title" },
          agent_id: { type: "string", description: "Agent to assign to (lowercase)" },
          description: { type: "string", description: "Detailed description of what needs to be done" },
          priority: { type: "string", description: "Priority: low, medium, high, urgent. Default: medium" },
        },
        required: ["title", "agent_id"],
      },
    },
    {
      type: "custom",
      name: "get_projects",
      description: "List all active projects with their status and client names.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Pulling up the projects.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
    {
      type: "custom",
      name: "send_agent_message",
      description: "Send a message to an agent's chat on Scott's behalf.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Sending that message now.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {
          agent_id: { type: "string", description: "Agent to message (lowercase)" },
          message: { type: "string", description: "The message content to send" },
        },
        required: ["agent_id", "message"],
      },
    },
    {
      type: "custom",
      name: "get_recent_activity",
      description: "See recent activity across the team — task updates, handoffs, completions.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Let me check recent activity.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {
          limit: { type: "number", description: "Number of recent activities to fetch. Default: 10" },
        },
        required: [] as string[],
      },
    },
    {
      type: "custom",
      name: "search_knowledge_base",
      description: "Search internal documents, contract templates, email sequences, SOWs, proposals, and any uploaded knowledge base files. Use this when Scott asks about company docs, templates, terms, processes, or anything that might be documented.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Let me look that up in our docs.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 15000,
      parameters: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "What to search for — be specific (e.g. 'payment terms in MSA', 'onboarding email sequence', 'contract cancellation clause')" },
        },
        required: ["query"],
      },
    },
    {
      type: "custom",
      name: "handoff_task",
      description: "Reassign a task from one agent to another.",
      url: functionsUrl,
      speak_during_execution: true,
      execution_message_description: "Say something brief like 'Moving that task over now.'",
      execution_message_type: "prompt" as const,
      timeout_ms: 10000,
      parameters: {
        type: "object" as const,
        properties: {
          task_id: { type: "string", description: "The task ID to reassign" },
          to_agent_id: { type: "string", description: "Agent to hand off to (lowercase)" },
          note: { type: "string", description: "Optional note explaining the handoff" },
        },
        required: ["task_id", "to_agent_id"],
      },
    },
  ];
}

export const INTERNAL_provisionMaxLlm = internalAction({
  args: {},
  handler: async () => {
    if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
      throw new Error("RETELL_API_KEY and RETELL_AGENT_ID must be set");
    }

    const functionsUrl = "https://kindhearted-echidna-765.convex.site/retell/functions";

    // 1. Fetch the agent to get its current response_engine / llm_id
    const agentRes = await fetch(`https://api.retellai.com/get-agent/${RETELL_AGENT_ID}`, {
      headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
    });
    if (!agentRes.ok) {
      throw new Error(`Failed to fetch agent: ${agentRes.status} ${await agentRes.text()}`);
    }
    const agent = await agentRes.json();

    const tools = buildMaxTools(functionsUrl);

    let llmId = agent.response_engine?.llm_id;

    if (llmId) {
      // 2a. Update existing LLM
      const updateRes = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
        body: JSON.stringify({
          general_prompt: MAX_SYSTEM_PROMPT,
          general_tools: tools,
          begin_message: "Hey Scott, it's Max. What do you need?",
        }),
      });
      if (!updateRes.ok) {
        throw new Error(`Failed to update LLM: ${updateRes.status} ${await updateRes.text()}`);
      }
      const updated = await updateRes.json();
      console.log(`[Max LLM] Updated LLM ${llmId}`, updated);
      return { action: "updated", llmId };
    } else {
      // 2b. Create new LLM
      const createRes = await fetch("https://api.retellai.com/create-retell-llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
        body: JSON.stringify({
          general_prompt: MAX_SYSTEM_PROMPT,
          general_tools: tools,
          begin_message: "Hey Scott, it's Max. What do you need?",
          model: "gpt-4o",
          model_temperature: 0.3,
        }),
      });
      if (!createRes.ok) {
        throw new Error(`Failed to create LLM: ${createRes.status} ${await createRes.text()}`);
      }
      const created = await createRes.json();
      llmId = created.llm_id;
      console.log(`[Max LLM] Created LLM ${llmId}`);

      // 3. Attach LLM to agent
      const patchRes = await fetch(`https://api.retellai.com/update-agent/${RETELL_AGENT_ID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
        body: JSON.stringify({
          response_engine: {
            type: "retell-llm",
            llm_id: llmId,
          },
          agent_name: "Max — Operations Director",
        }),
      });
      if (!patchRes.ok) {
        console.warn(`[Max LLM] Failed to attach LLM to agent: ${patchRes.status} ${await patchRes.text()}`);
      }
      return { action: "created", llmId };
    }
  },
});

// ---------- Helper ----------

async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}
