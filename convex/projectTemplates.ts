// convex/projectTemplates.ts — Project template seed data and queries

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { AGENT_IDS } from "./schema";

// ========== SEED DATA ==========

const GLOBAL_TEMPLATES = [
  {
    name: "Website Build",
    description: "Full website design and development project with client handoff",
    icon: "🌐",
    isGlobal: true as const,
    taskTemplates: [
      { title: "Draft SOW and project contract", description: "Prepare statement of work and client contract for signature", agentId: AGENT_IDS.FIONA, priority: "high" as const, tags: ["legal", "contracts"], order: 0 },
      { title: "Set up project invoice schedule", description: "Create milestone-based invoicing plan aligned with deliverables", agentId: AGENT_IDS.FIONA, priority: "high" as const, tags: ["finance"], order: 1 },
      { title: "Technical architecture and stack decision", description: "Evaluate requirements and select the right tech stack, hosting, and infrastructure", agentId: AGENT_IDS.TAYLOR, priority: "high" as const, tags: ["architecture"], order: 2 },
      { title: "Brand discovery and wireframes", description: "Run brand workshop, gather assets, and produce initial wireframes", agentId: AGENT_IDS.TAYLOR, priority: "high" as const, tags: ["design", "ux"], order: 3 },
      { title: "Create project Kanban and timeline", description: "Set up tracking board, milestones, and delivery schedule", agentId: AGENT_IDS.OLIVER, priority: "medium" as const, tags: ["ops", "planning"], order: 4 },
      { title: "Schedule kickoff meeting with client", description: "Coordinate calendars and send agenda for project kickoff", agentId: AGENT_IDS.OLIVER, priority: "medium" as const, tags: ["scheduling"], order: 5 },
      { title: "Development environment setup", description: "Initialize repo, CI/CD pipeline, staging environment, and dev tooling", agentId: AGENT_IDS.TAYLOR, priority: "medium" as const, tags: ["technical"], order: 6 },
      { title: "UI component library and design system", description: "Build reusable component library matching brand guidelines", agentId: AGENT_IDS.TAYLOR, priority: "medium" as const, tags: ["design"], order: 7 },
      { title: "Build and QA", description: "Core development, integration testing, and cross-browser QA", agentId: AGENT_IDS.TAYLOR, priority: "medium" as const, tags: ["development"], order: 8 },
      { title: "Client UAT coordination and delivery handoff", description: "Coordinate user acceptance testing, collect feedback, and hand off final deliverables", agentId: AGENT_IDS.OLIVER, priority: "medium" as const, tags: ["delivery"], order: 9 },
    ],
  },
  {
    name: "SaaS MVP",
    description: "Minimum viable SaaS product — auth, billing, core features, and launch",
    icon: "🚀",
    isGlobal: true as const,
    taskTemplates: [
      { title: "MSA and SaaS-specific terms", description: "Draft master service agreement with SaaS licensing, data handling, and SLA terms", agentId: AGENT_IDS.FIONA, priority: "high" as const, tags: ["legal"], order: 0 },
      { title: "Architecture — auth, data model, infra", description: "Design authentication flow, database schema, and cloud infrastructure", agentId: AGENT_IDS.TAYLOR, priority: "urgent" as const, tags: ["architecture"], order: 1 },
      { title: "MVP user flows and prototype", description: "Map critical user journeys and build interactive prototype for validation", agentId: AGENT_IDS.TAYLOR, priority: "high" as const, tags: ["design", "ux"], order: 2 },
      { title: "Billing integration plan", description: "Plan Stripe integration, pricing tiers, and subscription lifecycle", agentId: AGENT_IDS.FIONA, priority: "high" as const, tags: ["finance"], order: 3 },
      { title: "Sprint planning and milestone tracking", description: "Set up agile sprints, velocity tracking, and milestone checkpoints", agentId: AGENT_IDS.OLIVER, priority: "medium" as const, tags: ["ops"], order: 4 },
      { title: "Core feature development", description: "Build the primary value-delivering features of the MVP", agentId: AGENT_IDS.TAYLOR, priority: "high" as const, tags: ["development"], order: 5 },
      { title: "Design polish and accessibility", description: "Refine UI details, ensure WCAG compliance, and optimize responsive layouts", agentId: AGENT_IDS.TAYLOR, priority: "medium" as const, tags: ["design"], order: 6 },
      { title: "Beta launch coordination", description: "Coordinate beta invites, feedback collection, and bug triage", agentId: AGENT_IDS.OLIVER, priority: "medium" as const, tags: ["delivery"], order: 7 },
      { title: "Revenue tracking setup", description: "Configure MRR dashboards, churn tracking, and financial reporting", agentId: AGENT_IDS.FIONA, priority: "medium" as const, tags: ["finance"], order: 8 },
      { title: "Launch content and product announcement", description: "Write launch blog post, social media content, and product hunt copy", agentId: AGENT_IDS.LARRY, priority: "medium" as const, tags: ["marketing"], order: 9 },
    ],
  },
  {
    name: "Brand Package",
    description: "Complete brand identity — logo, guidelines, voice, and collateral",
    icon: "🎨",
    isGlobal: true as const,
    taskTemplates: [
      { title: "Creative services agreement", description: "Draft contract covering IP ownership, revisions, and deliverables scope", agentId: AGENT_IDS.FIONA, priority: "high" as const, tags: ["legal"], order: 0 },
      { title: "Brand discovery workshop and brief", description: "Facilitate brand workshop, synthesize findings into a creative brief", agentId: AGENT_IDS.TAYLOR, priority: "high" as const, tags: ["design", "brand"], order: 1 },
      { title: "Logo and visual identity system", description: "Design logo, color palette, typography, and iconography system", agentId: AGENT_IDS.TAYLOR, priority: "high" as const, tags: ["design"], order: 2 },
      { title: "Brand guidelines document", description: "Compile comprehensive brand guidelines covering all visual and usage standards", agentId: AGENT_IDS.TAYLOR, priority: "medium" as const, tags: ["design", "docs"], order: 3 },
      { title: "Brand voice and messaging guide", description: "Define tone of voice, key messages, taglines, and copywriting standards", agentId: AGENT_IDS.LARRY, priority: "medium" as const, tags: ["marketing", "content"], order: 4 },
      { title: "Collateral and asset delivery", description: "Produce business cards, social templates, and export all assets in required formats", agentId: AGENT_IDS.TAYLOR, priority: "medium" as const, tags: ["design", "delivery"], order: 5 },
      { title: "Final invoice and project close", description: "Send final invoice, archive project files, and close out engagement", agentId: AGENT_IDS.FIONA, priority: "medium" as const, tags: ["finance"], order: 6 },
    ],
  },
];

// ========== QUERIES ==========

export const getProjectTemplates = query({
  args: { orgId: v.id("organizations") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const globalTemplates = await ctx.db
      .query("projectTemplates")
      .withIndex("isGlobal", (q) => q.eq("isGlobal", true))
      .collect();

    const orgTemplates = await ctx.db
      .query("projectTemplates")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    // Dedupe (org templates with same name override globals)
    const orgNames = new Set(orgTemplates.map((t) => t.name));
    const merged = [
      ...globalTemplates.filter((t) => !orgNames.has(t.name)),
      ...orgTemplates,
    ];

    return merged;
  },
});

// ========== MUTATIONS ==========

export const seedProjectTemplates = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Idempotent: check if global templates already exist
    const existing = await ctx.db
      .query("projectTemplates")
      .withIndex("isGlobal", (q) => q.eq("isGlobal", true))
      .first();
    if (existing) return null;

    for (const template of GLOBAL_TEMPLATES) {
      await ctx.db.insert("projectTemplates", template);
    }

    return null;
  },
});
