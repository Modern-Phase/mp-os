// convex/finances.ts — Expense management & financial overview (profitability tracking)

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { expenseCategoryValidator } from "./schema";

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

// ========== EXPENSE CRUD ==========

export const getExpenses = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    // Attach project names
    const projectIds = [...new Set(expenses.filter(e => e.projectId).map(e => e.projectId!))];
    const projects = await Promise.all(projectIds.map(id => ctx.db.get(id)));
    const projectMap = new Map(projects.filter(Boolean).map(p => [p!._id, p!.name]));
    return expenses.map(e => ({
      ...e,
      projectName: e.projectId ? projectMap.get(e.projectId) ?? null : null,
    }));
  },
});

export const getExpensesByProject = query({
  args: { projectId: v.id("agentProjects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("expenses")
      .withIndex("projectId", (q: any) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const createExpense = mutation({
  args: {
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("agentProjects")),
    leadId: v.optional(v.id("crmLeads")),
    category: expenseCategoryValidator,
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    date: v.number(),
    vendor: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("expenses", {
      ...args,
      createdBy: userId,
    });
  },
});

export const updateExpense = mutation({
  args: {
    id: v.id("expenses"),
    category: v.optional(expenseCategoryValidator),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    date: v.optional(v.number()),
    vendor: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    projectId: v.optional(v.id("agentProjects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const { id, ...updates } = args;
    // Filter out undefined values
    const patch: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(id, patch);
  },
});

export const deleteExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(args.id);
  },
});

// ========== FINANCIAL OVERVIEW (Aggregated Dashboard) ==========

export const getFinancialOverview = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        outstandingInvoices: 0,
        overdueInvoices: 0,
        monthlyData: [],
        expensesByCategory: [],
        projectProfitability: [],
        topClients: [],
      };
    }

    // Get all invoices for org
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    // Get all expenses for org
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    // Get all projects for org
    const projects = await ctx.db
      .query("agentProjects")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    const now = Date.now();

    // === KPIs ===
    const paidInvoices = invoices.filter(i => i.status === "paid");
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const outstandingInvoices = invoices
      .filter(i => i.status === "sent")
      .reduce((sum, i) => sum + i.total, 0);
    const overdueInvoices = invoices
      .filter(i => i.status === "overdue" || (i.status === "sent" && i.dueDate < now))
      .reduce((sum, i) => sum + i.total, 0);

    // === Monthly data (last 12 months) ===
    const monthlyData: { month: string; revenue: number; expenses: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthStart = new Date(year, month, 1).getTime();
      const monthEnd = new Date(year, month + 1, 1).getTime();
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });

      const monthRevenue = paidInvoices
        .filter(i => i.paidAt && i.paidAt >= monthStart && i.paidAt < monthEnd)
        .reduce((sum, i) => sum + i.total, 0);
      const monthExpenses = expenses
        .filter(e => e.date >= monthStart && e.date < monthEnd)
        .reduce((sum, e) => sum + e.amount, 0);

      monthlyData.push({ month: label, revenue: monthRevenue, expenses: monthExpenses });
    }

    // === Expenses by category ===
    const categoryMap = new Map<string, number>();
    for (const e of expenses) {
      categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amount);
    }
    const expensesByCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // === Project profitability ===
    const projectProfitability = projects.map(project => {
      const projectRevenue = paidInvoices
        .filter(i => i.projectId && i.projectId === project._id)
        .reduce((sum, i) => sum + i.total, 0);
      const projectExpenses = expenses
        .filter(e => e.projectId && e.projectId === project._id)
        .reduce((sum, e) => sum + e.amount, 0);
      const projectProfit = projectRevenue - projectExpenses;
      const margin = projectRevenue > 0 ? (projectProfit / projectRevenue) * 100 : 0;
      return {
        projectId: project._id,
        projectName: project.name,
        client: project.client,
        status: project.status,
        revenue: projectRevenue,
        expenses: projectExpenses,
        profit: projectProfit,
        margin,
        budget: project.budget ?? null,
      };
    });

    // === Top clients ===
    const clientMap = new Map<string, number>();
    for (const inv of paidInvoices) {
      clientMap.set(inv.clientName, (clientMap.get(inv.clientName) ?? 0) + inv.total);
    }
    const topClients = Array.from(clientMap.entries())
      .map(([client, revenue]) => ({ client, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      outstandingInvoices,
      overdueInvoices,
      monthlyData,
      expensesByCategory,
      projectProfitability,
      topClients,
    };
  },
});
