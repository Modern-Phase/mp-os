// convex/emailSequences.ts — Email sequence management and processing

import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
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

// ========== QUERIES ==========

export const getSequences = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const sequences = await ctx.db
      .query("emailSequences")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();

    // Add enrollment counts
    const result = [];
    for (const seq of sequences) {
      const enrollments = await ctx.db
        .query("emailSequenceEnrollments")
        .withIndex("sequenceId", (q: any) => q.eq("sequenceId", seq._id))
        .collect();

      result.push({
        ...seq,
        enrollmentCount: enrollments.length,
        activeCount: enrollments.filter((e) => e.status === "active").length,
      });
    }
    return result;
  },
});

export const getSequence = query({
  args: { sequenceId: v.id("emailSequences") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(args.sequenceId);
  },
});

export const getEnrollments = query({
  args: { sequenceId: v.id("emailSequences") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const enrollments = await ctx.db
      .query("emailSequenceEnrollments")
      .withIndex("sequenceId", (q: any) => q.eq("sequenceId", args.sequenceId))
      .collect();

    // Enrich with lead data
    const result = [];
    for (const enrollment of enrollments) {
      const lead = await ctx.db.get(enrollment.leadId);
      result.push({
        ...enrollment,
        leadName: lead?.contactName || "Unknown",
        leadEmail: lead?.contactEmail || "",
        leadCompany: lead?.company || "",
      });
    }
    return result;
  },
});

// ========== MUTATIONS ==========

export const createSequence = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    steps: v.array(v.object({
      delayDays: v.number(),
      subject: v.string(),
      body: v.string(),
    })),
  },
  returns: v.id("emailSequences"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return await ctx.db.insert("emailSequences", {
      orgId: args.orgId,
      name: args.name,
      steps: args.steps,
      isActive: true,
      createdBy: userId,
    });
  },
});

export const updateSequence = mutation({
  args: {
    sequenceId: v.id("emailSequences"),
    name: v.optional(v.string()),
    steps: v.optional(v.array(v.object({
      delayDays: v.number(),
      subject: v.string(),
      body: v.string(),
    }))),
    isActive: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.steps !== undefined) patch.steps = args.steps;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.sequenceId, patch);
    return true;
  },
});

export const deleteSequence = mutation({
  args: { sequenceId: v.id("emailSequences") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Cancel all active enrollments
    const enrollments = await ctx.db
      .query("emailSequenceEnrollments")
      .withIndex("sequenceId", (q: any) => q.eq("sequenceId", args.sequenceId))
      .collect();

    for (const e of enrollments) {
      if (e.status === "active") {
        await ctx.db.patch(e._id, { status: "cancelled" });
      }
    }

    await ctx.db.delete(args.sequenceId);
    return true;
  },
});

export const enrollLead = mutation({
  args: {
    sequenceId: v.id("emailSequences"),
    leadId: v.id("crmLeads"),
  },
  returns: v.id("emailSequenceEnrollments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const sequence = await ctx.db.get(args.sequenceId);
    if (!sequence || sequence.steps.length === 0) throw new Error("Sequence not found or empty");

    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("Lead not found");

    // Check for existing active enrollment
    const existing = await ctx.db
      .query("emailSequenceEnrollments")
      .withIndex("leadId", (q: any) => q.eq("leadId", args.leadId))
      .collect();
    const alreadyActive = existing.find(
      (e) => e.sequenceId === args.sequenceId && e.status === "active",
    );
    if (alreadyActive) throw new Error("Lead already enrolled in this sequence");

    const firstStep = sequence.steps[0];
    const nextSendAt = Date.now() + firstStep.delayDays * 86400000;

    return await ctx.db.insert("emailSequenceEnrollments", {
      orgId: lead.orgId,
      sequenceId: args.sequenceId,
      leadId: args.leadId,
      currentStep: 0,
      status: "active",
      nextSendAt,
      startedAt: Date.now(),
    });
  },
});

export const pauseEnrollment = mutation({
  args: { enrollmentId: v.id("emailSequenceEnrollments") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.enrollmentId, { status: "paused" });
    return true;
  },
});

export const cancelEnrollment = mutation({
  args: { enrollmentId: v.id("emailSequenceEnrollments") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.enrollmentId, { status: "cancelled" });
    return true;
  },
});

export const resumeEnrollment = mutation({
  args: { enrollmentId: v.id("emailSequenceEnrollments") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) throw new Error("Enrollment not found");

    const sequence = await ctx.db.get(enrollment.sequenceId);
    if (!sequence) throw new Error("Sequence not found");

    const step = sequence.steps[enrollment.currentStep];
    if (!step) {
      await ctx.db.patch(args.enrollmentId, { status: "completed", completedAt: Date.now() });
      return true;
    }

    await ctx.db.patch(args.enrollmentId, {
      status: "active",
      nextSendAt: Date.now() + step.delayDays * 86400000,
    });
    return true;
  },
});

// ========== INTERNAL — CRON PROCESSOR ==========

export const INTERNAL_processScheduledEmails = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all active enrollments where nextSendAt <= now
    const enrollments = await ctx.runMutation(internal.emailSequences.INTERNAL_getDueEnrollments, {});

    for (const enrollment of enrollments) {
      try {
        await ctx.runMutation(internal.emailSequences.INTERNAL_processOneEnrollment, {
          enrollmentId: enrollment._id,
        });
      } catch (err) {
        console.error(`Failed to process enrollment ${enrollment._id}:`, err);
      }
    }
  },
});

export const INTERNAL_getDueEnrollments = internalMutation({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const now = Date.now();
    return await ctx.db
      .query("emailSequenceEnrollments")
      .withIndex("status_nextSendAt", (q: any) =>
        q.eq("status", "active").lte("nextSendAt", now),
      )
      .take(50);
  },
});

export const INTERNAL_processOneEnrollment = internalMutation({
  args: { enrollmentId: v.id("emailSequenceEnrollments") },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment || enrollment.status !== "active") return;

    const sequence = await ctx.db.get(enrollment.sequenceId);
    if (!sequence) return;

    const step = sequence.steps[enrollment.currentStep];
    if (!step) {
      // No more steps — mark completed
      await ctx.db.patch(args.enrollmentId, {
        status: "completed",
        completedAt: Date.now(),
        nextSendAt: undefined,
      });
      return;
    }

    // Get lead email
    const lead = await ctx.db.get(enrollment.leadId);
    if (!lead?.contactEmail) {
      await ctx.db.patch(args.enrollmentId, { status: "cancelled" });
      return;
    }

    // Send the email
    try {
      const subject = step.subject
        .replace(/\{\{name\}\}/g, lead.contactName)
        .replace(/\{\{company\}\}/g, lead.company);
      const body = step.body
        .replace(/\{\{name\}\}/g, lead.contactName)
        .replace(/\{\{company\}\}/g, lead.company);

      await sendEmail({
        to: lead.contactEmail,
        subject,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${body.replace(/\n/g, "<br/>")}
          <hr style="border-color: #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Modern Phase</p>
        </div>`,
      });
    } catch (err) {
      console.error("Sequence email send failed:", err);
    }

    // Log CRM activity
    await ctx.db.insert("crmActivities", {
      orgId: enrollment.orgId,
      leadId: enrollment.leadId,
      type: "email",
      title: `Sequence email: ${step.subject}`,
      description: `Step ${enrollment.currentStep + 1} of "${sequence.name}"`,
      userId: sequence.createdBy,
      timestamp: Date.now(),
    });

    // Advance to next step or complete
    const nextStep = enrollment.currentStep + 1;
    if (nextStep >= sequence.steps.length) {
      await ctx.db.patch(args.enrollmentId, {
        currentStep: nextStep,
        status: "completed",
        completedAt: Date.now(),
        nextSendAt: undefined,
      });
    } else {
      const nextDelay = sequence.steps[nextStep].delayDays;
      await ctx.db.patch(args.enrollmentId, {
        currentStep: nextStep,
        nextSendAt: Date.now() + nextDelay * 86400000,
      });
    }
  },
});

// ========== SEEDER ==========

export const seedDefaultSequences = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("emailSequences")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    if (existing.length > 0) return 0;

    const defaults = [
      {
        name: "New Lead Nurture",
        steps: [
          { delayDays: 1, subject: "Welcome, {{name}}!", body: "Hi {{name}},\n\nThank you for your interest in Modern Phase. We help businesses like {{company}} build and ship software faster.\n\nI'd love to learn more about your needs. Would you have 15 minutes this week for a quick call?\n\nBest,\nModern Phase" },
          { delayDays: 3, subject: "How we helped companies like {{company}}", body: "Hi {{name}},\n\nI wanted to share how we've helped similar companies streamline their software development process.\n\nOur done-for-you approach means you get production-ready features without the overhead of hiring a full team.\n\nWould you like to see a demo?\n\nBest,\nModern Phase" },
          { delayDays: 7, subject: "Quick follow-up", body: "Hi {{name}},\n\nJust checking in — I know things get busy! If now isn't the right time, no worries. I'm here whenever you're ready to explore how we can help {{company}}.\n\nBest,\nModern Phase" },
        ],
      },
      {
        name: "Post-Proposal Follow-up",
        steps: [
          { delayDays: 2, subject: "Any questions about our proposal?", body: "Hi {{name}},\n\nI wanted to follow up on the proposal we sent. Do you have any questions about the scope, timeline, or investment?\n\nI'm happy to hop on a quick call to walk through anything.\n\nBest,\nModern Phase" },
          { delayDays: 5, subject: "Proposal reminder for {{company}}", body: "Hi {{name}},\n\nJust a friendly reminder that our proposal is still open. We're excited about the opportunity to work with {{company}}.\n\nLet me know if there's anything I can help with to move forward.\n\nBest,\nModern Phase" },
        ],
      },
    ];

    let count = 0;
    for (const seq of defaults) {
      await ctx.db.insert("emailSequences", {
        orgId: args.orgId,
        name: seq.name,
        steps: seq.steps,
        isActive: true,
        createdBy: userId,
      });
      count++;
    }
    return count;
  },
});
