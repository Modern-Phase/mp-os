// convex/agents.ts — Agent system queries and mutations

import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { agentIdValidator, taskStatusValidator, priorityValidator, AGENT_IDS } from "./schema";

// ========== AGENT DEFINITIONS ==========

const AGENT_DEFINITIONS: Record<string, {
  agentId: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  department: string;
  description: string;
  expertise: string[];
  isActive: boolean;
  soulPath: string;
}> = {
  [AGENT_IDS.LARRY]: {
    agentId: AGENT_IDS.LARRY,
    name: "Larry",
    role: "Sales & Marketing",
    emoji: "🤖",
    color: "#3B82F6",
    department: "sales",
    description: "Owns the full sales pipeline — lead gen, outreach, content, and marketing",
    expertise: ["Prospect Research", "List Building", "Cold Email", "LinkedIn DMs", "Follow-up Sequences", "Content Strategy", "Social Media", "Case Studies"],
    isActive: true,
    soulPath: "agents/larry/SOUL.md",
  },
  [AGENT_IDS.OLIVER]: {
    agentId: AGENT_IDS.OLIVER,
    name: "Oliver",
    role: "Operations",
    emoji: "📋",
    color: "#10B981",
    department: "ops",
    description: "Keeps everything running — projects, scheduling, standups, and admin",
    expertise: ["Project Management", "Timeline Tracking", "Risk Assessment", "Standups", "Calendar Management", "Meeting Notes", "Reminders", "Action Items"],
    isActive: true,
    soulPath: "agents/oliver/SOUL.md",
  },
  [AGENT_IDS.FIONA]: {
    agentId: AGENT_IDS.FIONA,
    name: "Fiona",
    role: "Finance & Legal",
    emoji: "💵",
    color: "#059669",
    department: "finance",
    description: "Watches the money and protects the business — invoicing, contracts, cash flow",
    expertise: ["Invoicing", "Revenue Tracking", "Cash Flow", "Forecasting", "SOWs", "MSAs", "Contract Review", "Templates"],
    isActive: true,
    soulPath: "agents/fiona/SOUL.md",
  },
  [AGENT_IDS.TAYLOR]: {
    agentId: AGENT_IDS.TAYLOR,
    name: "Taylor",
    role: "Delivery",
    emoji: "⚡",
    color: "#EF4444",
    department: "delivery",
    description: "Owns delivery end-to-end — architecture, design, code, and QA",
    expertise: ["Architecture", "Estimation", "Tech Stack", "Code Review", "UI/UX", "Brand Assets", "Design Review", "Design Systems"],
    isActive: true,
    soulPath: "agents/taylor/SOUL.md",
  },
  [AGENT_IDS.MAX]: {
    agentId: AGENT_IDS.MAX,
    name: "Max",
    role: "Operations Director",
    emoji: "👔",
    color: "#1E40AF",
    department: "management",
    description: "Your voice-enabled point of contact — manages the team, delegates work, reports status",
    expertise: ["Team Management", "Task Delegation", "Status Reporting", "Cross-Department Coordination"],
    isActive: true,
    soulPath: "agents/max/SOUL.md",
  },
};

// ========== INTERNAL QUERIES ==========

// Used by Max voice agent custom functions (no auth — internal only)
export const INTERNAL_getAgentTasksUnauth = internalQuery({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    status: v.optional(taskStatusValidator),
  },
  handler: async (ctx, args) => {
    let tasks = await ctx.db
      .query("agentTasks")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    if (args.status) {
      tasks = tasks.filter((t) => t.status === args.status);
    }

    return tasks.sort((a, b) => b._creationTime - a._creationTime).slice(0, 20);
  },
});

export const INTERNAL_getProjectsUnauth = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentProjects")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// Used by dispatchChatMessage to read per-agent RAG collection config
export const getAgentConfig = internalQuery({
  args: { agentId: agentIdValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

// ========== QUERIES ==========

export const getAgents = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const hardcoded = Object.values(AGENT_DEFINITIONS);

    // Merge custom agents from DB (user-created instances)
    const customAgents = await ctx.db
      .query("agents")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const activeCustom = customAgents
      .filter((a) => a.isCustom && a.isActive)
      .map((a) => ({
        agentId: a.agentId,
        name: a.name,
        role: a.role,
        emoji: a.emoji,
        color: a.color,
        department: a.department,
        description: a.description,
        expertise: a.expertise,
        isActive: a.isActive,
        isCustom: true,
        soulPath: a.soulPath,
      }));

    return [...hardcoded, ...activeCustom];
  },
});

export const getAgent = query({
  args: {
    orgId: v.id("organizations"),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check hardcoded agents first
    const hardcoded = AGENT_DEFINITIONS[args.agentId as keyof typeof AGENT_DEFINITIONS];
    if (hardcoded) return hardcoded;

    // Check DB for custom agents
    const custom = await ctx.db
      .query("agents")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .first();
    return custom || null;
  },
});

export const getAgentTasks = query({
  args: { 
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    status: v.optional(taskStatusValidator),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let tasks = await ctx.db
      .query("agentTasks")
      .withIndex("agentId", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();
    
    if (args.status) {
      tasks = tasks.filter((t) => t.status === args.status);
    }
    
    return tasks.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getAllTasks = query({
  args: { 
    orgId: v.id("organizations"),
    status: v.optional(taskStatusValidator),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let tasks = await ctx.db
      .query("agentTasks")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    
    if (args.status) {
      tasks = tasks.filter((t) => t.status === args.status);
    }
    
    return tasks.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getProjects = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentProjects")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const getGlobalContext = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentContext")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .first();
  },
});

export const getRecentActivity = query({
  args: { 
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentActivity")
      .withIndex("orgId_timestamp", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// Helper to get authenticated user
async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

// ========== MUTATIONS ==========

export const createTask = mutation({
  args: {
    orgId: v.id("organizations"),
    title: v.string(),
    description: v.string(),
    agentId: agentIdValidator,
    priority: v.optional(priorityValidator),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    projectId: v.optional(v.id("agentProjects")),
    context: v.optional(v.string()),
  },
  returns: v.id("agentTasks"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const taskId = await ctx.db.insert("agentTasks", {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      agentId: args.agentId,
      status: "todo",
      priority: args.priority || "medium",
      context: args.context,
      createdBy: userId,
      assignedTo: userId,
      dueDate: args.dueDate,
      tags: args.tags || [],
      projectId: args.projectId,
    });

    await ctx.db.insert("agentActivity", {
      orgId: args.orgId,
      agentId: args.agentId,
      action: "task_created",
      target: args.title,
      taskId,
      timestamp: Date.now(),
    });

    return taskId;
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("agentTasks"),
    status: taskStatusValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, {
      status: args.status,
      completedAt: args.status === "done" ? Date.now() : undefined,
    });

    await ctx.db.insert("agentActivity", {
      orgId: task.orgId,
      agentId: task.agentId,
      action: `task_${args.status}`,
      target: task.title,
      taskId: args.taskId,
      timestamp: Date.now(),
    });

    // Notify task creator when completed
    if (args.status === "done" && task.createdBy) {
      const agentDef = AGENT_DEFINITIONS[task.agentId];
      await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
        userId: task.createdBy,
        orgId: task.orgId,
        type: "task_completed",
        title: "Task completed",
        body: `${agentDef?.emoji || ""} ${agentDef?.name || task.agentId} completed "${task.title}"`,
        resourceType: "task",
        resourceId: String(args.taskId),
        agentId: task.agentId,
      });
    }

    return true;
  },
});

export const handoffTask = mutation({
  args: {
    taskId: v.id("agentTasks"),
    toAgentId: agentIdValidator,
    note: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, {
      handoffFrom: task.agentId,
      handoffTo: args.toAgentId,
      handoffNote: args.note,
      status: "todo",
    });

    await ctx.db.insert("agentActivity", {
      orgId: task.orgId,
      agentId: task.agentId,
      action: "task_handoff_sent",
      target: `${task.title} → ${args.toAgentId}`,
      taskId: args.taskId,
      timestamp: Date.now(),
    });

    // Notify task assignee about handoff
    const fromAgent = AGENT_DEFINITIONS[task.agentId];
    const toAgent = AGENT_DEFINITIONS[args.toAgentId];
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: task.assignedTo,
      orgId: task.orgId,
      type: "task_handoff",
      title: "Task handoff",
      body: `${fromAgent?.emoji || ""} ${fromAgent?.name || task.agentId} handed off "${task.title}" to ${toAgent?.emoji || ""} ${toAgent?.name || args.toAgentId}${args.note ? `: ${args.note}` : ""}`,
      resourceType: "task",
      resourceId: String(args.taskId),
      agentId: args.toAgentId,
    });

    return true;
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.id("agentTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    agentId: v.optional(agentIdValidator),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    context: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const patch: Record<string, any> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.agentId !== undefined) patch.agentId = args.agentId;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.tags !== undefined) patch.tags = args.tags;
    if (args.context !== undefined) patch.context = args.context;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.taskId, patch);
    }

    await ctx.db.insert("agentActivity", {
      orgId: task.orgId,
      agentId: args.agentId || task.agentId,
      action: "task_updated",
      target: args.title || task.title,
      taskId: args.taskId,
      timestamp: Date.now(),
    });

    return true;
  },
});

export const deleteTask = mutation({
  args: {
    taskId: v.id("agentTasks"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.delete(args.taskId);

    await ctx.db.insert("agentActivity", {
      orgId: task.orgId,
      agentId: task.agentId,
      action: "task_deleted",
      target: task.title,
      timestamp: Date.now(),
    });

    return true;
  },
});

// ========== HANDOFF INBOX ==========

export const getHandoffInbox = query({
  args: {
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("agentTasks")
      .withIndex("handoffTo", (q) => q.eq("handoffTo", args.agentId))
      .filter((q) => q.eq(q.field("orgId"), args.orgId))
      .collect();

    return tasks.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const acceptHandoff = mutation({
  args: {
    taskId: v.id("agentTasks"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (!task.handoffTo) throw new Error("No pending handoff");

    const toAgentId = task.handoffTo;

    await ctx.db.patch(args.taskId, {
      agentId: toAgentId,
      handoffFrom: undefined,
      handoffTo: undefined,
      handoffNote: undefined,
    });

    await ctx.db.insert("agentActivity", {
      orgId: task.orgId,
      agentId: toAgentId,
      action: "task_handoff_accepted",
      target: task.title,
      taskId: args.taskId,
      timestamp: Date.now(),
    });

    // Notify task creator
    const toAgent = AGENT_DEFINITIONS[toAgentId];
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: task.createdBy,
      orgId: task.orgId,
      type: "task_handoff",
      title: "Handoff accepted",
      body: `${toAgent?.emoji || ""} ${toAgent?.name || toAgentId} accepted "${task.title}"`,
      resourceType: "task",
      resourceId: String(args.taskId),
      agentId: toAgentId,
    });

    return true;
  },
});

export const rejectHandoff = mutation({
  args: {
    taskId: v.id("agentTasks"),
    reason: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (!task.handoffFrom || !task.handoffTo) throw new Error("No pending handoff");

    const fromAgentId = task.handoffFrom;
    const toAgentId = task.handoffTo;

    await ctx.db.patch(args.taskId, {
      agentId: fromAgentId,
      handoffFrom: undefined,
      handoffTo: undefined,
      handoffNote: undefined,
    });

    await ctx.db.insert("agentActivity", {
      orgId: task.orgId,
      agentId: toAgentId,
      action: "task_handoff_rejected",
      target: `${task.title}${args.reason ? ` — ${args.reason}` : ""}`,
      taskId: args.taskId,
      timestamp: Date.now(),
    });

    // Notify task creator
    const toAgent = AGENT_DEFINITIONS[toAgentId];
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: task.createdBy,
      orgId: task.orgId,
      type: "task_handoff",
      title: "Handoff rejected",
      body: `${toAgent?.emoji || ""} ${toAgent?.name || toAgentId} rejected "${task.title}"${args.reason ? `: ${args.reason}` : ""}`,
      resourceType: "task",
      resourceId: String(args.taskId),
      agentId: fromAgentId,
    });

    return true;
  },
});

export const getProjectOverview = query({
  args: { projectId: v.id("agentProjects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const tasks = await ctx.db
      .query("agentTasks")
      .withIndex("projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const activity = await ctx.db
      .query("agentActivity")
      .withIndex("orgId_timestamp", (q) => q.eq("orgId", project.orgId))
      .order("desc")
      .take(50)
      .then((items) => items.filter((a) => a.projectId === args.projectId));

    // Find linked CRM lead
    const leads = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q) => q.eq("orgId", project.orgId))
      .collect();
    const linkedLead = leads.find((l) => l.projectId === args.projectId);

    const tasksByStatus = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    };

    return { project, tasks, tasksByStatus, activity, linkedLead };
  },
});

export const getProjectTasks = query({
  args: { projectId: v.id("agentProjects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentTasks")
      .withIndex("projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const updateProject = mutation({
  args: {
    projectId: v.id("agentProjects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("planning"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("delivered"),
    )),
    progress: v.optional(v.number()),
    targetDate: v.optional(v.number()),
    agents: v.optional(v.array(agentIdValidator)),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const { projectId, ...updates } = args;
    const patch: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) patch[key] = val;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.projectId, patch);
    }

    // Fire workflow trigger on status change
    if (args.status && args.status !== project.status) {
      await ctx.scheduler.runAfter(0, internal.workflows.INTERNAL_processWorkflowTrigger, {
        orgId: project.orgId,
        trigger: "project_status_change",
        context: {
          projectId: String(args.projectId),
          projectStatus: args.status,
          previousStatus: project.status,
          client: project.client,
          projectName: project.name,
        },
        userId,
      });
    }

    return true;
  },
});

export const deleteProject = mutation({
  args: {
    projectId: v.id("agentProjects"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    // Unlink tasks from this project (don't delete them)
    const tasks = await ctx.db
      .query("agentTasks")
      .withIndex("projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const task of tasks) {
      await ctx.db.patch(task._id, { projectId: undefined });
    }

    // Unlink any CRM leads tied to this project
    const leads = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q) => q.eq("orgId", project.orgId))
      .collect();
    for (const lead of leads) {
      if (lead.projectId === args.projectId) {
        await ctx.db.patch(lead._id, { projectId: undefined });
      }
    }

    await ctx.db.delete(args.projectId);

    await ctx.db.insert("agentActivity", {
      orgId: project.orgId,
      agentId: project.agents[0] || ("oliver" as any),
      action: "project_deleted",
      target: project.name,
      timestamp: Date.now(),
    });

    return true;
  },
});

export const createProject = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    client: v.string(),
    description: v.string(),
    targetDate: v.number(),
    agents: v.array(agentIdValidator),
  },
  returns: v.id("agentProjects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return await ctx.db.insert("agentProjects", {
      orgId: args.orgId,
      name: args.name,
      client: args.client,
      description: args.description,
      status: "planning",
      startDate: Date.now(),
      targetDate: args.targetDate,
      agents: args.agents,
      progress: 0,
      createdBy: userId,
    });
  },
});
