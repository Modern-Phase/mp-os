// convex/templates.ts — Template gallery: browse built-in + CRUD for custom templates

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { templateTypeValidator } from "./schema";
import { INVOICE_TEMPLATES } from "./invoices";
import { PROPOSAL_TEMPLATES } from "./proposals";
import { CONTRACT_TEMPLATES } from "./contracts";

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

// ========== BUILT-IN TEMPLATES ==========

export const getAllBuiltInTemplates = query({
  args: {},
  returns: v.array(v.any()),
  handler: async () => {
    const templates: any[] = [];

    for (const [key, t] of Object.entries(INVOICE_TEMPLATES)) {
      templates.push({
        key,
        name: t.name,
        type: "invoice" as const,
        builtIn: true,
        preview: `${t.items.length} line items — $${t.items.reduce((s, i) => s + i.total, 0).toLocaleString()}`,
        dueDays: t.dueDays,
      });
    }

    for (const [key, t] of Object.entries(PROPOSAL_TEMPLATES)) {
      const totalValue = t.sections.reduce(
        (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.total, 0),
        0,
      );
      templates.push({
        key,
        name: t.name,
        type: "proposal" as const,
        builtIn: true,
        preview: `${t.sections.length} sections — $${totalValue.toLocaleString()}`,
      });
    }

    for (const [key, t] of Object.entries(CONTRACT_TEMPLATES)) {
      templates.push({
        key,
        name: t.name,
        type: "contract" as const,
        builtIn: true,
        preview: t.content.slice(0, 120).replace(/[#*]/g, "").trim() + "...",
      });
    }

    return templates;
  },
});

// ========== CUSTOM TEMPLATES ==========

export const getCustomTemplates = query({
  args: {
    orgId: v.id("organizations"),
    type: v.optional(templateTypeValidator),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    if (args.type) {
      return await ctx.db
        .query("customTemplates")
        .withIndex("orgId_type", (q: any) => q.eq("orgId", args.orgId).eq("type", args.type))
        .collect();
    }

    return await ctx.db
      .query("customTemplates")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const createCustomTemplate = mutation({
  args: {
    orgId: v.id("organizations"),
    type: templateTypeValidator,
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(),
  },
  returns: v.id("customTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return await ctx.db.insert("customTemplates", {
      orgId: args.orgId,
      type: args.type,
      name: args.name,
      description: args.description,
      content: args.content,
      createdBy: userId,
    });
  },
});

export const updateCustomTemplate = mutation({
  args: {
    templateId: v.id("customTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.content !== undefined) patch.content = args.content;

    await ctx.db.patch(args.templateId, patch);
    return true;
  },
});

export const deleteCustomTemplate = mutation({
  args: { templateId: v.id("customTemplates") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    await ctx.db.delete(args.templateId);
    return true;
  },
});

export const duplicateBuiltInTemplate = mutation({
  args: {
    orgId: v.id("organizations"),
    type: templateTypeValidator,
    builtInKey: v.string(),
  },
  returns: v.id("customTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    let name = "";
    let content = "";

    if (args.type === "invoice") {
      const t = INVOICE_TEMPLATES[args.builtInKey];
      if (!t) throw new Error(`Unknown invoice template: ${args.builtInKey}`);
      name = `${t.name} (Copy)`;
      content = JSON.stringify({ items: t.items, notes: t.notes, dueDays: t.dueDays });
    } else if (args.type === "proposal") {
      const t = PROPOSAL_TEMPLATES[args.builtInKey];
      if (!t) throw new Error(`Unknown proposal template: ${args.builtInKey}`);
      name = `${t.name} (Copy)`;
      content = JSON.stringify({ sections: t.sections });
    } else if (args.type === "contract") {
      const t = CONTRACT_TEMPLATES[args.builtInKey];
      if (!t) throw new Error(`Unknown contract template: ${args.builtInKey}`);
      name = `${t.name} (Copy)`;
      content = t.content;
    }

    return await ctx.db.insert("customTemplates", {
      orgId: args.orgId,
      type: args.type,
      name,
      content,
      createdBy: userId,
    });
  },
});
