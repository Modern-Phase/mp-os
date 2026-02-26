// convex/contracts.ts — Contract management: CRUD, templates, send, sign

import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { SITE_URL } from "./env";
import { sendContractSentEmail } from "./email/templates/contractEmail";

// ========== CONTRACT TEMPLATES ==========

export const CONTRACT_TEMPLATES: Record<string, { name: string; content: string }> = {
  msa: {
    name: "Master Service Agreement",
    content: `# Master Service Agreement

This Master Service Agreement ("Agreement") is entered into as of {{startDate}} by and between:

**Modern Phase** ("Service Provider")
and
**{{clientName}}** ("Client")

## 1. Services
Service Provider agrees to provide the services as described in any Statement of Work (SOW) executed under this Agreement.

## 2. Term
This Agreement shall commence on {{startDate}} and continue until terminated by either party with 30 days written notice.

## 3. Payment
Client agrees to pay Service Provider in accordance with the payment terms specified in each SOW. Unless otherwise stated, payment is due within 30 days of invoice date.

## 4. Confidentiality
Both parties agree to keep confidential all non-public information disclosed during the engagement.

## 5. Intellectual Property
Upon full payment, all deliverables created under this Agreement shall be owned by the Client. Service Provider retains the right to use general knowledge, skills, and experience gained during the engagement.

## 6. Limitation of Liability
Service Provider's total liability shall not exceed the total fees paid under this Agreement in the 12 months preceding the claim.

## 7. Governing Law
This Agreement shall be governed by the laws of the jurisdiction where Service Provider is established.

---

**Service Provider:** Modern Phase
**Client:** {{clientName}}
**Date:** {{startDate}}`,
  },
  sow: {
    name: "Statement of Work",
    content: `# Statement of Work

**Project:** {{projectName}}
**Client:** {{clientName}}
**Date:** {{startDate}}

## 1. Project Overview
This Statement of Work describes the deliverables and timeline for the {{projectName}} project.

## 2. Deliverables
{{deliverables}}

## 3. Timeline
Work will commence upon execution of this SOW and is expected to be completed within the agreed timeline.

## 4. Investment
Total project value: {{totalValue}}

Payment schedule:
- 50% upon SOW execution
- 50% upon project delivery

## 5. Acceptance
Deliverables will be subject to Client review and approval within 5 business days of delivery.

---

**Service Provider:** Modern Phase
**Client:** {{clientName}}
**Date:** {{startDate}}`,
  },
  creative_services: {
    name: "Creative Services Agreement",
    content: `# Creative Services Agreement

This Creative Services Agreement is entered into as of {{startDate}} by and between:

**Modern Phase** ("Agency")
and
**{{clientName}}** ("Client")

## 1. Creative Services
Agency will provide creative services including but not limited to: design, branding, content creation, and digital marketing as agreed upon in writing.

## 2. Creative Process
- Discovery & strategy phase
- Concept development (up to 3 rounds of revisions)
- Final delivery in agreed formats

## 3. Usage Rights
Upon full payment, Client receives exclusive rights to use all delivered creative assets for their business purposes.

## 4. Compensation
As outlined in the accompanying proposal or invoice.

## 5. Revisions
Up to 3 rounds of revisions are included. Additional revisions will be billed at the Agency's standard hourly rate.

---

**Agency:** Modern Phase
**Client:** {{clientName}}
**Date:** {{startDate}}`,
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

export const INTERNAL_createContractFromTemplate = internalMutation({
  args: {
    orgId: v.id("organizations"),
    leadId: v.optional(v.id("crmLeads")),
    proposalId: v.optional(v.id("proposals")),
    templateKey: v.string(),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const template = CONTRACT_TEMPLATES[args.templateKey];
    if (!template) throw new Error(`Unknown template: ${args.templateKey}`);

    let clientName = "Client";
    let clientEmail = "";
    let projectName = "";
    let deliverables = "";
    let totalValue = "";

    if (args.leadId) {
      const lead = await ctx.db.get(args.leadId);
      if (lead) {
        clientName = lead.contactName;
        clientEmail = lead.contactEmail ?? "";
        projectName = lead.company;
        totalValue = lead.value ? `$${lead.value.toFixed(2)}` : "TBD";
      }
    }

    if (args.proposalId) {
      const proposal = await ctx.db.get(args.proposalId);
      if (proposal) {
        clientName = proposal.clientName;
        clientEmail = proposal.clientEmail;
        totalValue = `$${proposal.totalValue.toFixed(2)}`;
        deliverables = proposal.sections.map((s: any) =>
          s.items.map((i: any) => `- ${i.description}`).join("\n"),
        ).join("\n");
      }
    }

    const startDate = new Date().toLocaleDateString();
    const content = template.content
      .replace(/\{\{clientName\}\}/g, clientName)
      .replace(/\{\{startDate\}\}/g, startDate)
      .replace(/\{\{projectName\}\}/g, projectName || "Project")
      .replace(/\{\{deliverables\}\}/g, deliverables || "- As agreed")
      .replace(/\{\{totalValue\}\}/g, totalValue || "TBD");

    const accessToken = crypto.randomUUID();

    return await ctx.db.insert("contracts", {
      orgId: args.orgId,
      leadId: args.leadId,
      proposalId: args.proposalId,
      title: `${template.name} — ${clientName}`,
      clientName,
      clientEmail,
      content,
      status: "draft",
      accessToken,
      templateKey: args.templateKey,
      createdBy: args.createdBy,
    });
  },
});

export const INTERNAL_markViewed = internalMutation({
  args: { accessToken: v.string() },
  handler: async (ctx, args) => {
    const contract = await ctx.db
      .query("contracts")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
    if (contract && contract.status === "sent") {
      await ctx.db.patch(contract._id, { status: "viewed", viewedAt: Date.now() });
    }
  },
});

export const INTERNAL_recordSignature = internalMutation({
  args: {
    accessToken: v.string(),
    signatureName: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db
      .query("contracts")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
    if (!contract) throw new Error("Contract not found");
    if (contract.status !== "sent" && contract.status !== "viewed") {
      throw new Error("Contract cannot be signed in current state");
    }

    await ctx.db.patch(contract._id, {
      status: "signed",
      signedAt: Date.now(),
      signatureData: {
        name: args.signatureName,
        agreedAt: Date.now(),
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
    });

    // Log CRM activity
    if (contract.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: contract.orgId,
        leadId: contract.leadId,
        type: "contract_sent",
        title: `Contract "${contract.title}" signed`,
        description: `Signed by ${args.signatureName}`,
        userId: contract.createdBy,
        timestamp: Date.now(),
      });
    }

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: contract.createdBy,
      orgId: contract.orgId,
      type: "contract_signed",
      title: "Contract signed",
      body: `${contract.clientName} signed "${contract.title}"`,
      resourceType: "contract",
      resourceId: String(contract._id),
    });

    // Fire workflow trigger
    await ctx.scheduler.runAfter(0, internal.workflows.INTERNAL_processWorkflowTrigger, {
      orgId: contract.orgId,
      trigger: "contract_status_change",
      context: {
        contractId: String(contract._id),
        contractStatus: "signed",
        clientName: contract.clientName,
        clientEmail: contract.clientEmail,
      },
      userId: contract.createdBy,
    });
  },
});

// ========== QUERIES ==========

export const getContracts = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("contracts")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  },
});

export const getContract = query({
  args: { contractId: v.id("contracts") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(args.contractId);
  },
});

export const getContractByToken = query({
  args: { accessToken: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contracts")
      .withIndex("accessToken", (q: any) => q.eq("accessToken", args.accessToken))
      .unique();
  },
});

export const getContractTemplates = query({
  args: {},
  returns: v.array(v.any()),
  handler: async () => {
    return Object.entries(CONTRACT_TEMPLATES).map(([key, t]) => ({
      key,
      name: t.name,
    }));
  },
});

// ========== MUTATIONS ==========

export const createContract = mutation({
  args: {
    orgId: v.id("organizations"),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    proposalId: v.optional(v.id("proposals")),
    title: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    content: v.string(),
    templateKey: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("contracts"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const accessToken = crypto.randomUUID();

    return await ctx.db.insert("contracts", {
      orgId: args.orgId,
      leadId: args.leadId,
      projectId: args.projectId,
      proposalId: args.proposalId,
      title: args.title,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      content: args.content,
      status: "draft",
      accessToken,
      templateKey: args.templateKey,
      expiresAt: args.expiresAt,
      createdBy: userId,
    });
  },
});

export const updateContract = mutation({
  args: {
    contractId: v.id("contracts"),
    title: v.optional(v.string()),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    content: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    if (contract.status !== "draft") throw new Error("Can only edit draft contracts");

    const patch: Record<string, any> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.clientName !== undefined) patch.clientName = args.clientName;
    if (args.clientEmail !== undefined) patch.clientEmail = args.clientEmail;
    if (args.content !== undefined) patch.content = args.content;
    if (args.expiresAt !== undefined) patch.expiresAt = args.expiresAt;

    await ctx.db.patch(args.contractId, patch);
    return true;
  },
});

export const deleteContract = mutation({
  args: { contractId: v.id("contracts") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract not found");
    if (contract.status !== "draft") throw new Error("Can only delete draft contracts");

    await ctx.db.delete(args.contractId);
    return true;
  },
});

// ========== ACTIONS ==========

export const sendContract = action({
  args: { contractId: v.id("contracts") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const contract = await ctx.runQuery(internal.contracts.getContractInternal, { contractId: args.contractId });
    if (!contract) throw new Error("Contract not found");

    const viewUrl = `${SITE_URL}/c/${contract.accessToken}`;

    await sendContractSentEmail({
      clientName: contract.clientName,
      clientEmail: contract.clientEmail,
      contractTitle: contract.title,
      viewUrl,
    });

    await ctx.runMutation(internal.contracts.INTERNAL_markSent, {
      contractId: args.contractId,
    });

    return true;
  },
});

// Internal helpers for actions
export const getContractInternal = internalQuery({
  args: { contractId: v.id("contracts") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contractId);
  },
});

export const INTERNAL_markSent = internalMutation({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return;

    await ctx.db.patch(args.contractId, { status: "sent", sentAt: Date.now() });

    if (contract.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: contract.orgId,
        leadId: contract.leadId,
        type: "contract_sent",
        title: `Contract "${contract.title}" sent`,
        userId: contract.createdBy,
        timestamp: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: contract.createdBy,
      orgId: contract.orgId,
      type: "contract_sent",
      title: "Contract sent",
      body: `"${contract.title}" sent to ${contract.clientName}`,
      resourceType: "contract",
      resourceId: String(args.contractId),
    });
  },
});
