import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { HELICONE_API_KEY } from "./env";

// Sync user feedback to Helicone
export const syncFeedback = internalAction({
  args: {
    heliconeRequestId: v.string(),
    rating: v.union(v.literal("positive"), v.literal("negative")),
  },
  handler: async (_ctx, args) => {
    if (!HELICONE_API_KEY) {
      console.log("Helicone API key not configured, skipping feedback sync");
      return;
    }

    // Convert rating to score (positive=1, negative=-1)
    const score = args.rating === "positive" ? 1 : -1;

    try {
      const response = await fetch(
        `https://api.helicone.ai/v1/request/${args.heliconeRequestId}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${HELICONE_API_KEY}`,
          },
          body: JSON.stringify({
            rating: score,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error("Helicone feedback sync failed:", error);
        return;
      }

      console.log(
        `Successfully synced feedback to Helicone for request ${args.heliconeRequestId}`,
      );
    } catch (error) {
      console.error("Helicone feedback sync error:", error);
    }
  },
});

/** Public action: get Helicone metrics for the current user (no API key on client). */
export const getMetricsForCurrentUser = action({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user) {
      throw new Error("Unauthorized");
    }
    return await ctx.runAction(internal.helicone.getMetrics, {
      userId: user._id,
      startDate: args.startDate,
      endDate: args.endDate,
    });
  },
});

// Get Helicone metrics (internal; used by getMetricsForCurrentUser)
export const getMetrics = internalAction({
  args: {
    userId: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    if (!HELICONE_API_KEY) {
      throw new Error("Helicone API key not configured");
    }

    // Build Helicone query filter
    // Reference: https://docs.helicone.ai/rest/request/post-v1requestquery
    const filters: Record<string, unknown>[] = [];

    // Filter by user_id (set via Helicone-User-Id header in http.ts)
    if (args.userId) {
      filters.push({
        request: {
          user_id: {
            equals: args.userId,
          },
        },
      });
    }

    // Filter by date range
    if (args.startDate) {
      filters.push({
        request: {
          created_at: {
            gte: args.startDate,
          },
        },
      });
    }

    if (args.endDate) {
      filters.push({
        request: {
          created_at: {
            lte: args.endDate,
          },
        },
      });
    }

    // Combine filters with AND operator if multiple filters exist
    let filter: Record<string, unknown>;
    if (filters.length === 0) {
      filter = {};
    } else if (filters.length === 1) {
      filter = filters[0];
    } else {
      // Build AST of AND filters
      filter = filters.reduce((acc, curr, idx) => {
        if (idx === 0) {
          return curr;
        }
        return {
          operator: "and",
          left: acc,
          right: curr,
        };
      });
    }

    const requestBody = {
      filter,
      offset: 0,
      limit: 1000, // Adjust based on expected volume
    };

    const url = `https://api.helicone.ai/v1/request/query`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HELICONE_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Helicone metrics fetch failed: ${error}`);
      }

      const heliconeData = await response.json();

      // Transform Helicone response format to match frontend expectations
      // Helicone fields: request_id, request_created_at, response_model, cost, etc.
      // Frontend expects: id, created_at, model, cost_usd, etc.
      const transformedData = {
        data: (heliconeData.data || []).map(
          (item: Record<string, unknown>) => ({
            id: item.request_id || item.response_id,
            created_at: item.request_created_at || item.response_created_at,
            model: item.response_model || item.request_model || "unknown",
            prompt_tokens: item.prompt_tokens || 0,
            completion_tokens: item.completion_tokens || 0,
            cost_usd: item.cost || 0,
            user_id: item.request_user_id || item.helicone_user,
            status: item.response_status || 200,
          }),
        ),
      };

      return transformedData;
    } catch (error) {
      console.error("Helicone metrics error:", error);
      throw error;
    }
  },
});
