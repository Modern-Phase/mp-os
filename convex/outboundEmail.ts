// convex/outboundEmail.ts — Processes inbound webhook events from Instantly (outbound email platform)
// Handles: dedup, raw event storage, CRM lead matching, activity logging, pipeline auto-advance, notifications

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Helper: Build human-readable activity title ──
function buildActivityTitle(eventType: string, subject?: string): string {
  const titles: Record<string, string> = {
    email_sent: "Email sent",
    email_opened: "Email opened",
    reply_received: "Reply received",
    link_clicked: "Link clicked",
    email_bounced: "Email bounced",
    lead_unsubscribed: "Lead unsubscribed",
    account_error: "Email account error",
    lead_interested: "Lead marked interested",
    lead_not_interested: "Lead marked not interested",
    lead_meeting_booked: "Meeting booked",
    lead_meeting_completed: "Meeting completed",
    lead_out_of_office: "Out of office reply",
    lead_wrong_person: "Wrong person",
  };
  const base = titles[eventType] || `Email event: ${eventType}`;
  return subject ? `${base}: ${subject}` : base;
}

// ── Helper: Build activity description ──
function buildActivityDescription(
  eventType: string,
  subject?: string,
  metadata?: Record<string, unknown>,
): string {
  const parts: string[] = [];
  if (subject) parts.push(`Subject: ${subject}`);
  if (metadata?.campaignName) parts.push(`Campaign: ${metadata.campaignName}`);
  if (metadata?.emailAccount) parts.push(`From: ${metadata.emailAccount}`);
  if (metadata?.uniboxUrl) parts.push(`View in Instantly: ${metadata.uniboxUrl}`);
  return parts.join("\n") || `Outbound email event: ${eventType}`;
}

// ── Pipeline stage ordering for auto-advance ──
const STAGE_ORDER = [
  "new_lead",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

function stageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
}

/**
 * Process an inbound email event from Instantly webhook.
 * Called by the HTTP handler in http.ts after API key verification.
 *
 * Flow:
 * 1. Dedup by externalEventId
 * 2. Store raw event in outboundEmailEvents
 * 3. Match lead by orgId + contactEmail
 * 4. Log CRM activity
 * 5. Auto-advance pipeline stage
 * 6. Tag bounced/unsubscribed leads
 * 7. Create notifications for replies and bounces
 * 8. Log agent activity if lead has an assigned agent
 */
export const INTERNAL_processEmailEvent = internalMutation({
  args: {
    eventType: v.string(),
    leadEmail: v.string(),
    campaignId: v.string(),
    campaignName: v.string(),
    subject: v.optional(v.string()),
    timestamp: v.number(),
    workspace: v.string(),
    externalEventId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // 1. Dedup: reject if externalEventId already exists
    if (args.externalEventId) {
      const existing = await ctx.db
        .query("outboundEmailEvents")
        .withIndex("externalEventId", (q) => q.eq("externalEventId", args.externalEventId!))
        .first();
      if (existing) {
        return { eventId: existing._id, leadMatched: !!existing.leadId, duplicate: true };
      }
    }

    // We need to find the org. For now, search across all orgs for matching leads.
    // In production, the webhook payload should include orgId or we infer from workspace.
    // We'll match by email across all orgs and process for each match.
    const normalizedEmail = args.leadEmail.toLowerCase().trim();

    // 2. Store raw event (orgId will be set per-lead or as a placeholder)
    // First, try to find matching leads to determine orgId
    const matchingLeads = await ctx.db
      .query("crmLeads")
      .filter((q) => q.eq(q.field("contactEmail"), normalizedEmail))
      .collect();

    // If no leads found, store event with first org (from organizations table) as fallback
    if (matchingLeads.length === 0) {
      const firstOrg = await ctx.db.query("organizations").first();
      if (!firstOrg) {
        return { eventId: null, leadMatched: false, error: "No organization found" };
      }

      const eventId = await ctx.db.insert("outboundEmailEvents", {
        orgId: firstOrg._id,
        eventType: args.eventType,
        leadEmail: normalizedEmail,
        subject: args.subject,
        campaignId: args.campaignId,
        campaignName: args.campaignName || undefined,
        externalEventId: args.externalEventId,
        metadata: args.metadata,
        timestamp: args.timestamp,
        processedAt: Date.now(),
      });

      return { eventId, leadMatched: false };
    }

    // Process for each matching lead (typically just one)
    let firstEventId: string | null = null;

    for (const lead of matchingLeads) {
      // 2. Store raw event linked to this lead's org
      const eventId = await ctx.db.insert("outboundEmailEvents", {
        orgId: lead.orgId,
        eventType: args.eventType,
        leadEmail: normalizedEmail,
        subject: args.subject,
        campaignId: args.campaignId,
        campaignName: args.campaignName || undefined,
        externalEventId: args.externalEventId,
        metadata: args.metadata,
        leadId: lead._id,
        timestamp: args.timestamp,
        processedAt: Date.now(),
      });

      if (!firstEventId) firstEventId = eventId;

      // 3. Log CRM activity
      const activityTitle = buildActivityTitle(args.eventType, args.subject);
      const activityDescription = buildActivityDescription(args.eventType, args.subject, {
        campaignName: args.campaignName,
        emailAccount: args.metadata?.emailAccount,
        uniboxUrl: args.metadata?.uniboxUrl,
      });

      // Get org owner as the userId for the activity
      const org = await ctx.db.get(lead.orgId);
      const userId = org?.ownerId;
      if (!userId) continue;

      const activityId = await ctx.db.insert("crmActivities", {
        orgId: lead.orgId,
        leadId: lead._id,
        type: "email",
        title: activityTitle,
        description: activityDescription,
        agentId: lead.assignedAgent,
        userId,
        timestamp: args.timestamp,
        metadata: { emailEventType: args.eventType, campaignId: args.campaignId },
      });

      // Link activity back to event
      await ctx.db.patch(eventId, { activityId });

      // 4. Auto-advance pipeline
      const currentStageIdx = stageIndex(lead.stage);

      if (args.eventType === "reply_received" && lead.stage === "new_lead") {
        await ctx.db.patch(lead._id, { stage: "qualified" });
        await ctx.db.insert("crmActivities", {
          orgId: lead.orgId,
          leadId: lead._id,
          type: "status_change",
          title: `Pipeline auto-advanced: new_lead → qualified (reply received)`,
          userId,
          timestamp: Date.now(),
        });
      } else if (
        args.eventType === "lead_interested" &&
        currentStageIdx >= 0 &&
        currentStageIdx < stageIndex("discovery")
      ) {
        await ctx.db.patch(lead._id, { stage: "discovery" });
        await ctx.db.insert("crmActivities", {
          orgId: lead.orgId,
          leadId: lead._id,
          type: "status_change",
          title: `Pipeline auto-advanced: ${lead.stage} → discovery (lead interested)`,
          userId,
          timestamp: Date.now(),
        });
      } else if (
        args.eventType === "lead_meeting_booked" &&
        currentStageIdx >= 0 &&
        currentStageIdx < stageIndex("discovery")
      ) {
        await ctx.db.patch(lead._id, { stage: "discovery" });
        await ctx.db.insert("crmActivities", {
          orgId: lead.orgId,
          leadId: lead._id,
          type: "status_change",
          title: `Pipeline auto-advanced: ${lead.stage} → discovery (meeting booked)`,
          userId,
          timestamp: Date.now(),
        });
      }

      // 5. Tag bounced/unsubscribed leads
      if (args.eventType === "email_bounced") {
        const currentTags = lead.tags || [];
        if (!currentTags.includes("email_bounced")) {
          await ctx.db.patch(lead._id, { tags: [...currentTags, "email_bounced"] });
        }
      } else if (args.eventType === "lead_unsubscribed") {
        const currentTags = lead.tags || [];
        if (!currentTags.includes("unsubscribed")) {
          await ctx.db.patch(lead._id, { tags: [...currentTags, "unsubscribed"] });
        }
      }

      // 6. Create notifications for replies and bounces
      if (args.eventType === "reply_received") {
        await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
          userId,
          orgId: lead.orgId,
          type: "email_reply",
          title: "Email reply received",
          body: `${lead.contactName} (${lead.company}) replied${args.subject ? `: ${args.subject}` : ""}`,
          resourceType: "lead",
          resourceId: String(lead._id),
          agentId: lead.assignedAgent,
        });
      } else if (args.eventType === "email_bounced") {
        await ctx.scheduler.runAfter(0, internal.notifications.INTERNAL_createNotification, {
          userId,
          orgId: lead.orgId,
          type: "email_bounce",
          title: "Email bounced",
          body: `Email to ${lead.contactName} (${lead.company}) bounced — ${normalizedEmail}`,
          resourceType: "lead",
          resourceId: String(lead._id),
          agentId: lead.assignedAgent,
        });
      }

      // 7. Log agent activity if lead has an assigned agent
      if (lead.assignedAgent) {
        await ctx.db.insert("agentActivity", {
          orgId: lead.orgId,
          agentId: lead.assignedAgent,
          action: `outbound_${args.eventType}`,
          target: `${lead.company}: ${activityTitle}`,
          timestamp: args.timestamp,
        });
      }
    }

    return {
      eventId: firstEventId,
      leadMatched: true,
      leadsProcessed: matchingLeads.length,
    };
  },
});
