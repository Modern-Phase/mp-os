// convex/proposals.ts — Proposal management: CRUD, send, public accept/reject

import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { SITE_URL } from "./env";
import { sendProposalSentEmail } from "./email/templates/proposalEmail";

// ========== PROPOSAL TEMPLATES ==========

export const PROPOSAL_TEMPLATES: Record<string, {
  name: string;
  sections: { title: string; description: string; items: { description: string; quantity: number; unitPrice: number; total: number }[] }[];
}> = {
  website_build: {
    name: "Website Design & Development",
    sections: [
      {
        title: "Discovery & Strategy",
        description: "Research, competitor analysis, and project planning",
        items: [
          { description: "Stakeholder interviews & requirements gathering", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Competitor & market analysis", quantity: 1, unitPrice: 1000, total: 1000 },
          { description: "Information architecture & sitemap", quantity: 1, unitPrice: 800, total: 800 },
        ],
      },
      {
        title: "Design",
        description: "UI/UX design, prototyping, and brand alignment",
        items: [
          { description: "Wireframes (up to 10 pages)", quantity: 1, unitPrice: 2500, total: 2500 },
          { description: "High-fidelity mockups", quantity: 1, unitPrice: 3500, total: 3500 },
          { description: "Design system & component library", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Responsive design (mobile, tablet, desktop)", quantity: 1, unitPrice: 1000, total: 1000 },
        ],
      },
      {
        title: "Development",
        description: "Frontend and backend implementation",
        items: [
          { description: "Frontend development (React/Next.js)", quantity: 1, unitPrice: 5000, total: 5000 },
          { description: "CMS integration", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "SEO optimization & performance tuning", quantity: 1, unitPrice: 1200, total: 1200 },
          { description: "Cross-browser testing & QA", quantity: 1, unitPrice: 800, total: 800 },
        ],
      },
      {
        title: "Launch & Handoff",
        description: "Deployment, training, and post-launch support",
        items: [
          { description: "Deployment & DNS configuration", quantity: 1, unitPrice: 500, total: 500 },
          { description: "Client training session (2 hours)", quantity: 1, unitPrice: 500, total: 500 },
          { description: "30-day post-launch support", quantity: 1, unitPrice: 1000, total: 1000 },
        ],
      },
    ],
  },

  branding: {
    name: "Branding & Identity",
    sections: [
      {
        title: "Brand Discovery",
        description: "Understanding your business, audience, and market position",
        items: [
          { description: "Brand audit & competitive analysis", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Target audience personas", quantity: 1, unitPrice: 1000, total: 1000 },
          { description: "Brand strategy & positioning document", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
      },
      {
        title: "Visual Identity",
        description: "Logo, color palette, typography, and visual system",
        items: [
          { description: "Logo design (3 concepts, 3 revision rounds)", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "Color palette & typography selection", quantity: 1, unitPrice: 1000, total: 1000 },
          { description: "Icon & illustration style guide", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Social media templates (5 formats)", quantity: 1, unitPrice: 1200, total: 1200 },
        ],
      },
      {
        title: "Brand Guidelines",
        description: "Comprehensive brand book for consistent usage",
        items: [
          { description: "Brand guidelines document (PDF)", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "Business card & letterhead design", quantity: 1, unitPrice: 800, total: 800 },
          { description: "Email signature templates", quantity: 1, unitPrice: 400, total: 400 },
        ],
      },
    ],
  },

  mobile_app: {
    name: "Mobile App Development",
    sections: [
      {
        title: "Product Strategy",
        description: "Defining the app concept, features, and technical approach",
        items: [
          { description: "Product requirements document", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "User flow mapping", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Technical architecture planning", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
      {
        title: "UX/UI Design",
        description: "Interface design and interactive prototyping",
        items: [
          { description: "Wireframes (all screens)", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "High-fidelity UI design", quantity: 1, unitPrice: 5000, total: 5000 },
          { description: "Interactive prototype (Figma)", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
      },
      {
        title: "Development",
        description: "Native or cross-platform app build",
        items: [
          { description: "Core app development (React Native)", quantity: 1, unitPrice: 15000, total: 15000 },
          { description: "API development & integration", quantity: 1, unitPrice: 5000, total: 5000 },
          { description: "Push notifications & analytics", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "Authentication & user management", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
      },
      {
        title: "Testing & Launch",
        description: "QA, app store submission, and post-launch",
        items: [
          { description: "QA testing (iOS & Android)", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "App Store & Play Store submission", quantity: 1, unitPrice: 1000, total: 1000 },
          { description: "60-day post-launch support & bug fixes", quantity: 1, unitPrice: 3000, total: 3000 },
        ],
      },
    ],
  },

  consulting: {
    name: "Strategic Consulting",
    sections: [
      {
        title: "Assessment",
        description: "Comprehensive review of current state and opportunities",
        items: [
          { description: "Current systems & process audit", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "Stakeholder interviews (up to 10)", quantity: 10, unitPrice: 200, total: 2000 },
          { description: "Technology stack evaluation", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
      },
      {
        title: "Strategy & Recommendations",
        description: "Actionable roadmap and strategic plan",
        items: [
          { description: "Strategic recommendations report", quantity: 1, unitPrice: 5000, total: 5000 },
          { description: "Technology roadmap (12-month)", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "Implementation priority matrix", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
      {
        title: "Executive Presentation",
        description: "Findings presentation and Q&A session",
        items: [
          { description: "Executive presentation deck", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "Presentation & workshop session (half day)", quantity: 1, unitPrice: 2500, total: 2500 },
        ],
      },
    ],
  },

  retainer: {
    name: "Monthly Retainer Services",
    sections: [
      {
        title: "Ongoing Development",
        description: "Dedicated development hours each month",
        items: [
          { description: "Development hours (per month)", quantity: 40, unitPrice: 150, total: 6000 },
          { description: "Project management & coordination", quantity: 1, unitPrice: 1000, total: 1000 },
        ],
      },
      {
        title: "Maintenance & Support",
        description: "Keeping your systems running and up to date",
        items: [
          { description: "Bug fixes & issue resolution", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Security updates & monitoring", quantity: 1, unitPrice: 800, total: 800 },
          { description: "Performance monitoring & optimization", quantity: 1, unitPrice: 700, total: 700 },
        ],
      },
      {
        title: "Strategic Advisory",
        description: "Monthly check-ins and roadmap alignment",
        items: [
          { description: "Monthly strategy call (1 hour)", quantity: 1, unitPrice: 500, total: 500 },
          { description: "Quarterly roadmap review", quantity: 0.33, unitPrice: 1500, total: 500 },
        ],
      },
    ],
  },

  custom_software: {
    name: "Custom Software Development",
    sections: [
      {
        title: "Requirements & Architecture",
        description: "Detailed specifications and system design",
        items: [
          { description: "Requirements analysis & documentation", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "System architecture design", quantity: 1, unitPrice: 4000, total: 4000 },
          { description: "Database schema & API design", quantity: 1, unitPrice: 2500, total: 2500 },
          { description: "Security & compliance planning", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
      {
        title: "Core Development",
        description: "Building the application, sprint by sprint",
        items: [
          { description: "Backend development", quantity: 1, unitPrice: 12000, total: 12000 },
          { description: "Frontend development", quantity: 1, unitPrice: 10000, total: 10000 },
          { description: "Third-party integrations", quantity: 1, unitPrice: 4000, total: 4000 },
          { description: "Authentication & authorization", quantity: 1, unitPrice: 2000, total: 2000 },
        ],
      },
      {
        title: "Quality Assurance",
        description: "Testing, security audits, and performance validation",
        items: [
          { description: "Automated test suite", quantity: 1, unitPrice: 3000, total: 3000 },
          { description: "Manual QA & regression testing", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "Security audit & penetration testing", quantity: 1, unitPrice: 2500, total: 2500 },
          { description: "Load testing & performance benchmarks", quantity: 1, unitPrice: 1500, total: 1500 },
        ],
      },
      {
        title: "Deployment & Handoff",
        description: "Production deployment, documentation, and training",
        items: [
          { description: "CI/CD pipeline setup", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "Production deployment & monitoring", quantity: 1, unitPrice: 1500, total: 1500 },
          { description: "Technical documentation", quantity: 1, unitPrice: 2000, total: 2000 },
          { description: "Team training sessions (2 sessions)", quantity: 2, unitPrice: 1000, total: 2000 },
          { description: "90-day warranty & support", quantity: 1, unitPrice: 3000, total: 3000 },
        ],
      },
    ],
  },
};

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

export const getProposalsByLead = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("proposals")
      .withIndex("leadId", (q: any) => q.eq("leadId", args.leadId))
      .collect();
  },
});

export const getProposalTemplates = query({
  args: {},
  returns: v.array(v.any()),
  handler: async () => {
    return Object.entries(PROPOSAL_TEMPLATES).map(([key, t]) => ({
      key,
      name: t.name,
      sectionCount: t.sections.length,
      totalValue: t.sections.reduce(
        (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.total, 0),
        0,
      ),
    }));
  },
});

// ========== MUTATIONS ==========

export const createProposalFromTemplate = mutation({
  args: {
    orgId: v.id("organizations"),
    templateKey: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    validUntil: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("proposals"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const template = PROPOSAL_TEMPLATES[args.templateKey];
    if (!template) throw new Error(`Unknown template: ${args.templateKey}`);

    const sections = template.sections.map((s) => ({
      ...s,
      items: s.items.map((item) => ({ ...item })),
    }));

    const totalValue = sections.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.total, 0),
      0,
    );

    const accessToken = crypto.randomUUID();

    return await ctx.db.insert("proposals", {
      orgId: args.orgId,
      leadId: args.leadId,
      projectId: args.projectId,
      title: `${template.name} — ${args.clientName}`,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      sections,
      totalValue,
      currency: "usd",
      status: "draft",
      validUntil: args.validUntil ?? Date.now() + 30 * 86400000,
      accessToken,
      notes: args.notes,
      createdBy: userId,
    });
  },
});

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
