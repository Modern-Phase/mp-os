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

export const getEnrollmentsByLead = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const enrollments = await ctx.db
      .query("emailSequenceEnrollments")
      .withIndex("leadId", (q: any) => q.eq("leadId", args.leadId))
      .collect();

    // Enrich with sequence name + total steps
    const result = [];
    for (const enrollment of enrollments) {
      const sequence = await ctx.db.get(enrollment.sequenceId);
      result.push({
        ...enrollment,
        sequenceName: sequence?.name || "Unknown",
        totalSteps: sequence?.steps?.length || 0,
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
      // === LEAD NURTURE ===
      {
        name: "New Lead Nurture",
        steps: [
          { delayDays: 1, subject: "Welcome, {{name}}!", body: "Hi {{name}},\n\nThank you for your interest in Modern Phase. We help businesses like {{company}} build and ship software faster.\n\nI'd love to learn more about your needs. Would you have 15 minutes this week for a quick call?\n\nBest,\nModern Phase" },
          { delayDays: 3, subject: "How we helped companies like {{company}}", body: "Hi {{name}},\n\nI wanted to share how we've helped similar companies streamline their software development process.\n\nOur done-for-you approach means you get production-ready features without the overhead of hiring a full team.\n\nWould you like to see a demo?\n\nBest,\nModern Phase" },
          { delayDays: 7, subject: "Quick follow-up", body: "Hi {{name}},\n\nJust checking in — I know things get busy! If now isn't the right time, no worries. I'm here whenever you're ready to explore how we can help {{company}}.\n\nBest,\nModern Phase" },
        ],
      },

      // === DISCOVERY FOLLOW-UP ===
      {
        name: "Discovery Call Follow-up",
        steps: [
          { delayDays: 1, subject: "Great chatting with you, {{name}}!", body: "Hi {{name}},\n\nThank you for taking the time to chat today! I really enjoyed learning about {{company}} and the challenges you're facing.\n\nAs discussed, here's a summary of what we covered:\n- Your current pain points and goals\n- How Modern Phase can help\n- Proposed next steps\n\nI'll be putting together a proposal based on our conversation and will have it to you within the next few days.\n\nBest,\nModern Phase" },
          { delayDays: 3, subject: "Your proposal is on the way", body: "Hi {{name}},\n\nJust a quick update — we're finalizing the proposal for {{company}} and you should receive it shortly.\n\nIn the meantime, if you think of any additional requirements or questions, don't hesitate to reach out.\n\nBest,\nModern Phase" },
        ],
      },

      // === PROPOSAL FOLLOW-UP ===
      {
        name: "Post-Proposal Follow-up",
        steps: [
          { delayDays: 2, subject: "Any questions about our proposal?", body: "Hi {{name}},\n\nI wanted to follow up on the proposal we sent for {{company}}. Do you have any questions about the scope, timeline, or investment?\n\nI'm happy to hop on a quick call to walk through anything.\n\nBest,\nModern Phase" },
          { delayDays: 5, subject: "Proposal update for {{company}}", body: "Hi {{name}},\n\nJust a friendly reminder that our proposal is still available. We're excited about the opportunity to work with {{company}}.\n\nIf the scope or pricing needs adjustment, I'm happy to discuss alternatives that better fit your budget.\n\nBest,\nModern Phase" },
          { delayDays: 10, subject: "Still interested, {{name}}?", body: "Hi {{name}},\n\nI wanted to check in one last time about our proposal for {{company}}. I know decision-making takes time, and I respect that.\n\nIf the timing isn't right, no worries at all. I'll keep your details on file and we can revisit whenever you're ready.\n\nBest,\nModern Phase" },
        ],
      },

      // === CONTRACT FOLLOW-UP ===
      {
        name: "Contract Signing Reminder",
        steps: [
          { delayDays: 2, subject: "Your contract is ready for signing", body: "Hi {{name}},\n\nJust a reminder that we've sent over the contract for your review and signature. You can review and sign it directly from the link in our previous email.\n\nIf you have any questions about the terms, I'm happy to walk through them with you.\n\nBest,\nModern Phase" },
          { delayDays: 5, subject: "Contract reminder — ready when you are", body: "Hi {{name}},\n\nI wanted to follow up on the contract we sent for {{company}}. We're looking forward to getting started!\n\nIf there are any terms you'd like to discuss or modify, please let me know. We want to make sure everything works for both parties.\n\nBest,\nModern Phase" },
        ],
      },

      // === WON ONBOARDING ===
      {
        name: "New Client Onboarding",
        steps: [
          { delayDays: 0, subject: "Welcome aboard, {{name}}! Here's what's next", body: "Hi {{name}},\n\nWelcome to Modern Phase! We're thrilled to have {{company}} on board.\n\nHere's what you can expect over the next few days:\n\n1. Project Setup (Today): We'll set up your project workspace and communication channels\n2. Kickoff Call (Within 48 hours): We'll schedule a kickoff meeting to align on priorities\n3. Development Starts: Once we're aligned, our team gets to work immediately\n\nIn the meantime, feel free to reach out with any questions.\n\nBest,\nModern Phase" },
          { delayDays: 3, subject: "Your project is underway!", body: "Hi {{name}},\n\nQuick update — your project is officially underway! Here's what our team has been working on:\n\n- Setting up the development environment\n- Mapping out the technical architecture\n- Prioritizing the feature backlog\n\nYou'll receive weekly progress updates every Monday. If you ever want a more detailed look, just let me know.\n\nBest,\nModern Phase" },
          { delayDays: 7, subject: "Week 1 check-in for {{company}}", body: "Hi {{name}},\n\nIt's been one week since we kicked off your project. I wanted to check in and make sure everything is meeting your expectations so far.\n\nIs there anything you'd like to adjust or prioritize differently? Your feedback is incredibly valuable, especially in these early stages.\n\nBest,\nModern Phase" },
        ],
      },

      // === LOST RE-ENGAGEMENT ===
      {
        name: "Lost Lead Re-engagement",
        steps: [
          { delayDays: 30, subject: "Checking in, {{name}}", body: "Hi {{name}},\n\nIt's been a little while since we last spoke about your project at {{company}}. I hope things are going well!\n\nSince we last talked, we've been working on some exciting projects and have refined our process even further. I'd love to share what's new and see if there's an opportunity to help.\n\nNo pressure at all — just want to stay connected.\n\nBest,\nModern Phase" },
          { delayDays: 60, subject: "New offerings from Modern Phase", body: "Hi {{name}},\n\nI wanted to share some updates from Modern Phase that might be relevant to {{company}}:\n\n- New service packages designed for faster delivery\n- Flexible payment options (milestone-based billing)\n- Expanded team capabilities\n\nIf any of these spark interest, I'd love to reconnect. Otherwise, I'll keep you on our updates list.\n\nBest,\nModern Phase" },
          { delayDays: 90, subject: "One last hello from Modern Phase", body: "Hi {{name}},\n\nI just wanted to reach out one more time to say that the door is always open at Modern Phase.\n\nIf {{company}} ever needs help with software development, design, or strategy, we're just an email away.\n\nWishing you all the best!\n\nBest,\nModern Phase" },
        ],
      },

      // === INVOICE FOLLOW-UP ===
      {
        name: "Invoice Payment Reminder",
        steps: [
          { delayDays: 7, subject: "Friendly payment reminder", body: "Hi {{name}},\n\nJust a friendly reminder that we have an invoice outstanding for {{company}}. If you've already sent the payment, please disregard this message.\n\nIf you have any questions about the invoice, I'm happy to help.\n\nBest,\nModern Phase" },
          { delayDays: 14, subject: "Invoice follow-up for {{company}}", body: "Hi {{name}},\n\nI wanted to follow up on the outstanding invoice for {{company}}. If there are any issues with the invoice or payment, please let me know so we can resolve them.\n\nWe value our relationship with {{company}} and want to make sure everything is in order.\n\nBest,\nModern Phase" },
          { delayDays: 30, subject: "Payment past due — {{company}}", body: "Hi {{name}},\n\nOur records show that the invoice for {{company}} is now past due. We'd like to resolve this as quickly as possible.\n\nIf there's an issue we can help with, or if you need to set up a payment plan, please reach out and we'll work something out.\n\nBest,\nModern Phase" },
        ],
      },

      // === POST-DELIVERY ===
      {
        name: "Post-Delivery Feedback & Referral",
        steps: [
          { delayDays: 7, subject: "How's everything working, {{name}}?", body: "Hi {{name}},\n\nIt's been a week since we delivered your project. I wanted to check in and see how everything is going.\n\nAre there any issues, questions, or tweaks you'd like us to address? We're here to make sure everything runs smoothly.\n\nBest,\nModern Phase" },
          { delayDays: 21, subject: "Quick feedback request for {{company}}", body: "Hi {{name}},\n\nI hope you're enjoying the results of our work together! We're always looking to improve, and your feedback means a lot.\n\nWould you mind sharing:\n- What went well?\n- What could we improve?\n- Would you recommend Modern Phase to others?\n\nA quick reply is all we need. Thank you!\n\nBest,\nModern Phase" },
          { delayDays: 45, subject: "Know anyone who could use our help?", body: "Hi {{name}},\n\nWe've really enjoyed working with {{company}} and hope you've been happy with the results.\n\nIf you know anyone who could benefit from our services — whether it's software development, design, or strategic consulting — we'd be grateful for a referral. We offer a referral bonus for any introduction that leads to a project.\n\nThank you for being a valued client!\n\nBest,\nModern Phase" },
        ],
      },

      // === UPSELL ===
      {
        name: "Upsell — Ongoing Services",
        steps: [
          { delayDays: 60, subject: "Keeping your software in top shape", body: "Hi {{name}},\n\nNow that your project has been live for a couple of months, I wanted to reach out about ongoing support.\n\nMany of our clients benefit from a monthly retainer that includes:\n- Bug fixes and maintenance\n- Security updates\n- Performance monitoring\n- New feature development\n\nWould you be interested in learning more about how we can keep {{company}}'s software running at its best?\n\nBest,\nModern Phase" },
          { delayDays: 90, subject: "What's next for {{company}}?", body: "Hi {{name}},\n\nAs {{company}} grows, your software needs will evolve too. We've helped many clients expand their platforms with:\n\n- Mobile app development\n- API integrations\n- Analytics dashboards\n- Automation tools\n\nI'd love to chat about your roadmap and see how we can support your next phase of growth.\n\nBest,\nModern Phase" },
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
