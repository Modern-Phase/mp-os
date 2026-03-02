// convex/contracts.ts — Contract management: CRUD, templates, send, sign

import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { SITE_URL, DOCUSEAL_API_URL, DOCUSEAL_API_KEY } from "./env";
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

  nda: {
    name: "Non-Disclosure Agreement",
    content: `# Non-Disclosure Agreement (NDA)

This Non-Disclosure Agreement ("Agreement") is entered into as of {{startDate}} by and between:

**Modern Phase** ("Disclosing Party")
and
**{{clientName}}** ("Receiving Party")

## 1. Definition of Confidential Information
"Confidential Information" means any non-public information disclosed by either party, including but not limited to: business plans, technical data, product designs, trade secrets, customer lists, financial information, and proprietary software.

## 2. Obligations
The Receiving Party agrees to:
- Hold all Confidential Information in strict confidence
- Not disclose Confidential Information to any third party without prior written consent
- Use Confidential Information solely for the purpose of evaluating or engaging in a business relationship
- Protect Confidential Information with the same degree of care used for its own confidential information

## 3. Exclusions
Confidential Information does not include information that:
- Is or becomes publicly available through no fault of the Receiving Party
- Was already known to the Receiving Party prior to disclosure
- Is independently developed without use of Confidential Information
- Is disclosed with the prior written approval of the Disclosing Party

## 4. Term
This Agreement shall remain in effect for two (2) years from the date of execution. Obligations regarding Confidential Information disclosed during this term shall survive for an additional two (2) years.

## 5. Return of Information
Upon termination or request, the Receiving Party shall return or destroy all Confidential Information and certify such destruction in writing.

## 6. Remedies
The parties acknowledge that breach of this Agreement may cause irreparable harm, and the Disclosing Party shall be entitled to seek injunctive relief in addition to any other remedies available at law.

## 7. Governing Law
This Agreement shall be governed by the laws of the jurisdiction where the Disclosing Party is established.

---

**Disclosing Party:** Modern Phase
**Receiving Party:** {{clientName}}
**Date:** {{startDate}}`,
  },

  retainer_agreement: {
    name: "Retainer Agreement",
    content: `# Retainer Agreement

This Retainer Agreement ("Agreement") is entered into as of {{startDate}} by and between:

**Modern Phase** ("Service Provider")
and
**{{clientName}}** ("Client")

## 1. Retainer Services
Service Provider will provide ongoing services including but not limited to: software development, maintenance, support, and strategic advisory as outlined below.

## 2. Monthly Hours
Service Provider will allocate a minimum of 40 hours per month dedicated to Client's projects and support needs.

## 3. Compensation
- Monthly retainer fee: {{totalValue}}
- Billed on the 1st of each month, payable within 15 days
- Unused hours do not roll over to the following month
- Additional hours beyond the retainer are billed at $175/hour

## 4. Scope of Work
Services under this retainer include:
{{deliverables}}

## 5. Communication & Reporting
- Dedicated Slack channel for real-time communication
- Weekly status updates every Monday
- Monthly retrospective and roadmap review call
- Access to project management dashboard

## 6. Term & Termination
- Initial term: 3 months from {{startDate}}
- After the initial term, this Agreement auto-renews monthly
- Either party may terminate with 30 days written notice
- Upon termination, Client pays for all work completed through the termination date

## 7. Intellectual Property
All work product created under this Agreement shall be owned by the Client upon full payment. Service Provider retains rights to general tools, frameworks, and methodologies.

---

**Service Provider:** Modern Phase
**Client:** {{clientName}}
**Date:** {{startDate}}`,
  },

  freelancer: {
    name: "Freelancer/Subcontractor Agreement",
    content: `# Independent Contractor Agreement

This Independent Contractor Agreement ("Agreement") is entered into as of {{startDate}} by and between:

**Modern Phase** ("Company")
and
**{{clientName}}** ("Contractor")

## 1. Services
Contractor agrees to perform the following services:
{{deliverables}}

## 2. Compensation
- Total project value: {{totalValue}}
- Payment schedule: 50% upon commencement, 50% upon completion
- Invoices payable within 15 business days of receipt

## 3. Independent Contractor Status
Contractor is an independent contractor, not an employee. Contractor is responsible for their own taxes, insurance, and business expenses. Contractor may set their own working hours and methods.

## 4. Deliverables & Timeline
- Project: {{projectName}}
- Contractor will deliver all work products in the agreed-upon format and timeline
- Contractor will communicate progress at least weekly

## 5. Intellectual Property
- All work product created under this Agreement shall be "work made for hire"
- Contractor assigns all rights, title, and interest to the Company
- Contractor retains rights to pre-existing tools, libraries, and frameworks
- Contractor may include the project in their portfolio with Company's consent

## 6. Confidentiality
Contractor agrees to maintain the confidentiality of all non-public information and shall not disclose proprietary business information to third parties.

## 7. Non-Solicitation
During the term and for 12 months thereafter, Contractor agrees not to directly solicit Company's clients for competing services.

## 8. Termination
Either party may terminate with 14 days written notice. Upon termination, Contractor delivers all completed work and Company pays for work performed to date.

## 9. Liability
Contractor's total liability shall not exceed the fees paid under this Agreement. Neither party shall be liable for indirect, incidental, or consequential damages.

---

**Company:** Modern Phase
**Contractor:** {{clientName}}
**Date:** {{startDate}}`,
  },

  saas_license: {
    name: "SaaS License Agreement",
    content: `# Software as a Service (SaaS) License Agreement

This SaaS License Agreement ("Agreement") is entered into as of {{startDate}} by and between:

**Modern Phase** ("Provider")
and
**{{clientName}}** ("Licensee")

## 1. Service Description
Provider grants Licensee a non-exclusive, non-transferable license to access and use the software platform ("Service") as described in the accompanying proposal or order form.

## 2. Subscription Terms
- Service: {{projectName}}
- Subscription period: 12 months from {{startDate}}
- License fee: {{totalValue}} per year
- Billing: Monthly or annually as agreed

## 3. Access & Users
- Licensee receives access for up to the number of users specified in the order form
- Each user must have a unique login credential
- Licensee is responsible for all activity under their account

## 4. Service Level Agreement (SLA)
- Target uptime: 99.9% (excluding scheduled maintenance)
- Scheduled maintenance windows: Sundays 2:00 AM – 6:00 AM EST
- Support response times: Critical (1 hour), High (4 hours), Normal (1 business day)
- Support channels: Email, in-app chat, and scheduled calls

## 5. Data Ownership & Privacy
- Licensee retains all rights to their data
- Provider will not access Licensee data except to provide the Service or as required by law
- Provider will implement reasonable security measures to protect Licensee data
- Upon termination, Licensee may export their data within 30 days

## 6. Acceptable Use
Licensee agrees not to:
- Reverse engineer, decompile, or disassemble the Service
- Use the Service for unlawful purposes
- Share access credentials with unauthorized users
- Exceed usage limits or attempt to circumvent rate limiting

## 7. Intellectual Property
Provider retains all rights to the Service, including all modifications and improvements. Licensee's feedback may be used to improve the Service without obligation.

## 8. Termination
- Either party may terminate with 60 days written notice
- Provider may terminate immediately for material breach or non-payment
- Upon termination, Licensee's access will be revoked after a 30-day wind-down period

## 9. Limitation of Liability
Provider's total liability shall not exceed the fees paid by Licensee in the 12 months preceding the claim. Provider shall not be liable for indirect, incidental, or consequential damages.

## 10. Governing Law
This Agreement shall be governed by the laws of the jurisdiction where the Provider is established.

---

**Provider:** Modern Phase
**Licensee:** {{clientName}}
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

export const getContractsByLead = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("contracts")
      .withIndex("leadId", (q: any) => q.eq("leadId", args.leadId))
      .collect();
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

export const createContractFromTemplate = mutation({
  args: {
    orgId: v.id("organizations"),
    templateKey: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    proposalId: v.optional(v.id("proposals")),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("contracts"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const template = CONTRACT_TEMPLATES[args.templateKey];
    if (!template) throw new Error(`Unknown template: ${args.templateKey}`);

    const startDate = new Date().toLocaleDateString();
    let deliverables = "- As agreed";
    let totalValue = "TBD";
    let projectName = "Project";

    if (args.proposalId) {
      const proposal = await ctx.db.get(args.proposalId);
      if (proposal) {
        totalValue = `$${proposal.totalValue.toFixed(2)}`;
        deliverables = proposal.sections.map((s: any) =>
          s.items.map((i: any) => `- ${i.description}`).join("\n"),
        ).join("\n");
      }
    }

    if (args.leadId) {
      const lead = await ctx.db.get(args.leadId);
      if (lead) {
        projectName = lead.company;
        if (totalValue === "TBD" && lead.value) totalValue = `$${lead.value.toFixed(2)}`;
      }
    }

    const content = template.content
      .replace(/\{\{clientName\}\}/g, args.clientName)
      .replace(/\{\{startDate\}\}/g, startDate)
      .replace(/\{\{projectName\}\}/g, projectName)
      .replace(/\{\{deliverables\}\}/g, deliverables)
      .replace(/\{\{totalValue\}\}/g, totalValue);

    const accessToken = crypto.randomUUID();

    return await ctx.db.insert("contracts", {
      orgId: args.orgId,
      leadId: args.leadId,
      projectId: args.projectId,
      proposalId: args.proposalId,
      title: `${template.name} — ${args.clientName}`,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      content,
      status: "draft",
      accessToken,
      templateKey: args.templateKey,
      expiresAt: args.expiresAt,
      createdBy: userId,
    });
  },
});

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
  args: {
    contractId: v.id("contracts"),
    useDocuSeal: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const contract = await ctx.runQuery(internal.contracts.getContractInternal, { contractId: args.contractId });
    if (!contract) throw new Error("Contract not found");

    // DocuSeal e-signature path
    if (args.useDocuSeal && DOCUSEAL_API_URL && DOCUSEAL_API_KEY) {
      try {
        await ctx.runAction(internal.docuseal.INTERNAL_createSubmission, {
          contractId: args.contractId,
          contractTitle: contract.title,
          contractContent: contract.content,
          signerName: contract.clientName,
          signerEmail: contract.clientEmail,
        });

        await ctx.runMutation(internal.contracts.INTERNAL_markSent, {
          contractId: args.contractId,
        });

        return true;
      } catch (err) {
        console.error("DocuSeal submission failed, falling back to built-in:", err);
      }
    }

    // Built-in signing flow
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
