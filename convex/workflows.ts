// convex/workflows.ts — Workflow automation engine: rules, triggers, actions

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { workflowTriggerValidator, workflowActionTypeValidator } from "./schema";
import { Id } from "./_generated/dataModel";
import { sendEmail } from "./email";

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

// ========== CORE ENGINE ==========

export const INTERNAL_processWorkflowTrigger = internalMutation({
  args: {
    orgId: v.id("organizations"),
    trigger: workflowTriggerValidator,
    context: v.any(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find active rules matching this org + trigger
    const rules = await ctx.db
      .query("workflowRules")
      .withIndex("orgId_trigger", (q: any) =>
        q.eq("orgId", args.orgId).eq("trigger", args.trigger),
      )
      .collect();

    const activeRules = rules.filter((r) => r.isActive);

    for (const rule of activeRules) {
      // Evaluate conditions
      if (!evaluateConditions(rule.conditions, args.context)) continue;

      // Execute each action
      for (const action of rule.actions) {
        await executeAction(ctx, action, args.orgId, args.context, args.userId);
      }
    }
  },
});

function evaluateConditions(conditions: any, context: any): boolean {
  if (!conditions) return true;

  // Stage change conditions
  if (conditions.fromStage && context.fromStage && conditions.fromStage !== context.fromStage) {
    return false;
  }
  if (conditions.toStage && context.toStage && conditions.toStage !== context.toStage) {
    return false;
  }

  // Project status conditions
  if (conditions.projectStatus && context.projectStatus && conditions.projectStatus !== context.projectStatus) {
    return false;
  }

  // Invoice status conditions
  if (conditions.invoiceStatus && context.invoiceStatus && conditions.invoiceStatus !== context.invoiceStatus) {
    return false;
  }

  // Proposal status conditions
  if (conditions.proposalStatus && context.proposalStatus && conditions.proposalStatus !== context.proposalStatus) {
    return false;
  }

  // Contract status conditions
  if (conditions.contractStatus && context.contractStatus && conditions.contractStatus !== context.contractStatus) {
    return false;
  }

  return true;
}

async function executeAction(
  ctx: any,
  action: { type: string; config: any },
  orgId: Id<"organizations">,
  context: any,
  userId: Id<"users">,
) {
  const config = action.config || {};

  switch (action.type) {
    case "create_invoice": {
      const items = config.items || [{
        description: config.description || "Professional services",
        quantity: 1,
        unitPrice: context.leadValue || context.totalValue || 0,
        total: context.leadValue || context.totalValue || 0,
      }];
      await ctx.scheduler.runAfter(0, internal.invoices.INTERNAL_createDraftInvoice, {
        orgId,
        leadId: context.leadId ? (context.leadId as Id<"crmLeads">) : undefined,
        projectId: context.projectId ? (context.projectId as Id<"agentProjects">) : undefined,
        clientName: context.clientName || config.clientName || "Client",
        clientEmail: context.clientEmail || config.clientEmail || "",
        items,
        currency: config.currency || "usd",
        dueDate: Date.now() + (config.dueDays || 30) * 86400000,
        notes: config.notes,
        createdBy: userId,
      });
      break;
    }

    case "create_proposal": {
      await ctx.scheduler.runAfter(0, internal.proposals.INTERNAL_createProposalFromTemplate, {
        orgId,
        leadId: context.leadId as Id<"crmLeads">,
        templateId: config.templateId,
        createdBy: userId,
      });
      break;
    }

    case "create_contract": {
      await ctx.scheduler.runAfter(0, internal.contracts.INTERNAL_createContractFromTemplate, {
        orgId,
        leadId: context.leadId ? (context.leadId as Id<"crmLeads">) : undefined,
        proposalId: context.proposalId ? (context.proposalId as Id<"proposals">) : undefined,
        templateKey: config.templateKey || "msa",
        createdBy: userId,
      });
      break;
    }

    case "send_email": {
      await ctx.scheduler.runAfter(0, internal.workflows.INTERNAL_sendWorkflowEmail, {
        to: context.clientEmail || config.to || "",
        subject: (config.subject || "Update from Modern Phase").replace(/\{\{clientName\}\}/g, context.clientName || ""),
        body: (config.body || "Thank you for your business!").replace(/\{\{clientName\}\}/g, context.clientName || ""),
      });
      break;
    }

    case "create_task": {
      // This would create an agent task — simplified version
      break;
    }

    case "update_stage": {
      // Guard against infinite loops
      if (context.toStage === config.targetStage) break;
      if (context.leadId) {
        await ctx.db.patch(context.leadId as Id<"crmLeads">, {
          stage: config.targetStage,
        });
      }
      break;
    }
  }
}

// ========== INTERNAL HELPERS ==========

export const INTERNAL_sendWorkflowEmail = internalMutation({
  args: {
    to: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!args.to) return;
    try {
      await sendEmail({
        to: args.to,
        subject: args.subject,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>${args.body.replace(/\n/g, "<br/>")}</p>
          <hr style="border-color: #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Modern Phase</p>
        </div>`,
      });
    } catch (err) {
      console.error("Workflow email failed:", err);
    }
  },
});

// ========== QUERIES ==========

export const getWorkflowRules = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("workflowRules")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ========== MUTATIONS ==========

export const createWorkflowRule = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    trigger: workflowTriggerValidator,
    conditions: v.any(),
    actions: v.array(v.object({
      type: workflowActionTypeValidator,
      config: v.any(),
    })),
  },
  returns: v.id("workflowRules"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return await ctx.db.insert("workflowRules", {
      orgId: args.orgId,
      name: args.name,
      trigger: args.trigger,
      conditions: args.conditions,
      actions: args.actions,
      isActive: true,
      createdBy: userId,
    });
  },
});

export const updateWorkflowRule = mutation({
  args: {
    ruleId: v.id("workflowRules"),
    name: v.optional(v.string()),
    trigger: v.optional(workflowTriggerValidator),
    conditions: v.optional(v.any()),
    actions: v.optional(v.array(v.object({
      type: workflowActionTypeValidator,
      config: v.any(),
    }))),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.trigger !== undefined) patch.trigger = args.trigger;
    if (args.conditions !== undefined) patch.conditions = args.conditions;
    if (args.actions !== undefined) patch.actions = args.actions;

    await ctx.db.patch(args.ruleId, patch);
    return true;
  },
});

export const deleteWorkflowRule = mutation({
  args: { ruleId: v.id("workflowRules") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.ruleId);
    return true;
  },
});

export const toggleWorkflowRule = mutation({
  args: {
    ruleId: v.id("workflowRules"),
    isActive: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.ruleId, { isActive: args.isActive });
    return true;
  },
});

// ========== SEEDER ==========

export const seedDefaultRules = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check for existing rules (idempotent)
    const existing = await ctx.db
      .query("workflowRules")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    if (existing.length > 0) return 0;

    const defaults = [
      {
        name: "Auto-create proposal on PROPOSAL stage",
        trigger: "stage_change" as const,
        conditions: { toStage: "proposal" },
        actions: [{ type: "create_proposal" as const, config: {} }],
      },
      {
        name: "Auto-create contract on NEGOTIATION stage",
        trigger: "stage_change" as const,
        conditions: { toStage: "negotiation" },
        actions: [{ type: "create_contract" as const, config: { templateKey: "msa" } }],
      },
      {
        name: "Auto-create invoice on project DELIVERED",
        trigger: "project_status_change" as const,
        conditions: { projectStatus: "delivered" },
        actions: [{ type: "create_invoice" as const, config: { dueDays: 30 } }],
      },
      {
        name: "Send thank-you email on invoice PAID",
        trigger: "invoice_status_change" as const,
        conditions: { invoiceStatus: "paid" },
        actions: [{
          type: "send_email" as const,
          config: {
            subject: "Thank you, {{clientName}}!",
            body: "Thank you for your payment! We appreciate your business and look forward to working with you again.",
          },
        }],
      },
    ];

    let count = 0;
    for (const rule of defaults) {
      await ctx.db.insert("workflowRules", {
        orgId: args.orgId,
        name: rule.name,
        trigger: rule.trigger,
        conditions: rule.conditions,
        actions: rule.actions,
        isActive: true,
        createdBy: userId,
      });
      count++;
    }

    return count;
  },
});
