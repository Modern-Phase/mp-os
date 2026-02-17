// convex/agents.ts — Agent system queries and mutations

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { agentIdValidator, taskStatusValidator, priorityValidator, AGENT_IDS } from "./schema";

// ========== AGENT DEFINITIONS ==========

const AGENT_DEFINITIONS = {
  [AGENT_IDS.LARRY]: {
    agentId: AGENT_IDS.LARRY,
    name: "Larry",
    role: "Lead Generation Specialist",
    emoji: "🤖",
    color: "#3B82F6",
    department: "sales",
    description: "Finds high-quality leads and builds prospect lists",
    expertise: ["Prospect Research", "List Building", "Signal Detection", "ICP Matching"],
    isActive: true,
    soulPath: "agents/larry/SOUL.md",
  },
  [AGENT_IDS.LEXI]: {
    agentId: AGENT_IDS.LEXI,
    name: "Lexi",
    role: "Outreach & Sales Development",
    emoji: "📧",
    color: "#8B5CF6",
    department: "sales",
    description: "Crafts cold emails and LinkedIn outreach that gets responses",
    expertise: ["Cold Email", "LinkedIn DMs", "Follow-up Sequences", "A/B Testing"],
    isActive: true,
    soulPath: "agents/lexi/SOUL.md",
  },
  [AGENT_IDS.MAYA]: {
    agentId: AGENT_IDS.MAYA,
    name: "Maya",
    role: "Content & Marketing",
    emoji: "📊",
    color: "#EC4899",
    department: "sales",
    description: "Creates content and marketing that builds authority",
    expertise: ["Content Strategy", "Social Media", "Case Studies", "Landing Pages"],
    isActive: true,
    soulPath: "agents/maya/SOUL.md",
  },
  [AGENT_IDS.OLIVER]: {
    agentId: AGENT_IDS.OLIVER,
    name: "Oliver",
    role: "Operations Manager",
    emoji: "📋",
    color: "#10B981",
    department: "ops",
    description: "Keeps projects on track and surfaces blockers",
    expertise: ["Project Management", "Timeline Tracking", "Risk Assessment", "Standups"],
    isActive: true,
    soulPath: "agents/oliver/SOUL.md",
  },
  [AGENT_IDS.SAM]: {
    agentId: AGENT_IDS.SAM,
    name: "Sam",
    role: "Scheduling & Admin",
    emoji: "📅",
    color: "#F59E0B",
    department: "ops",
    description: "Manages calendar, meetings, and reminders",
    expertise: ["Calendar Management", "Meeting Notes", "Reminders", "Action Items"],
    isActive: true,
    soulPath: "agents/sam/SOUL.md",
  },
  [AGENT_IDS.FIONA]: {
    agentId: AGENT_IDS.FIONA,
    name: "Fiona",
    role: "Finance Controller",
    emoji: "💵",
    color: "#059669",
    department: "finance",
    description: "Watches the money — invoicing, revenue, cash flow",
    expertise: ["Invoicing", "Revenue Tracking", "Cash Flow", "Forecasting"],
    isActive: true,
    soulPath: "agents/fiona/SOUL.md",
  },
  [AGENT_IDS.CARL]: {
    agentId: AGENT_IDS.CARL,
    name: "Carl",
    role: "Contracts & Legal",
    emoji: "🤝",
    color: "#6366F1",
    department: "finance",
    description: "Protects Modern Phase on paper — SOWs, contracts, templates",
    expertise: ["SOWs", "MSAs", "Contract Review", "Templates"],
    isActive: true,
    soulPath: "agents/carl/SOUL.md",
  },
  [AGENT_IDS.TAYLOR]: {
    agentId: AGENT_IDS.TAYLOR,
    name: "Taylor",
    role: "Technical Lead",
    emoji: "⚡",
    color: "#EF4444",
    department: "delivery",
    description: "Makes technical calls — architecture, estimates, stack",
    expertise: ["Architecture", "Estimation", "Tech Stack", "Code Review"],
    isActive: true,
    soulPath: "agents/taylor/SOUL.md",
  },
  [AGENT_IDS.DANA]: {
    agentId: AGENT_IDS.DANA,
    name: "Dana",
    role: "Design Lead",
    emoji: "🎨",
    color: "#EC4899",
    department: "delivery",
    description: "Owns the look and feel — UI/UX, brand, design review",
    expertise: ["UI/UX", "Brand Assets", "Design Review", "Design Systems"],
    isActive: true,
    soulPath: "agents/dana/SOUL.md",
  },
};

// ========== QUERIES ==========

export const getAgents = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return Object.values(AGENT_DEFINITIONS);
  },
});

export const getAgent = query({
  args: { 
    orgId: v.id("organizations"),
    agentId: agentIdValidator 
  },
  returns: v.optional(v.any()),
  handler: async (ctx, args) => {
    return AGENT_DEFINITIONS[args.agentId];
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
      .withIndex("orgId_agentId", (q) => q.eq("orgId", args.orgId).eq("agentId", args.agentId))
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
  returns: v.optional(v.any()),
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
