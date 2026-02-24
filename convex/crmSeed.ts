// convex/crmSeed.ts — Extracted CRM mock/demo data + seed mutation

import { v } from "convex/values";
import { mutation } from "./_generated/server";

// ========== AUTH HELPER ==========

async function getAuthUserId(ctx: any): Promise<any | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

// ========== MOCK DATA ==========

const MOCK_LEADS = [
  {
    company: "Acme Corp",
    contactName: "Sarah Chen",
    contactEmail: "sarah@acme.com",
    contactTitle: "VP of Engineering",
    contactLinkedin: "https://linkedin.com/in/sarachen",
    stage: "negotiation" as const,
    source: "inbound" as const,
    value: 4500000,
    description: "Enterprise SaaS rebuild — migrating from legacy PHP monolith to modern React + microservices stack.",
    nextStep: "Send revised SOW with Phase 2 pricing",
    nextFollowUp: Date.now() + 2 * 86400000,
    assignedAgent: "larry" as const,
    tags: ["enterprise", "saas", "migration"],
  },
  {
    company: "Bloom Health",
    contactName: "Marcus Rivera",
    contactEmail: "marcus@bloomhealth.io",
    contactTitle: "CTO",
    stage: "proposal" as const,
    source: "referral" as const,
    value: 2800000,
    description: "Patient portal with HIPAA-compliant chat, scheduling, and EHR integration.",
    nextStep: "Follow up on proposal sent last week",
    nextFollowUp: Date.now() - 86400000, // overdue
    assignedAgent: "lexi" as const,
    tags: ["healthcare", "hipaa", "portal"],
  },
  {
    company: "NovaPay",
    contactName: "Jessica Park",
    contactEmail: "jpark@novapay.com",
    contactTitle: "Head of Product",
    contactPhone: "+1 (415) 555-0199",
    stage: "discovery" as const,
    source: "linkedin" as const,
    value: 1500000,
    description: "Fintech dashboard for merchant analytics and real-time transaction monitoring.",
    nextStep: "Schedule discovery call with their eng team",
    nextFollowUp: Date.now() + 5 * 86400000,
    assignedAgent: "larry" as const,
    tags: ["fintech", "dashboard", "analytics"],
  },
  {
    company: "GreenThread Apparel",
    contactName: "Omar Farouk",
    contactEmail: "omar@greenthread.co",
    contactTitle: "Founder & CEO",
    stage: "qualified" as const,
    source: "cold_outreach" as const,
    value: 750000,
    description: "Sustainable fashion e-commerce platform with AI-powered sizing recommendations.",
    nextStep: "Send case study for similar e-commerce build",
    nextFollowUp: Date.now() + 3 * 86400000,
    assignedAgent: "lexi" as const,
    tags: ["ecommerce", "ai", "fashion"],
  },
  {
    company: "Ridgeline Analytics",
    contactName: "Priya Sharma",
    contactEmail: "priya@ridgelineanalytics.com",
    contactTitle: "Director of Engineering",
    stage: "new_lead" as const,
    source: "website" as const,
    value: 3200000,
    description: "Data visualization platform for geospatial intelligence and climate risk analysis.",
    tags: ["data-viz", "geospatial", "climate"],
  },
  {
    company: "UrbanNest Realty",
    contactName: "David Kim",
    contactEmail: "david@urbannest.com",
    contactTitle: "COO",
    contactPhone: "+1 (312) 555-0142",
    stage: "new_lead" as const,
    source: "inbound" as const,
    value: 900000,
    description: "Property management portal with tenant communication, maintenance tracking, and payment processing.",
    tags: ["proptech", "portal"],
  },
  {
    company: "Synthwave Studios",
    contactName: "Alex Turner",
    contactEmail: "alex@synthwave.dev",
    contactTitle: "Technical Director",
    stage: "won" as const,
    source: "referral" as const,
    value: 1200000,
    description: "Creative agency website + project management tool. Signed Q4 last year.",
    assignedAgent: "larry" as const,
    tags: ["agency", "creative"],
  },
  {
    company: "CloudForge",
    contactName: "Nina Kowalski",
    contactEmail: "nina@cloudforge.io",
    contactTitle: "CEO",
    stage: "won" as const,
    source: "linkedin" as const,
    value: 6500000,
    description: "DevOps platform rebuild with multi-cloud deployment orchestration. Our biggest contract.",
    assignedAgent: "lexi" as const,
    tags: ["devops", "enterprise", "multi-cloud"],
  },
  {
    company: "FreshBite Delivery",
    contactName: "Carlos Mendez",
    contactEmail: "carlos@freshbite.app",
    contactTitle: "VP Product",
    stage: "lost" as const,
    source: "cold_outreach" as const,
    value: 2000000,
    description: "Food delivery marketplace. Lost to cheaper offshore competitor.",
    lostReason: "Went with lower-cost offshore team",
    assignedAgent: "larry" as const,
    tags: ["marketplace", "delivery"],
  },
  {
    company: "Beacon Education",
    contactName: "Lauren Mills",
    contactEmail: "lauren@beaconedu.org",
    contactTitle: "Director of Technology",
    stage: "discovery" as const,
    source: "referral" as const,
    value: 1800000,
    description: "Learning management system with AI tutoring, progress tracking, and parent dashboard.",
    nextStep: "Demo our LMS prototype",
    nextFollowUp: Date.now() + 7 * 86400000,
    assignedAgent: "lexi" as const,
    tags: ["edtech", "ai", "lms"],
  },
  {
    company: "Vaultline Security",
    contactName: "James Whitfield",
    contactEmail: "j.whitfield@vaultline.com",
    contactTitle: "CISO",
    contactPhone: "+1 (202) 555-0177",
    stage: "proposal" as const,
    source: "inbound" as const,
    value: 5000000,
    description: "Security operations dashboard with threat intelligence feeds, incident response workflows, and compliance reporting.",
    nextStep: "Technical architecture review meeting",
    nextFollowUp: Date.now() + 1 * 86400000,
    assignedAgent: "larry" as const,
    tags: ["cybersecurity", "enterprise", "compliance"],
  },
  {
    company: "PetPal",
    contactName: "Emily Nakamura",
    contactEmail: "emily@petpal.app",
    contactTitle: "Founder",
    stage: "qualified" as const,
    source: "website" as const,
    value: 450000,
    description: "Pet care marketplace connecting pet owners with walkers, sitters, and groomers.",
    nextStep: "Scope MVP features and timeline",
    nextFollowUp: Date.now() + 4 * 86400000,
    tags: ["marketplace", "mobile", "mvp"],
  },
  {
    company: "Atlas Freight",
    contactName: "Robert Okafor",
    contactEmail: "rokafor@atlasfreight.com",
    contactTitle: "Head of Digital",
    stage: "negotiation" as const,
    source: "cold_outreach" as const,
    value: 3500000,
    description: "Logistics tracking platform with real-time fleet monitoring, route optimization, and shipper portal.",
    nextStep: "Final contract review with legal",
    nextFollowUp: Date.now() + 2 * 86400000,
    assignedAgent: "lexi" as const,
    tags: ["logistics", "enterprise", "real-time"],
  },
  {
    company: "MindBridge Therapy",
    contactName: "Dr. Amara Osei",
    contactEmail: "amara@mindbridge.health",
    contactTitle: "Medical Director",
    stage: "lost" as const,
    source: "referral" as const,
    value: 1100000,
    description: "Teletherapy platform with session scheduling and secure video. Project put on hold.",
    lostReason: "Budget frozen — revisiting in 6 months",
    assignedAgent: "lexi" as const,
    tags: ["telehealth", "video"],
  },
];

const MOCK_ACTIVITIES = [
  { leadIdx: 0, type: "email" as const, title: "Initial inquiry response", description: "Sent overview deck and case studies for enterprise migrations.", daysAgo: 14 },
  { leadIdx: 0, type: "call" as const, title: "Discovery call with Sarah and CTO", description: "Discussed current architecture pain points, timeline expectations. They want to start Q2.", daysAgo: 10 },
  { leadIdx: 0, type: "meeting" as const, title: "Technical deep-dive", description: "3-hour workshop with their eng team. Mapped out microservices architecture.", daysAgo: 5 },
  { leadIdx: 0, type: "proposal_sent" as const, title: "SOW v1 sent", description: "Phase 1: $45k for API layer and auth. Phase 2: $38k for frontend rebuild.", daysAgo: 3 },
  { leadIdx: 1, type: "call" as const, title: "Intro call with Marcus", description: "Referred by CloudForge. Needs HIPAA-compliant patient portal ASAP.", daysAgo: 8 },
  { leadIdx: 1, type: "proposal_sent" as const, title: "Proposal sent", description: "3-phase proposal: Portal MVP, EHR Integration, Telehealth add-on.", daysAgo: 4 },
  { leadIdx: 2, type: "email" as const, title: "Connected on LinkedIn", description: "Jessica liked our fintech case study post. Started conversation.", daysAgo: 6 },
  { leadIdx: 2, type: "note" as const, title: "Researched NovaPay", description: "Series B startup, 50 employees, processing $2B annually. Good fit.", daysAgo: 5 },
  { leadIdx: 3, type: "email" as const, title: "Cold outreach sent", description: "Personalized email about sustainable tech and our e-commerce work.", daysAgo: 12 },
  { leadIdx: 3, type: "call" as const, title: "Qualification call", description: "Omar bootstrapped to $5M ARR. Wants custom storefront by summer.", daysAgo: 7 },
  { leadIdx: 6, type: "contract_sent" as const, title: "Contract signed", description: "12-week engagement, $12k total. Starting next Monday.", daysAgo: 30 },
  { leadIdx: 7, type: "meeting" as const, title: "Executive presentation", description: "Presented to C-suite. Unanimous approval.", daysAgo: 45 },
  { leadIdx: 7, type: "contract_sent" as const, title: "MSA executed", description: "$65k engagement with 2-year support addendum.", daysAgo: 40 },
  { leadIdx: 8, type: "call" as const, title: "Initial outreach", description: "Cold call, connected with Carlos. Interested but price-sensitive.", daysAgo: 20 },
  { leadIdx: 8, type: "proposal_sent" as const, title: "Competitive proposal sent", daysAgo: 15 },
  { leadIdx: 8, type: "note" as const, title: "Lost to offshore competitor", description: "Carlos confirmed they went with a team in Eastern Europe at 40% of our price.", daysAgo: 8 },
  { leadIdx: 9, type: "email" as const, title: "Intro from mutual contact", description: "Lauren referred by Beacon's board member who knows our work.", daysAgo: 10 },
  { leadIdx: 9, type: "call" as const, title: "Needs assessment call", description: "Current LMS is outdated. Need AI tutoring, mobile-first, accessibility compliance.", daysAgo: 6 },
  { leadIdx: 10, type: "email" as const, title: "Inbound from website", description: "James filled out enterprise contact form. Urgent need.", daysAgo: 7 },
  { leadIdx: 10, type: "meeting" as const, title: "Security requirements workshop", description: "4-hour deep dive on compliance needs: SOC2, FedRAMP, threat modeling.", daysAgo: 4 },
  { leadIdx: 10, type: "proposal_sent" as const, title: "Proposal sent", description: "Enterprise proposal with dedicated security architect.", daysAgo: 2 },
  { leadIdx: 12, type: "call" as const, title: "Cold call connected", description: "Robert interested in modernizing their legacy tracking system.", daysAgo: 15 },
  { leadIdx: 12, type: "meeting" as const, title: "On-site visit", description: "Toured their logistics center. Mapped out integration points with existing systems.", daysAgo: 8 },
  { leadIdx: 12, type: "proposal_sent" as const, title: "Proposal and demo", description: "Live demo of similar platform we built. Proposal for $35k.", daysAgo: 4 },
  { leadIdx: 13, type: "call" as const, title: "Referral intro call", description: "Dr. Osei referred by MindBridge board member.", daysAgo: 25 },
  { leadIdx: 13, type: "note" as const, title: "Project on hold", description: "Budget freeze across the organization. Will revisit in 6 months.", daysAgo: 10 },
];

// ========== SEED MUTATION ==========

export const seedCrmData = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Check if data already exists
    const existing = await ctx.db
      .query("crmLeads")
      .withIndex("orgId", (q: any) => q.eq("orgId", args.orgId))
      .first();
    if (existing) throw new Error("CRM already has data. Delete existing leads first.");

    const leadIds: any[] = [];

    for (const mock of MOCK_LEADS) {
      const leadId = await ctx.db.insert("crmLeads", {
        orgId: args.orgId,
        company: mock.company,
        contactName: mock.contactName,
        contactEmail: mock.contactEmail,
        contactPhone: mock.contactPhone,
        contactLinkedin: mock.contactLinkedin,
        contactTitle: mock.contactTitle,
        stage: mock.stage,
        source: mock.source,
        value: mock.value,
        currency: "usd",
        description: mock.description,
        nextStep: mock.nextStep,
        nextFollowUp: mock.nextFollowUp,
        assignedAgent: mock.assignedAgent,
        tags: mock.tags || [],
        lostReason: mock.lostReason,
        closedAt: (mock.stage === "won" || mock.stage === "lost") ? Date.now() - 30 * 86400000 : undefined,
        createdBy: userId,
      });
      leadIds.push(leadId);
    }

    // Add activities
    for (const act of MOCK_ACTIVITIES) {
      const leadId = leadIds[act.leadIdx];
      const lead = MOCK_LEADS[act.leadIdx];
      await ctx.db.insert("crmActivities", {
        orgId: args.orgId,
        leadId,
        type: act.type,
        title: act.title,
        description: act.description,
        agentId: lead.assignedAgent,
        userId,
        timestamp: Date.now() - act.daysAgo * 86400000,
      });
    }

    return null;
  },
});
