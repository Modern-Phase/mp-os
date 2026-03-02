// convex/quickbooks.ts — QuickBooks Online integration: OAuth, sync, token management

import { v } from "convex/values";
import { query, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { QB_CLIENT_ID, QB_CLIENT_SECRET, QB_REDIRECT_URI, QB_ENVIRONMENT } from "./env";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function getQBBaseUrl(): string {
  return QB_ENVIRONMENT === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

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

// ========== QB API HELPER ==========

async function qbFetch(
  accessToken: string,
  realmId: string,
  path: string,
  options: RequestInit = {},
): Promise<any> {
  const baseUrl = getQBBaseUrl();
  const url = `${baseUrl}/v3/company/${realmId}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// ========== QUERIES ==========

export const getQBConnectionStatus = query({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const integration = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q: any) => q.eq("orgId", args.orgId).eq("provider", "quickbooks"))
      .unique();

    if (!integration) return null;

    return {
      status: integration.status,
      connectedAt: integration.connectedAt,
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
      realmId: integration.realmId,
    };
  },
});

export const isQBConfigured = query({
  args: {},
  returns: v.boolean(),
  handler: async () => {
    return !!(QB_CLIENT_ID && QB_CLIENT_SECRET);
  },
});

// ========== MUTATIONS ==========

export const getOAuthUrl = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (!QB_CLIENT_ID || !QB_REDIRECT_URI) {
      throw new Error("QuickBooks OAuth not configured");
    }

    const state = `${args.orgId}:${userId}`;
    const params = new URLSearchParams({
      client_id: QB_CLIENT_ID,
      redirect_uri: QB_REDIRECT_URI,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      state,
    });

    return `${QB_AUTH_URL}?${params.toString()}`;
  },
});

export const disconnectQuickBooks = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const integration = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q: any) => q.eq("orgId", args.orgId).eq("provider", "quickbooks"))
      .unique();

    if (integration) {
      await ctx.db.patch(integration._id, { status: "disconnected" });
    }

    return true;
  },
});

// ========== INTERNAL — TOKEN MANAGEMENT ==========

export const INTERNAL_exchangeCodeForTokens = internalAction({
  args: {
    code: v.string(),
    realmId: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    if (!QB_CLIENT_ID || !QB_CLIENT_SECRET || !QB_REDIRECT_URI) {
      throw new Error("QuickBooks OAuth not configured");
    }

    // Exchange authorization code for tokens
    const response = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: QB_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QB token exchange failed: ${errorText}`);
    }

    const tokens = await response.json();

    // Parse state to get orgId and userId
    const [orgId, userId] = args.state.split(":");

    await ctx.runMutation(internal.quickbooks.INTERNAL_storeTokens, {
      orgId: orgId as Id<"organizations">,
      userId: userId as Id<"users">,
      realmId: args.realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });
  },
});

export const INTERNAL_storeTokens = internalMutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    realmId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q: any) => q.eq("orgId", args.orgId).eq("provider", "quickbooks"))
      .unique();

    const tokenExpiresAt = Date.now() + args.expiresIn * 1000;

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt,
        realmId: args.realmId,
        status: "active",
        connectedAt: Date.now(),
        connectedBy: args.userId,
        lastError: undefined,
      });
    } else {
      await ctx.db.insert("integrations", {
        orgId: args.orgId,
        provider: "quickbooks",
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt,
        realmId: args.realmId,
        connectedAt: Date.now(),
        connectedBy: args.userId,
        status: "active",
      });
    }
  },
});

export const INTERNAL_getValidToken = internalAction({
  args: { orgId: v.id("organizations") },
  returns: v.object({
    accessToken: v.string(),
    realmId: v.string(),
    integrationId: v.id("integrations"),
  }),
  handler: async (ctx, args): Promise<{ accessToken: string; realmId: string; integrationId: Id<"integrations"> }> => {
    const integration: any = await ctx.runQuery(internal.quickbooks.INTERNAL_getIntegration, {
      orgId: args.orgId,
    });

    if (!integration || integration.status !== "active") {
      throw new Error("QuickBooks not connected");
    }

    // Check if token is expired (with 5 min buffer)
    if (integration.tokenExpiresAt < Date.now() + 300_000) {
      await ctx.runAction(internal.quickbooks.INTERNAL_refreshToken, {
        integrationId: integration._id,
        refreshToken: integration.refreshToken,
        orgId: args.orgId,
      });

      // Re-fetch the updated integration
      const updated: any = await ctx.runQuery(internal.quickbooks.INTERNAL_getIntegration, {
        orgId: args.orgId,
      });
      if (!updated) throw new Error("Failed to refresh QuickBooks token");

      return {
        accessToken: updated.accessToken,
        realmId: updated.realmId || "",
        integrationId: updated._id,
      };
    }

    return {
      accessToken: integration.accessToken,
      realmId: integration.realmId || "",
      integrationId: integration._id,
    };
  },
});

export const INTERNAL_getIntegration = internalQuery({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q: any) => q.eq("orgId", args.orgId).eq("provider", "quickbooks"))
      .unique();
  },
});

export const INTERNAL_refreshToken = internalAction({
  args: {
    integrationId: v.id("integrations"),
    refreshToken: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
      throw new Error("QuickBooks OAuth not configured");
    }

    const response = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: args.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await ctx.runMutation(internal.quickbooks.INTERNAL_markIntegrationError, {
        integrationId: args.integrationId,
        error: `Token refresh failed: ${errorText}`,
      });
      throw new Error(`QB token refresh failed: ${errorText}`);
    }

    const tokens = await response.json();
    const tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

    await ctx.runMutation(internal.quickbooks.INTERNAL_updateTokens, {
      integrationId: args.integrationId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
    });
  },
});

export const INTERNAL_updateTokens = internalMutation({
  args: {
    integrationId: v.id("integrations"),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      status: "active",
      lastError: undefined,
    });
  },
});

export const INTERNAL_markIntegrationError = internalMutation({
  args: {
    integrationId: v.id("integrations"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.integrationId, {
      status: "error",
      lastError: args.error,
    });
  },
});

// ========== INTERNAL — SYNC FUNCTIONS ==========

export const INTERNAL_syncCustomerToQB = internalAction({
  args: {
    orgId: v.id("organizations"),
    leadId: v.id("crmLeads"),
  },
  handler: async (ctx, args) => {
    try {
      const { accessToken, realmId, integrationId } = await ctx.runAction(
        internal.quickbooks.INTERNAL_getValidToken,
        { orgId: args.orgId },
      );

      const lead = await ctx.runQuery(internal.quickbooks.INTERNAL_getLead, { leadId: args.leadId });
      if (!lead) return;

      // Check if already synced
      if (lead.qbCustomerId) {
        // Update existing customer
        const existing = await qbFetch(accessToken, realmId, `/customer/${lead.qbCustomerId}?minorversion=65`);
        await qbFetch(accessToken, realmId, "/customer?minorversion=65", {
          method: "POST",
          body: JSON.stringify({
            Id: lead.qbCustomerId,
            SyncToken: existing.Customer.SyncToken,
            DisplayName: lead.company,
            CompanyName: lead.company,
            PrimaryEmailAddr: lead.contactEmail ? { Address: lead.contactEmail } : undefined,
            PrimaryPhone: lead.contactPhone ? { FreeFormNumber: lead.contactPhone } : undefined,
          }),
        });
      } else {
        // Create new customer
        const result = await qbFetch(accessToken, realmId, "/customer?minorversion=65", {
          method: "POST",
          body: JSON.stringify({
            DisplayName: lead.company,
            CompanyName: lead.company,
            GivenName: lead.contactName.split(" ")[0],
            FamilyName: lead.contactName.split(" ").slice(1).join(" ") || undefined,
            PrimaryEmailAddr: lead.contactEmail ? { Address: lead.contactEmail } : undefined,
            PrimaryPhone: lead.contactPhone ? { FreeFormNumber: lead.contactPhone } : undefined,
          }),
        });

        await ctx.runMutation(internal.quickbooks.INTERNAL_updateLeadQBId, {
          leadId: args.leadId,
          qbCustomerId: result.Customer.Id,
        });

        // Record sync mapping
        await ctx.runMutation(internal.quickbooks.INTERNAL_recordSyncMapping, {
          orgId: args.orgId,
          integrationId,
          localTable: "crmLeads",
          localId: String(args.leadId),
          externalId: result.Customer.Id,
        });
      }
    } catch (err) {
      console.error("[QB] Customer sync failed:", err);
    }
  },
});

export const INTERNAL_syncInvoiceToQB = internalAction({
  args: {
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    try {
      const { accessToken, realmId, integrationId } = await ctx.runAction(
        internal.quickbooks.INTERNAL_getValidToken,
        { orgId: args.orgId },
      );

      const invoice = await ctx.runQuery(internal.quickbooks.INTERNAL_getInvoice, { invoiceId: args.invoiceId });
      if (!invoice) return;

      // Skip if already synced
      if (invoice.qbInvoiceId) return;

      // Find or create customer in QB
      let customerId: string | undefined;
      if (invoice.leadId) {
        const lead = await ctx.runQuery(internal.quickbooks.INTERNAL_getLead, { leadId: invoice.leadId });
        customerId = lead?.qbCustomerId;
      }

      if (!customerId) {
        // Create a minimal customer
        const result = await qbFetch(accessToken, realmId, "/customer?minorversion=65", {
          method: "POST",
          body: JSON.stringify({
            DisplayName: `${invoice.clientName} (${invoice.invoiceNumber})`,
            CompanyName: invoice.clientName,
            PrimaryEmailAddr: { Address: invoice.clientEmail },
          }),
        });
        customerId = result.Customer.Id;
      }

      // Create QB invoice
      const qbInvoice = await qbFetch(accessToken, realmId, "/invoice?minorversion=65", {
        method: "POST",
        body: JSON.stringify({
          CustomerRef: { value: customerId },
          DueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
          DocNumber: invoice.invoiceNumber,
          Line: invoice.items.map((item: any, i: number) => ({
            DetailType: "SalesItemLineDetail",
            Amount: item.total,
            Description: item.description,
            SalesItemLineDetail: {
              Qty: item.quantity,
              UnitPrice: item.unitPrice,
            },
            LineNum: i + 1,
          })),
          CustomerMemo: invoice.notes ? { value: invoice.notes } : undefined,
        }),
      });

      await ctx.runMutation(internal.quickbooks.INTERNAL_updateInvoiceQBId, {
        invoiceId: args.invoiceId,
        qbInvoiceId: qbInvoice.Invoice.Id,
      });

      await ctx.runMutation(internal.quickbooks.INTERNAL_recordSyncMapping, {
        orgId: args.orgId,
        integrationId,
        localTable: "invoices",
        localId: String(args.invoiceId),
        externalId: qbInvoice.Invoice.Id,
      });
    } catch (err) {
      console.error("[QB] Invoice sync failed:", err);
    }
  },
});

export const INTERNAL_syncExpenseToQB = internalAction({
  args: {
    orgId: v.id("organizations"),
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    try {
      const { accessToken, realmId, integrationId } = await ctx.runAction(
        internal.quickbooks.INTERNAL_getValidToken,
        { orgId: args.orgId },
      );

      const expense = await ctx.runQuery(internal.quickbooks.INTERNAL_getExpense, { expenseId: args.expenseId });
      if (!expense || expense.qbExpenseId) return;

      const qbPurchase = await qbFetch(accessToken, realmId, "/purchase?minorversion=65", {
        method: "POST",
        body: JSON.stringify({
          PaymentType: "Cash",
          TotalAmt: expense.amount,
          TxnDate: new Date(expense.date).toISOString().split("T")[0],
          Line: [{
            DetailType: "AccountBasedExpenseLineDetail",
            Amount: expense.amount,
            Description: expense.description,
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: "1" }, // Default expense account — user should configure
            },
          }],
          EntityRef: expense.vendor ? { value: expense.vendor } : undefined,
        }),
      });

      await ctx.runMutation(internal.quickbooks.INTERNAL_updateExpenseQBId, {
        expenseId: args.expenseId,
        qbExpenseId: qbPurchase.Purchase.Id,
      });

      await ctx.runMutation(internal.quickbooks.INTERNAL_recordSyncMapping, {
        orgId: args.orgId,
        integrationId,
        localTable: "expenses",
        localId: String(args.expenseId),
        externalId: qbPurchase.Purchase.Id,
      });
    } catch (err) {
      console.error("[QB] Expense sync failed:", err);
    }
  },
});

// ========== INTERNAL — DATA ACCESS ==========

export const INTERNAL_getLead = internalQuery({
  args: { leadId: v.id("crmLeads") },
  returns: v.any(),
  handler: async (ctx, args) => ctx.db.get(args.leadId),
});

export const INTERNAL_getInvoice = internalQuery({
  args: { invoiceId: v.id("invoices") },
  returns: v.any(),
  handler: async (ctx, args) => ctx.db.get(args.invoiceId),
});

export const INTERNAL_getExpense = internalQuery({
  args: { expenseId: v.id("expenses") },
  returns: v.any(),
  handler: async (ctx, args) => ctx.db.get(args.expenseId),
});

export const INTERNAL_updateLeadQBId = internalMutation({
  args: { leadId: v.id("crmLeads"), qbCustomerId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.leadId, { qbCustomerId: args.qbCustomerId, qbSyncedAt: Date.now() });
  },
});

export const INTERNAL_updateInvoiceQBId = internalMutation({
  args: { invoiceId: v.id("invoices"), qbInvoiceId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, { qbInvoiceId: args.qbInvoiceId, qbSyncedAt: Date.now() });
  },
});

export const INTERNAL_updateExpenseQBId = internalMutation({
  args: { expenseId: v.id("expenses"), qbExpenseId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.expenseId, { qbExpenseId: args.qbExpenseId, qbSyncedAt: Date.now() });
  },
});

export const INTERNAL_recordSyncMapping = internalMutation({
  args: {
    orgId: v.id("organizations"),
    integrationId: v.id("integrations"),
    localTable: v.string(),
    localId: v.string(),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("integrationSyncMap", {
      orgId: args.orgId,
      integrationId: args.integrationId,
      localTable: args.localTable,
      localId: args.localId,
      externalId: args.externalId,
      lastSyncedAt: Date.now(),
      syncDirection: "push",
    });
  },
});

export const INTERNAL_updateLastSync = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q: any) => q.eq("orgId", args.orgId).eq("provider", "quickbooks"))
      .unique();
    if (integration) {
      await ctx.db.patch(integration._id, { lastSyncAt: Date.now() });
    }
  },
});

// ========== MANUAL SYNC (User-triggered) ==========

export const syncAllInvoices = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    const unsynced = invoices.filter((inv: any) => !inv.qbInvoiceId && inv.status !== "draft");
    for (const inv of unsynced) {
      await ctx.scheduler.runAfter(0, internal.quickbooks.INTERNAL_syncInvoiceToQB, {
        orgId: args.orgId,
        invoiceId: inv._id,
      });
    }

    return true;
  },
});

export const syncAllCustomers = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const leads = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    const unsynced = leads.filter((l: any) => !l.qbCustomerId);
    for (const lead of unsynced) {
      await ctx.scheduler.runAfter(0, internal.quickbooks.INTERNAL_syncCustomerToQB, {
        orgId: args.orgId,
        leadId: lead._id,
      });
    }

    return true;
  },
});
