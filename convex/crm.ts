// convex/crm.ts — CRM queries and mutations for lead/deal pipeline

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { pipelineStageValidator, leadSourceValidator, crmActivityTypeValidator, agentIdValidator, AgentId } from "./schema";
import { getQuickWinTemplate } from "./quickWinTemplates";

// ========== AUTH HELPER ==========

async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

// ========== QUERIES ==========

export const getLeads = query({
  args: {
    orgId: v.id("organizations"),
    stage: v.optional(pipelineStageValidator),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    let leads;
    if (args.stage) {
      leads = await ctx.db
        .query("crmLeads")
        .withIndex("orgId_stage", (q: any) => q.eq("orgId", args.orgId).eq("stage", args.stage))
        .collect();
    } else {
      leads = await ctx.db
        .query("crmLeads")
        .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
        .collect();
    }
    return leads.sort((a: any, b: any) => b._creationTime - a._creationTime);
  },
});

export const getLead = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.leadId);
  },
});

export const getLeadActivities = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crmActivities")
      .withIndex("leadId_timestamp", (q: any) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
  },
});

export const getPipelineStats = query({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const leads = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    const stages: Record<string, { count: number; value: number }> = {};
    let totalValue = 0;

    for (const lead of leads) {
      if (!stages[lead.stage]) {
        stages[lead.stage] = { count: 0, value: 0 };
      }
      stages[lead.stage].count++;
      if (lead.value) {
        stages[lead.stage].value += lead.value;
        if (lead.stage !== "lost") {
          totalValue += lead.value;
        }
      }
    }

    return { stages, totalLeads: leads.length, totalValue };
  },
});

export const getCrmAnalytics = query({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const leads = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    const activities = await ctx.db
      .query("crmActivities")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    // KPIs
    let totalPipelineValue = 0;
    let wonCount = 0;
    let lostCount = 0;
    let wonValue = 0;
    let totalCycleDays = 0;
    let closedWithCycleCount = 0;

    // Pipeline funnel
    const stages: Record<string, { count: number; value: number }> = {};
    const stageOrder = ["new_lead", "qualified", "discovery", "proposal", "negotiation", "won", "lost"];
    for (const s of stageOrder) {
      stages[s] = { count: 0, value: 0 };
    }

    // Source breakdown
    const sources: Record<string, { count: number; value: number; won: number; total: number }> = {};

    // Agent performance
    const agentPerf: Record<string, { dealsWon: number; totalValue: number; cycleDays: number; cycleCount: number }> = {};

    for (const lead of leads) {
      const val = lead.value || 0;

      // Stage funnel
      if (stages[lead.stage]) {
        stages[lead.stage].count++;
        stages[lead.stage].value += val;
      }

      // Pipeline value (exclude lost)
      if (lead.stage !== "lost") {
        totalPipelineValue += val;
      }

      // Win/loss
      if (lead.stage === "won") {
        wonCount++;
        wonValue += val;
      } else if (lead.stage === "lost") {
        lostCount++;
      }

      // Cycle time (for closed deals)
      if ((lead.stage === "won" || lead.stage === "lost") && lead.closedAt) {
        const cycleDays = (lead.closedAt - lead._creationTime) / 86400000;
        totalCycleDays += cycleDays;
        closedWithCycleCount++;
      }

      // Source breakdown
      const src = lead.source || "other";
      if (!sources[src]) {
        sources[src] = { count: 0, value: 0, won: 0, total: 0 };
      }
      sources[src].count++;
      sources[src].value += val;
      sources[src].total++;
      if (lead.stage === "won") sources[src].won++;

      // Agent performance
      if (lead.assignedAgent) {
        if (!agentPerf[lead.assignedAgent]) {
          agentPerf[lead.assignedAgent] = { dealsWon: 0, totalValue: 0, cycleDays: 0, cycleCount: 0 };
        }
        if (lead.stage === "won") {
          agentPerf[lead.assignedAgent].dealsWon++;
          agentPerf[lead.assignedAgent].totalValue += val;
          if (lead.closedAt) {
            agentPerf[lead.assignedAgent].cycleDays += (lead.closedAt - lead._creationTime) / 86400000;
            agentPerf[lead.assignedAgent].cycleCount++;
          }
        }
      }
    }

    const closedTotal = wonCount + lostCount;
    const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;
    const lossRate = closedTotal > 0 ? Math.round((lostCount / closedTotal) * 100) : 0;
    const avgDealSize = wonCount > 0 ? Math.round(wonValue / wonCount) : 0;
    const avgCycleTimeDays = closedWithCycleCount > 0 ? Math.round(totalCycleDays / closedWithCycleCount) : 0;

    // Source breakdown with conversion rates
    const sourceBreakdown = Object.entries(sources).map(([source, data]) => ({
      source,
      count: data.count,
      value: data.value,
      won: data.won,
      conversionRate: data.total > 0 ? Math.round((data.won / data.total) * 100) : 0,
    }));

    // Agent performance
    const agentPerformance = Object.entries(agentPerf).map(([agentId, data]) => ({
      agentId,
      dealsWon: data.dealsWon,
      totalValue: data.totalValue,
      avgCycleTime: data.cycleCount > 0 ? Math.round(data.cycleDays / data.cycleCount) : 0,
    }));

    // Activity distribution
    const activityDist: Record<string, number> = {};
    for (const act of activities) {
      activityDist[act.type] = (activityDist[act.type] || 0) + 1;
    }
    const activityDistribution = Object.entries(activityDist).map(([type, count]) => ({
      type,
      count,
    }));

    // Monthly trend (last 6 months)
    const now = Date.now();
    const monthlyTrend: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
      const count = leads.filter(
        (l) => l._creationTime >= monthStart && l._creationTime < monthEnd,
      ).length;
      monthlyTrend.push({
        month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        count,
      });
    }

    // Pipeline funnel as array
    const pipelineFunnel = stageOrder.map((stage) => ({
      stage,
      label: stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count: stages[stage].count,
      value: stages[stage].value,
    }));

    return {
      kpis: { totalPipelineValue, winRate, lossRate, avgDealSize, avgCycleTimeDays, totalLeads: leads.length, wonCount, lostCount },
      pipelineFunnel,
      sourceBreakdown,
      agentPerformance,
      activityDistribution,
      monthlyTrend,
    };
  },
});

// ========== MUTATIONS ==========

export const createLead = mutation({
  args: {
    orgId: v.id("organizations"),
    company: v.string(),
    contactName: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactLinkedin: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    stage: v.optional(pipelineStageValidator),
    source: leadSourceValidator,
    value: v.optional(v.number()),
    description: v.optional(v.string()),
    assignedAgent: v.optional(agentIdValidator),
  },
  returns: v.id("crmLeads"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const leadId = await ctx.db.insert("crmLeads", {
      orgId: args.orgId,
      company: args.company,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      contactLinkedin: args.contactLinkedin,
      contactTitle: args.contactTitle,
      website: args.website,
      address: args.address,
      stage: args.stage || "new_lead",
      source: args.source,
      value: args.value,
      currency: "usd",
      description: args.description,
      assignedAgent: args.assignedAgent,
      tags: [],
      createdBy: userId,
    });

    // Log CRM activity
    await ctx.db.insert("crmActivities", {
      orgId: args.orgId,
      leadId,
      type: "note",
      title: "Lead created",
      description: `New lead: ${args.company} (${args.contactName})`,
      userId,
      agentId: args.assignedAgent,
      timestamp: Date.now(),
    });

    // Log to agent activity if agent assigned
    if (args.assignedAgent) {
      await ctx.db.insert("agentActivity", {
        orgId: args.orgId,
        agentId: args.assignedAgent,
        action: "lead_created",
        target: `${args.company} — ${args.contactName}`,
        timestamp: Date.now(),
      });
    }

    return leadId;
  },
});

export const updateLead = mutation({
  args: {
    leadId: v.id("crmLeads"),
    company: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactLinkedin: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    source: v.optional(leadSourceValidator),
    value: v.optional(v.number()),
    description: v.optional(v.string()),
    nextStep: v.optional(v.string()),
    nextFollowUp: v.optional(v.number()),
    assignedAgent: v.optional(agentIdValidator),
    tags: v.optional(v.array(v.string())),
    lostReason: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const { leadId, ...updates } = args;
    const patch: Record<string, any> = {};
    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) patch[key] = val;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.leadId, patch);
    }

    await ctx.db.insert("crmActivities", {
      orgId: lead.orgId,
      leadId: args.leadId,
      type: "note",
      title: "Lead updated",
      userId,
      agentId: args.assignedAgent || lead.assignedAgent,
      timestamp: Date.now(),
    });

    return true;
  },
});

export const updateLeadStage = mutation({
  args: {
    leadId: v.id("crmLeads"),
    stage: pipelineStageValidator,
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const patch: Record<string, any> = { stage: args.stage };
    if (args.stage === "won" || args.stage === "lost") {
      patch.closedAt = Date.now();
    }

    await ctx.db.patch(args.leadId, patch);

    // Log CRM activity
    await ctx.db.insert("crmActivities", {
      orgId: lead.orgId,
      leadId: args.leadId,
      type: "status_change",
      title: `Stage changed to ${args.stage.replace(/_/g, " ")}`,
      description: `${lead.company}: ${lead.stage} → ${args.stage}`,
      userId,
      agentId: lead.assignedAgent,
      timestamp: Date.now(),
    });

    // Log to agent activity
    if (lead.assignedAgent) {
      await ctx.db.insert("agentActivity", {
        orgId: lead.orgId,
        agentId: lead.assignedAgent,
        action: `lead_${args.stage}`,
        target: `${lead.company} — ${lead.contactName}`,
        timestamp: Date.now(),
      });
    }

    // Notify lead creator about stage change (if different from current user)
    if (lead.createdBy !== userId) {
      await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
        userId: lead.createdBy,
        orgId: lead.orgId,
        type: "lead_stage_change",
        title: "Lead stage changed",
        body: `${lead.company}: ${lead.stage.replace(/_/g, " ")} → ${args.stage.replace(/_/g, " ")}`,
        resourceType: "lead",
        resourceId: String(args.leadId),
        agentId: lead.assignedAgent,
      });
    }

    return true;
  },
});

export const deleteLead = mutation({
  args: { leadId: v.id("crmLeads") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    // Delete associated activities
    const activities = await ctx.db
      .query("crmActivities")
      .withIndex("leadId", (q: any) => q.eq("leadId", args.leadId))
      .collect();
    for (const activity of activities) {
      await ctx.db.delete(activity._id);
    }

    await ctx.db.delete(args.leadId);

    if (lead.assignedAgent) {
      await ctx.db.insert("agentActivity", {
        orgId: lead.orgId,
        agentId: lead.assignedAgent,
        action: "lead_deleted",
        target: `${lead.company} — ${lead.contactName}`,
        timestamp: Date.now(),
      });
    }

    return true;
  },
});

export const addActivity = mutation({
  args: {
    leadId: v.id("crmLeads"),
    type: crmActivityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    agentId: v.optional(agentIdValidator),
  },
  returns: v.id("crmActivities"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    const activityId = await ctx.db.insert("crmActivities", {
      orgId: lead.orgId,
      leadId: args.leadId,
      type: args.type,
      title: args.title,
      description: args.description,
      agentId: args.agentId || lead.assignedAgent,
      userId,
      timestamp: Date.now(),
    });

    // Log to agent activity
    const agentId = args.agentId || lead.assignedAgent;
    if (agentId) {
      await ctx.db.insert("agentActivity", {
        orgId: lead.orgId,
        agentId,
        action: `crm_${args.type}`,
        target: `${lead.company}: ${args.title}`,
        timestamp: Date.now(),
      });
    }

    return activityId;
  },
});

// ========== DEAL-TO-DELIVERY CONVERSION ==========

export const convertLeadToProject = mutation({
  args: {
    leadId: v.id("crmLeads"),
    projectName: v.string(),
    client: v.string(),
    description: v.string(),
    targetDate: v.number(),
    templateId: v.optional(v.id("projectTemplates")),
    quickWinTemplateId: v.optional(v.string()),
  },
  returns: v.id("agentProjects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // 1. Fetch lead
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");
    if (lead.projectId) throw new Error("Lead already has a linked project");

    // 2. Fetch template if provided
    let template: any = null;
    let uniqueAgentIds: AgentId[] = [];
    if (args.templateId) {
      template = await ctx.db.get(args.templateId);
      if (template) {
        const agentSet = new Set<AgentId>();
        for (const task of template.taskTemplates) {
          agentSet.add(task.agentId);
        }
        uniqueAgentIds = Array.from(agentSet);
      }
    }

    // 3. Create project
    const projectId = await ctx.db.insert("agentProjects", {
      orgId: lead.orgId,
      name: args.projectName,
      client: args.client,
      description: args.description,
      status: "planning",
      startDate: Date.now(),
      targetDate: args.targetDate,
      agents: uniqueAgentIds,
      progress: 0,
      createdBy: userId,
    });

    // 4. Patch lead → won with projectId
    await ctx.db.patch(args.leadId, {
      stage: "won",
      closedAt: Date.now(),
      projectId,
    });

    // 5. Create tasks from template
    if (template) {
      for (const task of template.taskTemplates) {
        await ctx.db.insert("agentTasks", {
          orgId: lead.orgId,
          title: task.title,
          description: task.description,
          agentId: task.agentId,
          status: "todo",
          priority: task.priority,
          tags: task.tags,
          projectId,
          createdBy: userId,
          assignedTo: userId,
        });
      }
    }

    // 5b. Create Quick Win task if selected
    if (args.quickWinTemplateId) {
      const qwTemplate = getQuickWinTemplate(args.quickWinTemplateId);
      if (qwTemplate) {
        await ctx.db.insert("agentTasks", {
          orgId: lead.orgId,
          title: `⚡ ${qwTemplate.name} — ${args.client}`,
          description: qwTemplate.description,
          agentId: qwTemplate.agentId,
          status: "in_progress",
          priority: "urgent",
          tags: ["quick-win"],
          projectId,
          dueDate: Date.now() + 48 * 60 * 60 * 1000, // 48h
          createdBy: userId,
          assignedTo: userId,
        });

        // Add quick win agent to project if not already present
        if (!uniqueAgentIds.includes(qwTemplate.agentId)) {
          uniqueAgentIds.push(qwTemplate.agentId);
          await ctx.db.patch(projectId, { agents: uniqueAgentIds });
        }

        // System chat notification to the quick win agent
        await ctx.db.insert("agentChatMessages", {
          orgId: lead.orgId,
          agentId: qwTemplate.agentId,
          userId,
          content: `⚡ **Quick Win assigned:** ${qwTemplate.name} for **${args.client}**. Due in 48 hours. ${qwTemplate.description}`,
          role: "system",
          status: "delivered",
          timestamp: Date.now(),
        });

        // Log quick win to agent activity
        await ctx.db.insert("agentActivity", {
          orgId: lead.orgId,
          agentId: qwTemplate.agentId,
          action: "quick_win_assigned",
          target: `${qwTemplate.name} — ${args.client}`,
          projectId,
          timestamp: Date.now(),
        });
      }
    }

    // 6. Post system chat notification per unique agent
    for (const agentId of uniqueAgentIds) {
      await ctx.db.insert("agentChatMessages", {
        orgId: lead.orgId,
        agentId,
        userId,
        content: `📋 New project: **${args.projectName}** (${args.client}). You've been assigned tasks — check Mission Control.`,
        role: "system",
        status: "delivered",
        timestamp: Date.now(),
      });
    }

    // 7. Log CRM activity
    await ctx.db.insert("crmActivities", {
      orgId: lead.orgId,
      leadId: args.leadId,
      type: "note",
      title: `Converted to project: ${args.projectName}`,
      description: template
        ? `Created project with ${template.taskTemplates.length} tasks from "${template.name}" template`
        : "Created blank project",
      userId,
      agentId: lead.assignedAgent,
      timestamp: Date.now(),
    });

    // 8. Log agent activity per involved agent
    for (const agentId of uniqueAgentIds) {
      await ctx.db.insert("agentActivity", {
        orgId: lead.orgId,
        agentId,
        action: "project_assigned",
        target: `${args.projectName} — ${args.client}`,
        projectId,
        timestamp: Date.now(),
      });
    }

    return projectId;
  },
});

// ========== BULK IMPORT ==========

export const importLeads = mutation({
  args: {
    orgId: v.id("organizations"),
    leads: v.array(v.object({
      company: v.string(),
      contactName: v.string(),
      contactEmail: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      contactLinkedin: v.optional(v.string()),
      contactTitle: v.optional(v.string()),
      website: v.optional(v.string()),
      address: v.optional(v.string()),
      stage: v.optional(pipelineStageValidator),
      source: leadSourceValidator,
      value: v.optional(v.number()),
      description: v.optional(v.string()),
      assignedAgent: v.optional(agentIdValidator),
      tags: v.optional(v.array(v.string())),
    })),
  },
  returns: v.object({ imported: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Load existing leads for dedup (match on company name within org)
    const existing = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    // Build lookup: lowercase company name → lead doc
    // If email exists, use company+email as key for more precise matching
    const byCompany = new Map<string, any>();
    for (const lead of existing) {
      byCompany.set(lead.company.toLowerCase().trim(), lead);
    }

    let imported = 0;
    let updated = 0;

    for (const lead of args.leads) {
      const key = lead.company.toLowerCase().trim();
      const match = byCompany.get(key);

      if (match) {
        // Update existing lead with new data (only non-empty fields)
        const patch: Record<string, any> = {};
        if (lead.contactName && lead.contactName !== match.contactName) patch.contactName = lead.contactName;
        if (lead.contactEmail && lead.contactEmail !== match.contactEmail) patch.contactEmail = lead.contactEmail;
        if (lead.contactPhone && lead.contactPhone !== match.contactPhone) patch.contactPhone = lead.contactPhone;
        if (lead.contactLinkedin && lead.contactLinkedin !== match.contactLinkedin) patch.contactLinkedin = lead.contactLinkedin;
        if (lead.contactTitle && lead.contactTitle !== match.contactTitle) patch.contactTitle = lead.contactTitle;
        if (lead.website && lead.website !== match.website) patch.website = lead.website;
        if (lead.address && lead.address !== match.address) patch.address = lead.address;
        if (lead.description && lead.description !== match.description) patch.description = lead.description;
        if (lead.value !== undefined && lead.value !== match.value) patch.value = lead.value;
        if (lead.assignedAgent && lead.assignedAgent !== match.assignedAgent) patch.assignedAgent = lead.assignedAgent;
        if (lead.tags && lead.tags.length > 0) {
          const merged = [...new Set([...(match.tags || []), ...lead.tags])];
          if (merged.length !== (match.tags || []).length) patch.tags = merged;
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(match._id, patch);
          updated++;
        }
      } else {
        // Insert new lead
        const newId = await ctx.db.insert("crmLeads", {
          orgId: args.orgId,
          company: lead.company,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          contactLinkedin: lead.contactLinkedin,
          contactTitle: lead.contactTitle,
          website: lead.website,
          address: lead.address,
          stage: lead.stage || "new_lead",
          source: lead.source,
          value: lead.value,
          currency: "usd",
          description: lead.description,
          assignedAgent: lead.assignedAgent,
          tags: lead.tags || [],
          createdBy: userId,
        });
        // Track for dedup within same batch
        byCompany.set(key, { _id: newId, ...lead, tags: lead.tags || [] });
        imported++;
      }
    }

    return { imported, updated };
  },
});

