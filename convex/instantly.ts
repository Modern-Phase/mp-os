// convex/instantly.ts — Instantly API client for outbound email automation
// Used by agents (via outbound_directives) to manage campaigns and leads

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { INSTANTLY_API_KEY } from "./env";

const INSTANTLY_BASE_URL = "https://api.instantly.ai/api/v2";

async function instantlyFetch(path: string, options: RequestInit = {}): Promise<any> {
  if (!INSTANTLY_API_KEY) {
    throw new Error("INSTANTLY_API_KEY not configured");
  }

  const url = `${INSTANTLY_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Instantly API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Add a lead to an Instantly campaign.
 * Called by agents via outbound_directives.
 */
export const INTERNAL_addLeadToCampaign = internalAction({
  args: {
    campaignId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    company: v.optional(v.string()),
    customVariables: v.optional(v.any()),
  },
  handler: async (_ctx, args) => {
    const payload: Record<string, unknown> = {
      campaign_id: args.campaignId,
      email: args.email,
    };
    if (args.firstName) payload.first_name = args.firstName;
    if (args.lastName) payload.last_name = args.lastName;
    if (args.company) payload.company_name = args.company;
    if (args.customVariables) payload.custom_variables = args.customVariables;

    const result = await instantlyFetch("/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    console.log(`[instantly] Added lead ${args.email} to campaign ${args.campaignId}`);
    return result;
  },
});

/**
 * List all campaigns in the Instantly workspace.
 */
export const INTERNAL_listCampaigns = internalAction({
  args: {},
  handler: async () => {
    const result = await instantlyFetch("/campaigns");
    console.log(`[instantly] Listed ${result?.data?.length || 0} campaigns`);
    return result;
  },
});

/**
 * Get analytics for a specific campaign.
 */
export const INTERNAL_getCampaignAnalytics = internalAction({
  args: {
    campaignId: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await instantlyFetch(`/campaigns/${args.campaignId}/analytics`);
    console.log(`[instantly] Got analytics for campaign ${args.campaignId}`);
    return result;
  },
});

/**
 * Get a lead's status in a specific campaign.
 */
export const INTERNAL_getLeadStatus = internalAction({
  args: {
    email: v.string(),
    campaignId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const params = new URLSearchParams({ email: args.email });
    if (args.campaignId) params.set("campaign_id", args.campaignId);

    const result = await instantlyFetch(`/leads?${params.toString()}`);
    console.log(`[instantly] Got lead status for ${args.email}`);
    return result;
  },
});
