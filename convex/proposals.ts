// convex/proposals.ts — Proposal management: CRUD, send, public accept/reject

import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { SITE_URL } from "./env";
import { sendProposalSentEmail } from "./email/templates/proposalEmail";

// ========== AUTH HELPER ==========

async function getAuthUserId(ctx: any): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

// ========== INTERNAL ==========

export const INTERNAL_createProposalFromTemplate = internalMutation({
  args: {
    orgId: v.id("organizations"),
    leadId: v.id("crmLeads"),
    templateId: v.optional(v.id("projectTemplates")),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    let sections: any[] = [];
    if (args.templateId) {
      const template = await ctx.db.get(args.templateId);
      if (template) {
        // Group tasks by department-like tags
        const grouped: Record<string, any[]> = {};
        for (const task of template.taskTemplates) {
          const dept = task.tags[0] || "General";
          if (!grouped[dept]) grouped[dept] = [];
          grouped[dept].push(task);
        }
        sections = Object.entries(grouped).map(([dept, tasks]) => ({
          title: dept,
          description: `${dept} deliverables`,
          items: tasks.map((t) => ({
            description: t.title,
            quantity: 1,
            unitPrice: 0,
            total: 0,
          })),
        }));
      }
    }

    if (sections.length === 0) {
      sections = [{
        title: "Services",
        description: "Proposed services for " + lead.company,
        items: [{
          description: "Professional services",
          quantity: 1,
          unitPrice: lead.value ?? 0,
          total: lead.value ?? 0,
        }],
      }];
    }

    const totalValue = lead.value ?? sections.reduce(
      (sum: number, s: any) => sum + s.items.reduce((iSum: number, item: any) => iSum + item.total, 0),
      0,
    );

    const accessToken = crypto.randomUUID();

    return await ctx.db.insert("proposals", {
      orgId: args.orgId,
      leadId: args.leadId,
      title: `Proposal for ${lead.company}`,
      clientName: lead.contactName,
      clientEmail: lead.contactEmail ?? "",
      sections,
      totalValue,
      currency: lead.currency ?? "usd",
      status: "draft",
      validUntil: Date.now() + 30 * 86400000, // 30 days
      accessToken,
      templateId: args.templateId,
      createdBy: args.createdBy,
    });
  },
});

export const INTERNAL_markViewed = internalMutation({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const proposal = await ctx.db
      .query("proposals")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
    if (proposal && proposal.status === "sent") {
      await ctx.db.patch(proposal._id, { status: "viewed" });
    }
  },
});

export const INTERNAL_acceptProposal = internalMutation({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const proposal = await ctx.db
      .query("proposals")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "sent" && proposal.status !== "viewed") {
      throw new Error("Proposal cannot be accepted in current state");
    }

    await ctx.db.patch(proposal._id, {
      status: "accepted",
      acceptedAt: Date.now(),
    });

    // Log CRM activity
    if (proposal.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: proposal.orgId,
        leadId: proposal.leadId,
        type: "note",
        title: `Proposal "${proposal.title}" accepted`,
        userId: proposal.createdBy,
        timestamp: Date.now(),
      });
    }

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: proposal.createdBy,
      orgId: proposal.orgId,
      type: "proposal_accepted",
      title: "Proposal accepted",
      body: `${proposal.clientName} accepted "${proposal.title}"`,
      resourceType: "proposal",
      resourceId: String(proposal._id),
    });

    // Fire workflow trigger
    await ctx.scheduler.runAfter(0, internal.workflows.INTERNAL_processWorkflowTrigger, {
      orgId: proposal.orgId,
      trigger: "proposal_status_change",
      context: {
        proposalId: String(proposal._id),
        proposalStatus: "accepted",
        clientName: proposal.clientName,
        clientEmail: proposal.clientEmail,
        totalValue: proposal.totalValue,
      },
      userId: proposal.createdBy,
    });
  },
});

export const INTERNAL_rejectProposal = internalMutation({
  args: { accessToken: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const proposal = await ctx.db
      .query("proposals")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
    if (!proposal) throw new Error("Proposal not found");

    await ctx.db.patch(proposal._id, {
      status: "rejected",
      rejectedAt: Date.now(),
      notes: args.reason ? `Rejection reason: ${args.reason}` : proposal.notes,
    });

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: proposal.createdBy,
      orgId: proposal.orgId,
      type: "proposal_rejected",
      title: "Proposal rejected",
      body: `${proposal.clientName} rejected "${proposal.title}"${args.reason ? `: ${args.reason}` : ""}`,
      resourceType: "proposal",
      resourceId: String(proposal._id),
    });
  },
});

// ========== QUERIES ==========

export const getProposals = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("proposals")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  },
});

export const getProposal = query({
  args: { proposalId: v.id("proposals") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(args.proposalId);
  },
});

export const getProposalByToken = query({
  args: { accessToken: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    // No auth required — public access via token
    return await ctx.db
      .query("proposals")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
  },
});

// ========== MUTATIONS ==========

export const createProposal = mutation({
  args: {
    orgId: v.id("organizations"),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    title: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    sections: v.array(v.object({
      title: v.string(),
      description: v.string(),
      items: v.array(v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      })),
    })),
    currency: v.string(),
    validUntil: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("proposals"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const totalValue = args.sections.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.total, 0),
      0,
    );

    const accessToken = crypto.randomUUID();

    return await ctx.db.insert("proposals", {
      orgId: args.orgId,
      leadId: args.leadId,
      projectId: args.projectId,
      title: args.title,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      sections: args.sections,
      totalValue,
      currency: args.currency,
      status: "draft",
      validUntil: args.validUntil,
      accessToken,
      notes: args.notes,
      createdBy: userId,
    });
  },
});

export const updateProposal = mutation({
  args: {
    proposalId: v.id("proposals"),
    title: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    sections: v.optional(v.array(v.object({
      title: v.string(),
      description: v.string(),
      items: v.array(v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      })),
    }))),
    validUntil: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");

    const patch: Record<string, any> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.clientName !== undefined) patch.clientName = args.clientName;
    if (args.clientEmail !== undefined) patch.clientEmail = args.clientEmail;
    if (args.validUntil !== undefined) patch.validUntil = args.validUntil;
    if (args.notes !== undefined) patch.notes = args.notes;

    if (args.sections !== undefined) {
      patch.sections = args.sections;
      patch.totalValue = args.sections.reduce(
        (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.total, 0),
        0,
      );
    }

    await ctx.db.patch(args.proposalId, patch);
    return true;
  },
});

export const deleteProposal = mutation({
  args: { proposalId: v.id("proposals") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "draft") throw new Error("Can only delete draft proposals");

    await ctx.db.delete(args.proposalId);
    return true;
  },
});

// ========== ACTIONS ==========

export const sendProposal = action({
  args: { proposalId: v.id("proposals") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const proposal = await ctx.runQuery(internal.proposals.getProposalInternal, { proposalId: args.proposalId });
    if (!proposal) throw new Error("Proposal not found");

    const viewUrl = `${SITE_URL}/p/${proposal.accessToken}`;

    await sendProposalSentEmail({
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      proposalTitle: proposal.title,
      totalValue: `$${proposal.totalValue.toFixed(2)}`,
      validUntil: new Date(proposal.validUntil).toLocaleDateString(),
      viewUrl,
    });

    await ctx.runMutation(internal.proposals.INTERNAL_markSent, {
      proposalId: args.proposalId,
    });

    return true;
  },
});

// Internal helpers for actions
export const getProposalInternal = internalQuery({
  args: { proposalId: v.id("proposals") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.proposalId);
  },
});

export const INTERNAL_markSent = internalMutation({
  args: { proposalId: v.id("proposals") },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) return;

    await ctx.db.patch(args.proposalId, { status: "sent" });

    if (proposal.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: proposal.orgId,
        leadId: proposal.leadId,
        type: "proposal_sent",
        title: `Proposal "${proposal.title}" sent`,
        description: `Total value: $${proposal.totalValue.toFixed(2)}`,
        userId: proposal.createdBy,
        timestamp: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: proposal.createdBy,
      orgId: proposal.orgId,
      type: "proposal_sent",
      title: "Proposal sent",
      body: `"${proposal.title}" sent to ${proposal.clientName}`,
      resourceType: "proposal",
      resourceId: String(args.proposalId),
    });
  },
});
