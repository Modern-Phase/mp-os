// convex/docuseal.ts — DocuSeal self-hosted e-signature integration

import { v } from "convex/values";
import { query, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { DOCUSEAL_API_URL, DOCUSEAL_API_KEY } from "./env";

// ========== API HELPER ==========

async function docusealFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!DOCUSEAL_API_URL || !DOCUSEAL_API_KEY) {
    throw new Error("DocuSeal not configured (DOCUSEAL_API_URL or DOCUSEAL_API_KEY missing)");
  }

  const url = `${DOCUSEAL_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": DOCUSEAL_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DocuSeal API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ========== QUERIES ==========

export const isDocuSealConfigured = query({
  args: {},
  returns: v.boolean(),
  handler: async () => {
    return !!(DOCUSEAL_API_URL && DOCUSEAL_API_KEY);
  },
});

// ========== INTERNAL ACTIONS ==========

export const INTERNAL_createSubmission = internalAction({
  args: {
    contractId: v.id("contracts"),
    contractTitle: v.string(),
    contractContent: v.string(),
    signerName: v.string(),
    signerEmail: v.string(),
  },
  returns: v.object({
    submissionId: v.number(),
    signingUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    // Step 1: Create a template from the contract HTML
    const templateResponse = await docusealFetch("/api/templates/html", {
      method: "POST",
      body: JSON.stringify({
        html: convertMarkdownToHtml(args.contractContent),
        name: args.contractTitle,
      }),
    });

    const templateId = templateResponse.id;

    // Step 2: Create a submission (signing request) for the signer
    const submissionResponse = await docusealFetch("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
        send_email: true,
        submitters: [
          {
            name: args.signerName,
            email: args.signerEmail,
            role: "Signer",
          },
        ],
      }),
    });

    // DocuSeal returns an array of submitters
    const submitter = submissionResponse[0];

    // Store the DocuSeal data on the contract
    await ctx.runMutation(internal.docuseal.INTERNAL_markSentWithDocuSeal, {
      contractId: args.contractId,
      submissionId: submitter.submission_id,
      signingUrl: submitter.embed_src || submitter.slug
        ? `${DOCUSEAL_API_URL}/s/${submitter.slug}`
        : "",
    });

    return {
      submissionId: submitter.submission_id,
      signingUrl: submitter.embed_src || `${DOCUSEAL_API_URL}/s/${submitter.slug}`,
    };
  },
});

// ========== INTERNAL MUTATIONS ==========

export const INTERNAL_markSentWithDocuSeal = internalMutation({
  args: {
    contractId: v.id("contracts"),
    submissionId: v.number(),
    signingUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.contractId, {
      docusealSubmissionId: args.submissionId,
      docusealSigningUrl: args.signingUrl,
      signingMethod: "docuseal",
    });
  },
});

export const INTERNAL_storeSigningResult = internalMutation({
  args: {
    submissionId: v.number(),
    documentUrl: v.optional(v.string()),
    signerName: v.optional(v.string()),
    signerEmail: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find contract by DocuSeal submission ID
    const contracts = await ctx.db.query("contracts").collect();
    const contract = contracts.find((c: any) => c.docusealSubmissionId === args.submissionId);

    if (!contract) {
      console.error(`No contract found for DocuSeal submission ${args.submissionId}`);
      return;
    }

    await ctx.db.patch(contract._id, {
      status: "signed",
      signedAt: args.completedAt || Date.now(),
      docusealDocumentUrl: args.documentUrl,
      signatureData: {
        name: args.signerName || contract.clientName,
        agreedAt: args.completedAt || Date.now(),
      },
    });

    // Log CRM activity
    if (contract.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: contract.orgId,
        leadId: contract.leadId,
        type: "contract_sent",
        title: `Contract "${contract.title}" signed via DocuSeal`,
        description: `Signed by ${args.signerName || contract.clientName}`,
        userId: contract.createdBy,
        timestamp: Date.now(),
      });
    }

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: contract.createdBy,
      orgId: contract.orgId,
      type: "contract_signed",
      title: "Contract signed (DocuSeal)",
      body: `${contract.clientName} signed "${contract.title}" via DocuSeal`,
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
        signingMethod: "docuseal",
      },
      userId: contract.createdBy,
    });
  },
});

// ========== HELPERS ==========

/** Basic markdown-to-HTML for DocuSeal template creation */
function convertMarkdownToHtml(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("---")) return "<hr />";
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === "") return "<br />";
      // Bold **text**
      const withBold = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      return `<p>${withBold}</p>`;
    })
    .join("\n");
}
