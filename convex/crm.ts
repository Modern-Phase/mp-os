// convex/crm.ts — CRM queries and mutations for lead/deal pipeline

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { pipelineStageValidator, leadSourceValidator, crmActivityTypeValidator, agentIdValidator } from "./schema";

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
