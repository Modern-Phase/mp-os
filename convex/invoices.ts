// convex/invoices.ts — Invoice management: CRUD, send, mark paid

import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { STRIPE_SECRET_KEY } from "./env";
import { sendInvoiceSentEmail } from "./email/templates/invoiceEmail";

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

// ========== INTERNAL HELPERS ==========

export const INTERNAL_getNextInvoiceNumber = internalMutation({
  args: { orgId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("invoices")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    const num = existing.length + 1;
    return `INV-${String(num).padStart(3, "0")}`;
  },
});

export const INTERNAL_createDraftInvoice = internalMutation({
  args: {
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("agentProjects")),
    leadId: v.optional(v.id("crmLeads")),
    clientName: v.string(),
    clientEmail: v.string(),
    items: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      total: v.number(),
    })),
    currency: v.string(),
    dueDate: v.number(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("invoices")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    const invoiceNumber = `INV-${String(existing.length + 1).padStart(3, "0")}`;

    const subtotal = args.items.reduce((sum, item) => sum + item.total, 0);

    return await ctx.db.insert("invoices", {
      orgId: args.orgId,
      projectId: args.projectId,
      leadId: args.leadId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      invoiceNumber,
      items: args.items,
      subtotal,
      tax: 0,
      total: subtotal,
      currency: args.currency,
      status: "draft",
      dueDate: args.dueDate,
      notes: args.notes,
      createdBy: args.createdBy,
    });
  },
});

// ========== QUERIES ==========

export const getInvoices = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("invoices")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
  },
});

export const getInvoice = query({
  args: { invoiceId: v.id("invoices") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(args.invoiceId);
  },
});

export const getInvoicesByProject = query({
  args: { projectId: v.id("agentProjects") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("invoices")
      .withIndex("projectId", (q: any) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const getInvoicesByLead = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("invoices")
      .withIndex("leadId", (q: any) => q.eq("leadId", args.leadId))
      .collect();
  },
});

// ========== MUTATIONS ==========

export const createInvoice = mutation({
  args: {
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("agentProjects")),
    leadId: v.optional(v.id("crmLeads")),
    clientName: v.string(),
    clientEmail: v.string(),
    items: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      total: v.number(),
    })),
    taxRate: v.optional(v.number()),
    currency: v.string(),
    dueDate: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("invoices"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("invoices")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    const invoiceNumber = `INV-${String(existing.length + 1).padStart(3, "0")}`;

    const subtotal = args.items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = args.taxRate ?? 0;
    const tax = Math.round(subtotal * taxRate) / 100;
    const total = subtotal + tax;

    return await ctx.db.insert("invoices", {
      orgId: args.orgId,
      projectId: args.projectId,
      leadId: args.leadId,
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      invoiceNumber,
      items: args.items,
      subtotal,
      taxRate: args.taxRate,
      tax,
      total,
      currency: args.currency,
      status: "draft",
      dueDate: args.dueDate,
      notes: args.notes,
      createdBy: userId,
    });
  },
});

export const updateInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    clientName: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    items: v.optional(v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      total: v.number(),
    }))),
    taxRate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const patch: Record<string, any> = {};
    if (args.clientName !== undefined) patch.clientName = args.clientName;
    if (args.clientEmail !== undefined) patch.clientEmail = args.clientEmail;
    if (args.dueDate !== undefined) patch.dueDate = args.dueDate;
    if (args.notes !== undefined) patch.notes = args.notes;

    if (args.items !== undefined) {
      patch.items = args.items;
      const subtotal = args.items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = args.taxRate ?? invoice.taxRate ?? 0;
      const tax = Math.round(subtotal * taxRate) / 100;
      patch.subtotal = subtotal;
      patch.taxRate = taxRate;
      patch.tax = tax;
      patch.total = subtotal + tax;
    } else if (args.taxRate !== undefined) {
      const taxRate = args.taxRate;
      const tax = Math.round(invoice.subtotal * taxRate) / 100;
      patch.taxRate = taxRate;
      patch.tax = tax;
      patch.total = invoice.subtotal + tax;
    }

    await ctx.db.patch(args.invoiceId, patch);
    return true;
  },
});

export const deleteInvoice = mutation({
  args: { invoiceId: v.id("invoices") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "draft") throw new Error("Can only delete draft invoices");

    await ctx.db.delete(args.invoiceId);
    return true;
  },
});

export const markAsPaid = mutation({
  args: { invoiceId: v.id("invoices") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    await ctx.db.patch(args.invoiceId, {
      status: "paid",
      paidAt: Date.now(),
    });

    // Log CRM activity if linked to a lead
    if (invoice.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: invoice.orgId,
        leadId: invoice.leadId,
        type: "note",
        title: `Invoice ${invoice.invoiceNumber} marked as paid`,
        description: `$${invoice.total.toFixed(2)} received`,
        userId,
        timestamp: Date.now(),
      });
    }

    // Notify invoice creator
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: invoice.createdBy,
      orgId: invoice.orgId,
      type: "invoice_paid",
      title: "Invoice paid",
      body: `${invoice.clientName} paid ${invoice.invoiceNumber} ($${invoice.total.toFixed(2)})`,
      resourceType: "invoice",
      resourceId: String(args.invoiceId),
    });

    // Fire workflow trigger
    await ctx.scheduler.runAfter(0, internal.workflows.INTERNAL_processWorkflowTrigger, {
      orgId: invoice.orgId,
      trigger: "invoice_status_change",
      context: {
        invoiceId: String(args.invoiceId),
        invoiceStatus: "paid",
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
      },
      userId,
    });

    return true;
  },
});

// ========== ACTIONS ==========

export const sendInvoice = action({
  args: { invoiceId: v.id("invoices") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const invoice = await ctx.runQuery(internal.invoices.getInvoiceInternal, { invoiceId: args.invoiceId });
    if (!invoice) throw new Error("Invoice not found");

    // Try Stripe Invoicing if available
    if (STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(STRIPE_SECRET_KEY);

        // Check if customer exists in Stripe
        const user = await ctx.runQuery(internal.invoices.getInvoiceCreator, { userId: invoice.createdBy });
        let customerId = user?.customerId;

        if (!customerId) {
          const customer = await stripe.customers.create({
            name: invoice.clientName,
            email: invoice.clientEmail,
          });
          customerId = customer.id;
        }

        const stripeInvoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: "send_invoice",
          days_until_due: Math.max(1, Math.ceil((invoice.dueDate - Date.now()) / 86400000)),
          auto_advance: true,
        });

        for (const item of invoice.items) {
          await stripe.invoiceItems.create({
            customer: customerId,
            invoice: stripeInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_amount: Math.round(item.unitPrice * 100),
            currency: invoice.currency.toLowerCase(),
          });
        }

        await stripe.invoices.sendInvoice(stripeInvoice.id);

        await ctx.runMutation(internal.invoices.INTERNAL_markSent, {
          invoiceId: args.invoiceId,
          stripeInvoiceId: stripeInvoice.id,
        });

        return true;
      } catch (err) {
        console.error("Stripe invoicing failed, falling back to email:", err);
      }
    }

    // Fallback: send invoice via email
    await sendInvoiceSentEmail({
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      invoiceNumber: invoice.invoiceNumber,
      total: `$${invoice.total.toFixed(2)}`,
      dueDate: new Date(invoice.dueDate).toLocaleDateString(),
    });

    await ctx.runMutation(internal.invoices.INTERNAL_markSent, {
      invoiceId: args.invoiceId,
    });

    return true;
  },
});

// Internal queries for actions
export const getInvoiceInternal = internalQuery({
  args: { invoiceId: v.id("invoices") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.invoiceId);
  },
});

export const getInvoiceCreator = internalQuery({
  args: { userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const INTERNAL_markSent = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    stripeInvoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return;

    const patch: Record<string, any> = { status: "sent" };
    if (args.stripeInvoiceId) patch.stripeInvoiceId = args.stripeInvoiceId;
    await ctx.db.patch(args.invoiceId, patch);

    // Log CRM activity
    if (invoice.leadId) {
      await ctx.db.insert("crmActivities", {
        orgId: invoice.orgId,
        leadId: invoice.leadId,
        type: "email",
        title: `Invoice ${invoice.invoiceNumber} sent`,
        description: `$${invoice.total.toFixed(2)} due ${new Date(invoice.dueDate).toLocaleDateString()}`,
        userId: invoice.createdBy,
        timestamp: Date.now(),
      });
    }

    // Notify creator
    await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
      userId: invoice.createdBy,
      orgId: invoice.orgId,
      type: "invoice_sent",
      title: "Invoice sent",
      body: `${invoice.invoiceNumber} sent to ${invoice.clientName}`,
      resourceType: "invoice",
      resourceId: String(args.invoiceId),
    });
  },
});
