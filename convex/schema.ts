import { defineSchema, defineTable } from "convex/server";
import { v, Infer } from "convex/values";

export const CURRENCIES = {
  USD: "usd",
  EUR: "eur",
} as const;
export const currencyValidator = v.union(
  v.literal(CURRENCIES.USD),
  v.literal(CURRENCIES.EUR),
);
export type Currency = Infer<typeof currencyValidator>;

export const INTERVALS = {
  MONTH: "month",
  YEAR: "year",
} as const;
export const intervalValidator = v.union(
  v.literal(INTERVALS.MONTH),
  v.literal(INTERVALS.YEAR),
);
export type Interval = Infer<typeof intervalValidator>;

export const PLANS = {
  FREE: "free",
  PRO: "pro",
} as const;
export const planKeyValidator = v.union(
  v.literal(PLANS.FREE),
  v.literal(PLANS.PRO),
);
export type PlanKey = Infer<typeof planKeyValidator>;

const priceValidator = v.object({
  stripeId: v.string(),
  amount: v.number(),
});
const pricesValidator = v.object({
  [CURRENCIES.USD]: priceValidator,
  [CURRENCIES.EUR]: priceValidator,
});

// Document types for multi-modal support
export const DOCUMENT_TYPES = {
  TEXT: "text",
  PDF: "pdf",
  CSV: "csv",
  IMAGE: "image",
  AUDIO: "audio",
  VIDEO: "video",
} as const;
export const documentTypeValidator = v.union(
  v.literal(DOCUMENT_TYPES.TEXT),
  v.literal(DOCUMENT_TYPES.PDF),
  v.literal(DOCUMENT_TYPES.CSV),
  v.literal(DOCUMENT_TYPES.IMAGE),
  v.literal(DOCUMENT_TYPES.AUDIO),
  v.literal(DOCUMENT_TYPES.VIDEO),
);

// Processing status for documents
export const PROCESSING_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export const processingStatusValidator = v.union(
  v.literal(PROCESSING_STATUS.PENDING),
  v.literal(PROCESSING_STATUS.PROCESSING),
  v.literal(PROCESSING_STATUS.COMPLETED),
  v.literal(PROCESSING_STATUS.FAILED),
);

// Processing job status for large documents
export const JOB_STATUS = {
  QUEUED: "queued",
  UPLOADING: "uploading",
  PARSING: "parsing",
  CHUNKING: "chunking",
  EMBEDDING: "embedding",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export const jobStatusValidator = v.union(
  v.literal(JOB_STATUS.QUEUED),
  v.literal(JOB_STATUS.UPLOADING),
  v.literal(JOB_STATUS.PARSING),
  v.literal(JOB_STATUS.CHUNKING),
  v.literal(JOB_STATUS.EMBEDDING),
  v.literal(JOB_STATUS.COMPLETED),
  v.literal(JOB_STATUS.FAILED),
);
export type JobStatus = Infer<typeof jobStatusValidator>;

// AGENT SYSTEM - Multi-agent task management
export const AGENT_IDS = {
  LARRY: "larry",
  OLIVER: "oliver",
  FIONA: "fiona",
  TAYLOR: "taylor",
  MAX: "max",
} as const;

export const agentIdValidator = v.union(
  v.literal(AGENT_IDS.LARRY),
  v.literal(AGENT_IDS.OLIVER),
  v.literal(AGENT_IDS.FIONA),
  v.literal(AGENT_IDS.TAYLOR),
  v.literal(AGENT_IDS.MAX),
);
export type AgentId = Infer<typeof agentIdValidator>;

export const AGENT_DEPARTMENTS = {
  SALES: "sales",       // Larry — Sales & Marketing
  OPS: "ops",           // Oliver — Operations
  FINANCE: "finance",   // Fiona — Finance & Legal
  DELIVERY: "delivery", // Taylor — Delivery
  MANAGEMENT: "management", // Max — Management (voice)
} as const;

export const TASK_STATUSES = {
  BACKLOG: "backlog",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  BLOCKED: "blocked",
  DONE: "done",
} as const;

export const taskStatusValidator = v.union(
  v.literal(TASK_STATUSES.BACKLOG),
  v.literal(TASK_STATUSES.TODO),
  v.literal(TASK_STATUSES.IN_PROGRESS),
  v.literal(TASK_STATUSES.REVIEW),
  v.literal(TASK_STATUSES.BLOCKED),
  v.literal(TASK_STATUSES.DONE),
);
export type TaskStatus = Infer<typeof taskStatusValidator>;

export const PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export const priorityValidator = v.union(
  v.literal(PRIORITIES.LOW),
  v.literal(PRIORITIES.MEDIUM),
  v.literal(PRIORITIES.HIGH),
  v.literal(PRIORITIES.URGENT),
);
export type Priority = Infer<typeof priorityValidator>;

// CRM - Company sizes
export const COMPANY_SIZES = {
  SOLO: "solo",
  STARTUP: "startup",
  SMALL: "small",
  MEDIUM: "medium",
  ENTERPRISE: "enterprise",
} as const;

export const companySizeValidator = v.union(
  v.literal(COMPANY_SIZES.SOLO),
  v.literal(COMPANY_SIZES.STARTUP),
  v.literal(COMPANY_SIZES.SMALL),
  v.literal(COMPANY_SIZES.MEDIUM),
  v.literal(COMPANY_SIZES.ENTERPRISE),
);
export type CompanySize = Infer<typeof companySizeValidator>;

// CRM - Pipeline and lead management
export const PIPELINE_STAGES = {
  NEW_LEAD: "new_lead",
  QUALIFIED: "qualified",
  DISCOVERY: "discovery",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
} as const;

export const pipelineStageValidator = v.union(
  v.literal(PIPELINE_STAGES.NEW_LEAD),
  v.literal(PIPELINE_STAGES.QUALIFIED),
  v.literal(PIPELINE_STAGES.DISCOVERY),
  v.literal(PIPELINE_STAGES.PROPOSAL),
  v.literal(PIPELINE_STAGES.NEGOTIATION),
  v.literal(PIPELINE_STAGES.WON),
  v.literal(PIPELINE_STAGES.LOST),
);
export type PipelineStage = Infer<typeof pipelineStageValidator>;

export const LEAD_SOURCES = {
  COLD_OUTREACH: "cold_outreach",
  INBOUND: "inbound",
  REFERRAL: "referral",
  LINKEDIN: "linkedin",
  WEBSITE: "website",
  OTHER: "other",
} as const;

export const leadSourceValidator = v.union(
  v.literal(LEAD_SOURCES.COLD_OUTREACH),
  v.literal(LEAD_SOURCES.INBOUND),
  v.literal(LEAD_SOURCES.REFERRAL),
  v.literal(LEAD_SOURCES.LINKEDIN),
  v.literal(LEAD_SOURCES.WEBSITE),
  v.literal(LEAD_SOURCES.OTHER),
);
export type LeadSource = Infer<typeof leadSourceValidator>;

export const CRM_ACTIVITY_TYPES = {
  CALL: "call",
  EMAIL: "email",
  MEETING: "meeting",
  NOTE: "note",
  PROPOSAL_SENT: "proposal_sent",
  CONTRACT_SENT: "contract_sent",
  STATUS_CHANGE: "status_change",
} as const;

export const crmActivityTypeValidator = v.union(
  v.literal(CRM_ACTIVITY_TYPES.CALL),
  v.literal(CRM_ACTIVITY_TYPES.EMAIL),
  v.literal(CRM_ACTIVITY_TYPES.MEETING),
  v.literal(CRM_ACTIVITY_TYPES.NOTE),
  v.literal(CRM_ACTIVITY_TYPES.PROPOSAL_SENT),
  v.literal(CRM_ACTIVITY_TYPES.CONTRACT_SENT),
  v.literal(CRM_ACTIVITY_TYPES.STATUS_CHANGE),
);
export type CrmActivityType = Infer<typeof crmActivityTypeValidator>;

// NOTIFICATION SYSTEM
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: "task_assigned",
  TASK_HANDOFF: "task_handoff",
  TASK_COMPLETED: "task_completed",
  AGENT_ERROR: "agent_error",
  LEAD_STAGE_CHANGE: "lead_stage_change",
  AGENT_MESSAGE: "agent_message",
  EMAIL_REPLY: "email_reply",
  EMAIL_BOUNCE: "email_bounce",
  INVOICE_SENT: "invoice_sent",
  INVOICE_PAID: "invoice_paid",
  PROPOSAL_SENT: "proposal_sent",
  PROPOSAL_ACCEPTED: "proposal_accepted",
  PROPOSAL_REJECTED: "proposal_rejected",
  CONTRACT_SENT: "contract_sent",
  CONTRACT_SIGNED: "contract_signed",
} as const;

export const notificationTypeValidator = v.union(
  v.literal("task_assigned"),
  v.literal("task_handoff"),
  v.literal("task_completed"),
  v.literal("agent_error"),
  v.literal("lead_stage_change"),
  v.literal("agent_message"),
  v.literal("email_reply"),
  v.literal("email_bounce"),
  v.literal("invoice_sent"),
  v.literal("invoice_paid"),
  v.literal("proposal_sent"),
  v.literal("proposal_accepted"),
  v.literal("proposal_rejected"),
  v.literal("contract_sent"),
  v.literal("contract_signed"),
);
export type NotificationType = Infer<typeof notificationTypeValidator>;

// INVOICE SYSTEM
export const INVOICE_STATUSES = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
} as const;
export const invoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("cancelled"),
);
export type InvoiceStatus = Infer<typeof invoiceStatusValidator>;

// PROPOSAL SYSTEM
export const PROPOSAL_STATUSES = {
  DRAFT: "draft",
  SENT: "sent",
  VIEWED: "viewed",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;
export const proposalStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("accepted"),
  v.literal("rejected"),
);
export type ProposalStatus = Infer<typeof proposalStatusValidator>;

// CONTRACT SYSTEM
export const CONTRACT_STATUSES = {
  DRAFT: "draft",
  SENT: "sent",
  VIEWED: "viewed",
  SIGNED: "signed",
  EXPIRED: "expired",
} as const;
export const contractStatusValidator = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("signed"),
  v.literal("expired"),
);
export type ContractStatus = Infer<typeof contractStatusValidator>;

// WORKFLOW AUTOMATION
export const WORKFLOW_TRIGGERS = {
  STAGE_CHANGE: "stage_change",
  PROJECT_STATUS_CHANGE: "project_status_change",
  INVOICE_STATUS_CHANGE: "invoice_status_change",
  PROPOSAL_STATUS_CHANGE: "proposal_status_change",
  CONTRACT_STATUS_CHANGE: "contract_status_change",
  MANUAL: "manual",
} as const;
export const workflowTriggerValidator = v.union(
  v.literal("stage_change"),
  v.literal("project_status_change"),
  v.literal("invoice_status_change"),
  v.literal("proposal_status_change"),
  v.literal("contract_status_change"),
  v.literal("manual"),
);
export type WorkflowTrigger = Infer<typeof workflowTriggerValidator>;

export const WORKFLOW_ACTION_TYPES = {
  CREATE_INVOICE: "create_invoice",
  CREATE_PROPOSAL: "create_proposal",
  CREATE_CONTRACT: "create_contract",
  SEND_EMAIL: "send_email",
  CREATE_TASK: "create_task",
  UPDATE_STAGE: "update_stage",
} as const;
export const workflowActionTypeValidator = v.union(
  v.literal("create_invoice"),
  v.literal("create_proposal"),
  v.literal("create_contract"),
  v.literal("send_email"),
  v.literal("create_task"),
  v.literal("update_stage"),
);
export type WorkflowActionType = Infer<typeof workflowActionTypeValidator>;

// EMAIL SEQUENCES
export const ENROLLMENT_STATUSES = {
  ACTIVE: "active",
  COMPLETED: "completed",
  PAUSED: "paused",
  CANCELLED: "cancelled",
} as const;
export const enrollmentStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("paused"),
  v.literal("cancelled"),
);
export type EnrollmentStatus = Infer<typeof enrollmentStatusValidator>;

export const PROJECT_STATUSES = {
  PLANNING: "planning",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DELIVERED: "delivered",
} as const;

// EXPENSE CATEGORIES
export const EXPENSE_CATEGORIES = {
  LABOR: "labor",
  TOOLS: "tools",
  HOSTING: "hosting",
  SERVICES: "services",
  MARKETING: "marketing",
  OTHER: "other",
} as const;
export const expenseCategoryValidator = v.union(
  v.literal("labor"),
  v.literal("tools"),
  v.literal("hosting"),
  v.literal("services"),
  v.literal("marketing"),
  v.literal("other"),
);
export type ExpenseCategory = Infer<typeof expenseCategoryValidator>;

// TEMPLATE TYPES (for gallery)
export const templateTypeValidator = v.union(
  v.literal("invoice"),
  v.literal("proposal"),
  v.literal("contract"),
);
export type TemplateType = Infer<typeof templateTypeValidator>;

// INTEGRATION PROVIDERS
export const integrationProviderValidator = v.union(
  v.literal("quickbooks"),
  v.literal("github"),
);
export type IntegrationProvider = Infer<typeof integrationProviderValidator>;

export const integrationStatusValidator = v.union(
  v.literal("active"),
  v.literal("expired"),
  v.literal("disconnected"),
  v.literal("error"),
);
export type IntegrationStatus = Infer<typeof integrationStatusValidator>;

// SIGNING METHOD
export const signingMethodValidator = v.union(
  v.literal("builtin"),
  v.literal("docuseal"),
);
export type SigningMethod = Infer<typeof signingMethodValidator>;

const schema = defineSchema({
  users: defineTable({
    clerkId: v.optional(v.string()),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isAdmin: v.optional(v.boolean()),
    customerId: v.optional(v.string()),
  })
    .index("clerkId", ["clerkId"])
    .index("email", ["email"])
    .index("customerId", ["customerId"]),
  plans: defineTable({
    key: planKeyValidator,
    stripeId: v.string(),
    name: v.string(),
    description: v.string(),
    prices: v.object({
      [INTERVALS.MONTH]: pricesValidator,
      [INTERVALS.YEAR]: pricesValidator,
    }),
  })
    .index("key", ["key"])
    .index("stripeId", ["stripeId"]),
  subscriptions: defineTable({
    userId: v.id("users"),
    planId: v.id("plans"),
    priceStripeId: v.string(),
    stripeId: v.string(),
    currency: currencyValidator,
    interval: intervalValidator,
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("userId", ["userId"])
    .index("stripeId", ["stripeId"]),

  // Document collections (user or organization folders)
  documentCollections: defineTable({
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.boolean(),
  })
    .index("userId", ["userId"])
    .index("orgId", ["orgId"])
    .index("userId_name", ["userId", "name"]),

  // Documents (multi-modal files)
  documents: defineTable({
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    collectionId: v.id("documentCollections"),
    name: v.string(),
    type: documentTypeValidator,
    storageId: v.id("_storage"),
    fileSize: v.number(),
    mimeType: v.string(),
    processingStatus: processingStatusValidator,
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("userId", ["userId"])
    .index("orgId", ["orgId"])
    .index("collectionId", ["collectionId"])
    .index("userId_status", ["userId", "processingStatus"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["userId", "collectionId", "orgId"],
    }),

  // Document chunks (for RAG retrieval - Child Chunks)
  documentChunks: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    parentId: v.optional(v.id("documentParents")), // Link to Parent Context
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.float64()),
    metadata: v.optional(
      v.object({
        pageNumber: v.optional(v.number()),
        timestamp: v.optional(v.number()),
        imageUrl: v.optional(v.string()),
        section: v.optional(v.string()),
      }),
    ),
  })
    .index("documentId", ["documentId"])
    .index("documentId_chunkIndex", ["documentId", "chunkIndex"])
    .index("userId", ["userId"])
    .index("collectionId", ["collectionId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["userId", "collectionId"],
    })
    .vectorIndex("embedding_index", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId", "collectionId"],
    }),

  // Parent Context for Chunks (Full Pages/Sections)
  documentParents: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    content: v.string(),
    metadata: v.optional(v.any()),
  }).index("documentId", ["documentId"]),

  // Chat sessions (conversation history)
  chatSessions: defineTable({
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    title: v.string(),
    collectionIds: v.array(v.id("documentCollections")),
    lastMessageAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("orgId", ["orgId"])
    .index("userId_lastMessage", ["userId", "lastMessageAt"]),

  // Chat messages (persisted for history)
  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    retrievedChunks: v.optional(v.array(v.id("documentChunks"))),
    citationMeta: v.optional(
      v.array(
        v.object({
          documentName: v.string(),
          content: v.string(),
          pageNumber: v.optional(v.number()),
          parser: v.optional(v.string()),
        }),
      ),
    ),
    heliconeRequestId: v.optional(v.string()),
  })
    .index("sessionId", ["sessionId"])
    .index("userId", ["userId"]),

  // User feedback for quality tracking
  messageFeedback: defineTable({
    messageId: v.id("chatMessages"),
    userId: v.id("users"),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    comment: v.optional(v.string()),
    heliconeRequestId: v.optional(v.string()),
  })
    .index("messageId", ["messageId"])
    .index("userId", ["userId"])
    .index("heliconeRequestId", ["heliconeRequestId"]),

  // Usage per billing period (aligned to subscription currentPeriodEnd)
  usage: defineTable({
    userId: v.id("users"),
    periodEnd: v.number(),
    chatMessages: v.number(),
    documentsCreated: v.number(),
    storageBytes: v.number(),
  }).index("userId_periodEnd", ["userId", "periodEnd"]),

  // Rate limit windows (key = "chat:userId" or "upload:userId", windowStart in ms)
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("key", ["key"]),

  // Waitlist for top-of-funnel capture
  waitlist: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    timestamp: v.number(),
  }).index("email", ["email"]),

  // GDPR consent records
  gdprConsents: defineTable({
    userId: v.id("users"),
    consentType: v.union(
      v.literal("analytics"),
      v.literal("marketing"),
      v.literal("functional"),
      v.literal("essential"),
    ),
    granted: v.boolean(),
    ipAddress: v.string(),
    userAgent: v.string(),
    timestamp: v.number(),
    version: v.string(),
  })
    .index("userId", ["userId"])
    .index("userId_type", ["userId", "consentType"]),

  // GDPR audit logs
  auditLogs: defineTable({
    userId: v.optional(v.id("users")),
    action: v.union(
      v.literal("data_export"),
      v.literal("data_deletion"),
      v.literal("data_access"),
      v.literal("consent_update"),
      v.literal("account_created"),
      v.literal("account_deleted"),
    ),
    details: v.optional(v.string()),
    ipAddress: v.string(),
    userAgent: v.string(),
    timestamp: v.number(),
    requestId: v.optional(v.string()),
  })
    .index("userId", ["userId"])
    .index("action", ["action"])
    .index("timestamp", ["timestamp"]),

  // Organizations (Teams)
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    imageId: v.optional(v.id("_storage")),
    image: v.optional(v.string()),
    ownerId: v.id("users"),
  })
    .index("slug", ["slug"])
    .index("ownerId", ["ownerId"]),

  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  })
    .index("orgId", ["orgId"])
    .index("userId", ["userId"])
    .index("orgId_userId", ["orgId", "userId"]),

  // Processing jobs for large document handling
  processingJobs: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    status: v.union(
      v.literal("queued"),
      v.literal("uploading"),
      v.literal("parsing"),
      v.literal("chunking"),
      v.literal("embedding"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    // Progress tracking
    totalPages: v.optional(v.number()),
    processedPages: v.number(),
    totalChunks: v.optional(v.number()),
    processedChunks: v.number(),
    // Batch tracking for large documents
    currentBatch: v.optional(v.number()),
    totalBatches: v.optional(v.number()),
    // Status message for UI
    statusMessage: v.optional(v.string()),
    // External service tracking
    externalJobId: v.optional(v.string()),
    externalStorageUrl: v.optional(v.string()),
    // Parser used (for A/B comparison)
    parser: v.optional(v.union(v.literal("llamaparse"), v.literal("docling"))),
    // Error handling
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    // Timestamps
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    lastUpdatedAt: v.optional(v.number()),
  })
    .index("documentId", ["documentId"])
    .index("userId_status", ["userId", "status"])
    .index("externalJobId", ["externalJobId"]),

  // Structured parts extraction for catalog search
  catalogParts: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    collectionId: v.id("documentCollections"),
    partNumber: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    pageNumber: v.number(),
    chunkId: v.optional(v.id("documentChunks")),
    embedding: v.array(v.float64()),
  })
    .index("documentId", ["documentId"])
    .index("userId", ["userId"])
    .index("partNumber", ["partNumber"])
    .searchIndex("search_parts", {
      searchField: "description",
      filterFields: ["userId", "collectionId"],
    })
    .vectorIndex("parts_embedding_index", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId", "collectionId"],
    }),

  // ========== AGENT SYSTEM (Mission Control) ==========
  
  // Agent definitions and configuration
  // agentId can be a known agent (from AGENT_IDS) or a custom string for user-created agents
  agents: defineTable({
    agentId: v.string(),
    orgId: v.optional(v.id("organizations")), // null for global/hardcoded agents
    name: v.string(),
    role: v.string(),
    emoji: v.string(),
    color: v.string(),
    department: v.union(
      v.literal("sales"),
      v.literal("ops"),
      v.literal("finance"),
      v.literal("delivery"),
      v.literal("custom"),
    ),
    description: v.string(),
    expertise: v.array(v.string()),
    isActive: v.boolean(),
    soulPath: v.string(), // Path to SOUL.md
    isCustom: v.optional(v.boolean()), // true for user-created agents
    collectionIds: v.optional(v.array(v.id("documentCollections"))), // RAG access (empty = all org collections)
  })
    .index("agentId", ["agentId"])
    .index("department", ["department"])
    .index("orgId", ["orgId"]),

  // Tasks assigned to agents
  agentTasks: defineTable({
    orgId: v.id("organizations"),
    title: v.string(),
    description: v.string(),
    agentId: v.optional(agentIdValidator),
    status: taskStatusValidator,
    priority: priorityValidator,
    context: v.optional(v.string()),
    handoffFrom: v.optional(agentIdValidator),
    handoffTo: v.optional(agentIdValidator),
    handoffNote: v.optional(v.string()),
    createdBy: v.id("users"),
    assignedTo: v.id("users"), // Can be agent or human
    createdByAgent: v.optional(agentIdValidator), // If created by an agent
    sourceMessageId: v.optional(v.id("agentChatMessages")), // Originating chat message
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    completionNotes: v.optional(v.string()),
    tags: v.array(v.string()),
    projectId: v.optional(v.id("agentProjects")),
    attachments: v.optional(v.array(v.id("documents"))),
  })
    .index("orgId", ["orgId"])
    .index("agentId", ["agentId"])
    .index("agentId_status", ["agentId", "status"])
    .index("orgId_status", ["orgId", "status"])
    .index("assignedTo", ["assignedTo"])
    .index("projectId", ["projectId"])
    .index("handoffTo", ["handoffTo"]),

  // Agent projects (Modern Phase client work)
  agentProjects: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    client: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("planning"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("delivered"),
    ),
    startDate: v.number(),
    targetDate: v.number(),
    agents: v.array(agentIdValidator),
    progress: v.number(),
    budget: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
    createdBy: v.id("users"),
  })
    .index("orgId", ["orgId"])
    .index("orgId_status", ["orgId", "status"]),

  // Global context (shared across all agents)
  agentContext: defineTable({
    orgId: v.id("organizations"),
    companyPriorities: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.string(),
        priority: priorityValidator,
        owner: v.union(agentIdValidator, v.literal("scotty")),
        deadline: v.optional(v.number()),
      }),
    ),
    sharedResources: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        type: v.union(v.literal("doc"), v.literal("template"), v.literal("asset"), v.literal("link")),
        url: v.string(),
        description: v.string(),
      }),
    ),
    recentWins: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.string(),
        agentId: agentIdValidator,
        date: v.number(),
        impact: v.optional(v.string()),
      }),
    ),
    lastUpdated: v.number(),
    updatedBy: v.union(agentIdValidator, v.literal("scotty")),
  })
    .index("orgId", ["orgId"]),

  // Agent sessions (track active OpenClaw sessions)
  agentSessions: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    sessionId: v.string(), // OpenClaw session ID
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("blocked"), v.literal("offline")),
    currentTaskId: v.optional(v.id("agentTasks")),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("orgId", ["orgId"])
    .index("agentId", ["agentId"])
    .index("orgId_agentId", ["orgId", "agentId"])
    .index("sessionId", ["sessionId"]),

  // Activity log (what agents are doing)
  agentActivity: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    action: v.string(),
    target: v.string(),
    taskId: v.optional(v.id("agentTasks")),
    projectId: v.optional(v.id("agentProjects")),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("orgId", ["orgId"])
    .index("agentId", ["agentId"])
    .index("orgId_timestamp", ["orgId", "timestamp"])
    .index("taskId", ["taskId"]),

  // Agent chat messages (for in-app chat)
  agentChatMessages: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    userId: v.id("users"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    sessionId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("delivered"), v.literal("responded"), v.literal("streaming")),
    runId: v.optional(v.string()),
    replyTo: v.optional(v.id("agentChatMessages")),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
    // RAG citation data (stored on user messages that triggered RAG search)
    retrievedChunks: v.optional(v.array(v.string())),
    citationMeta: v.optional(
      v.array(
        v.object({
          documentName: v.string(),
          content: v.string(),
          pageNumber: v.optional(v.number()),
          parser: v.optional(v.string()),
        }),
      ),
    ),
    processedTaskDirectives: v.optional(v.number()), // Count of tasks created from this message
    processedMemoryDirectives: v.optional(v.number()), // Count of memories stored from this message
    processedOutboundDirectives: v.optional(v.number()), // Count of outbound email actions from this message
  })
    .index("orgId", ["orgId"])
    .index("agentId", ["agentId"])
    .index("orgId_agentId", ["orgId", "agentId"])
    .index("sessionId", ["sessionId"])
    .index("runId", ["runId"])
    .index("timestamp", ["timestamp"])
    .index("agentId_timestamp", ["agentId", "timestamp"]),

  // Chat queue (for processing agent responses)
  agentChatQueue: defineTable({
    orgId: v.id("organizations"),
    messageId: v.id("agentChatMessages"),
    agentId: agentIdValidator,
    userId: v.id("users"),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    attempts: v.number(),
    queuedAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("orgId", ["orgId"])
    .index("orgId_status", ["orgId", "status"])
    .index("agentId", ["agentId"])
    .index("messageId", ["messageId"]),

  // Chat sessions (conversations between user and agent)
  agentChatSessions: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    userId: v.id("users"),
    sessionId: v.string(),
    status: v.union(v.literal("active"), v.literal("closed")),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("orgId", ["orgId"])
    .index("agentId", ["agentId"])
    .index("orgId_agentId_userId", ["orgId", "agentId", "userId"])
    .index("sessionId", ["sessionId"]),

  // Processing queue (for OpenClaw Gateway integration)
  agentProcessingQueue: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    sessionId: v.string(),
    task: v.string(),
    context: v.optional(v.any()),
    source: v.union(v.literal("discord"), v.literal("web")),
    channelId: v.optional(v.string()),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("completed"), v.literal("failed")),
    queuedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    attempts: v.number(),
    error: v.optional(v.string()),
  })
    .index("orgId", ["orgId"])
    .index("status", ["status"])
    .index("orgId_status", ["orgId", "status"])
    .index("agentId", ["agentId"])
    .index("sessionId", ["sessionId"]),

  // Agent memory (persisted knowledge for cross-session recall)
  agentMemory: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    content: v.string(),
    category: v.union(
      v.literal("fact"),
      v.literal("preference"),
      v.literal("procedure"),
      v.literal("context"),
      v.literal("relationship"),
    ),
    importance: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    source: v.union(v.literal("conversation"), v.literal("migration"), v.literal("manual")),
    sourceMessageId: v.optional(v.id("agentChatMessages")),
    embedding: v.array(v.float64()),
    isActive: v.boolean(),
    migratedFrom: v.optional(v.string()),
  })
    .index("agentId", ["agentId"])
    .index("agentId_category", ["agentId", "category"])
    .index("orgId", ["orgId"])
    .vectorIndex("memory_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["agentId", "isActive"],
    }),

  // Agent memory audit log
  agentMemoryLog: defineTable({
    orgId: v.id("organizations"),
    agentId: agentIdValidator,
    action: v.union(v.literal("store"), v.literal("deactivate"), v.literal("migrate")),
    memoryId: v.id("agentMemory"),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("agentId", ["agentId"])
    .index("orgId_timestamp", ["orgId", "timestamp"]),

  // Notifications
  notifications: defineTable({
    userId: v.id("users"),
    orgId: v.optional(v.id("organizations")),
    type: notificationTypeValidator,
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    resourceType: v.optional(v.union(v.literal("task"), v.literal("lead"), v.literal("message"), v.literal("invoice"), v.literal("proposal"), v.literal("contract"))),
    resourceId: v.optional(v.string()),
    agentId: v.optional(agentIdValidator),
    createdAt: v.number(),
  })
    .index("userId_read", ["userId", "read"])
    .index("userId_createdAt", ["userId", "createdAt"]),

  // Project templates (for deal-to-delivery pipeline)
  projectTemplates: defineTable({
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.string(),
    icon: v.optional(v.string()),
    taskTemplates: v.array(v.object({
      title: v.string(),
      description: v.string(),
      agentId: agentIdValidator,
      priority: priorityValidator,
      tags: v.array(v.string()),
      order: v.number(),
    })),
    isGlobal: v.boolean(),
    createdBy: v.optional(v.id("users")),
  })
    .index("isGlobal", ["isGlobal"])
    .index("orgId", ["orgId"]),

  // CRM - Leads/Deals pipeline
  crmLeads: defineTable({
    orgId: v.id("organizations"),
    company: v.string(),
    contactName: v.string(),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactLinkedin: v.optional(v.string()),
    contactTitle: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    stage: pipelineStageValidator,
    source: leadSourceValidator,
    value: v.optional(v.number()),
    currency: v.optional(v.string()),
    description: v.optional(v.string()),
    nextStep: v.optional(v.string()),
    nextFollowUp: v.optional(v.number()),
    assignedAgent: v.optional(agentIdValidator),
    tags: v.optional(v.array(v.string())),
    projectId: v.optional(v.id("agentProjects")),
    closedAt: v.optional(v.number()),
    lostReason: v.optional(v.string()),
    industry: v.optional(v.string()),
    companySize: v.optional(companySizeValidator),
    timezone: v.optional(v.string()),
    budget: v.optional(v.number()),
    priority: v.optional(priorityValidator),
    lastContactedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    // QuickBooks sync
    qbCustomerId: v.optional(v.string()),
    qbSyncedAt: v.optional(v.number()),
  })
    .index("orgId", ["orgId"])
    .index("orgId_stage", ["orgId", "stage"])
    .index("orgId_assignedAgent", ["orgId", "assignedAgent"])
    .index("orgId_source", ["orgId", "source"])
    .index("orgId_contactEmail", ["orgId", "contactEmail"]),

  // CRM - Activity timeline per lead
  crmActivities: defineTable({
    orgId: v.id("organizations"),
    leadId: v.id("crmLeads"),
    type: crmActivityTypeValidator,
    title: v.string(),
    description: v.optional(v.string()),
    agentId: v.optional(agentIdValidator),
    userId: v.id("users"),
    timestamp: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("leadId", ["leadId"])
    .index("orgId", ["orgId"])
    .index("leadId_timestamp", ["leadId", "timestamp"]),

  // Outbound email events (raw webhook log from Instantly)
  outboundEmailEvents: defineTable({
    orgId: v.id("organizations"),
    eventType: v.string(),
    leadEmail: v.string(),
    subject: v.optional(v.string()),
    campaignId: v.string(),
    campaignName: v.optional(v.string()),
    externalEventId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    leadId: v.optional(v.id("crmLeads")),
    activityId: v.optional(v.id("crmActivities")),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("orgId", ["orgId"])
    .index("orgId_leadEmail", ["orgId", "leadEmail"])
    .index("externalEventId", ["externalEventId"])
    .index("orgId_eventType", ["orgId", "eventType"]),

  // Discord integration — user account linking
  discordLinks: defineTable({
    userId: v.id("users"),
    discordUserId: v.string(),
    discordUsername: v.string(),
    guildId: v.string(),
    linkedAt: v.number(),
  })
    .index("discordUserId", ["discordUserId"])
    .index("userId", ["userId"]),

  // Discord integration — channel-to-department mapping
  discordChannelMap: defineTable({
    orgId: v.id("organizations"),
    channelId: v.string(),
    channelName: v.string(),
    department: v.string(),
    defaultAgentId: agentIdValidator,
    isActive: v.boolean(),
  })
    .index("orgId", ["orgId"])
    .index("channelId", ["channelId"]),

  // Discord link codes — temporary codes for account linking
  discordLinkCodes: defineTable({
    userId: v.id("users"),
    code: v.string(),
    expiresAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("code", ["code"]),

  // Agent tool calls (captured from gateway or self-reported via directives)
  agentToolCalls: defineTable({
    orgId: v.id("organizations"),
    agentId: v.string(),
    runId: v.string(),
    sessionId: v.optional(v.string()),
    messageId: v.optional(v.id("agentChatMessages")),
    toolName: v.string(),
    toolInput: v.string(), // JSON string
    toolResult: v.optional(v.string()), // JSON string
    status: v.union(v.literal("pending"), v.literal("success"), v.literal("error")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()), // ms
  })
    .index("orgId", ["orgId"])
    .index("agentId", ["agentId"])
    .index("runId", ["runId"])
    .index("messageId", ["messageId"]),

  // Synced workspace files from agent VPS
  agentFiles: defineTable({
    orgId: v.id("organizations"),
    agentId: v.string(),
    path: v.string(), // relative to workspace root
    filename: v.string(),
    content: v.optional(v.string()), // text content (capped at 1MB)
    storageId: v.optional(v.id("_storage")), // for binary/large files
    mimeType: v.string(),
    sizeBytes: v.number(),
    lastModifiedAt: v.number(),
    syncedAt: v.number(),
  })
    .index("agentId", ["agentId"])
    .index("orgId_agentId", ["orgId", "agentId"])
    .index("path", ["path"]),

  // Full session transcripts synced from VPS
  agentSessionTranscripts: defineTable({
    orgId: v.id("organizations"),
    agentId: v.string(),
    sessionId: v.string(),
    messages: v.string(), // JSON array of {role, content, timestamp, toolCalls?}
    messageCount: v.number(),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    syncedAt: v.number(),
  })
    .index("agentId", ["agentId"])
    .index("sessionId", ["sessionId"])
    .index("orgId_agentId", ["orgId", "agentId"]),

  // ========== BUSINESS DOCUMENTS ==========

  // Invoices
  invoices: defineTable({
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("agentProjects")),
    leadId: v.optional(v.id("crmLeads")),
    clientName: v.string(),
    clientEmail: v.string(),
    invoiceNumber: v.string(),
    items: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      total: v.number(),
    })),
    subtotal: v.number(),
    taxRate: v.optional(v.number()),
    tax: v.number(),
    total: v.number(),
    currency: v.string(),
    status: invoiceStatusValidator,
    dueDate: v.number(),
    paidAt: v.optional(v.number()),
    stripeInvoiceId: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    // QuickBooks sync
    qbInvoiceId: v.optional(v.string()),
    qbSyncedAt: v.optional(v.number()),
  })
    .index("orgId", ["orgId"])
    .index("orgId_status", ["orgId", "status"])
    .index("projectId", ["projectId"])
    .index("leadId", ["leadId"]),

  // Proposals
  proposals: defineTable({
    orgId: v.id("organizations"),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    title: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    sections: v.array(v.object({
      title: v.string(),
      description: v.string(),
      items: v.array(v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      })),
    })),
    totalValue: v.number(),
    currency: v.string(),
    status: proposalStatusValidator,
    validUntil: v.number(),
    acceptedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    accessToken: v.string(),
    templateId: v.optional(v.id("projectTemplates")),
    createdBy: v.id("users"),
  })
    .index("orgId", ["orgId"])
    .index("orgId_status", ["orgId", "status"])
    .index("leadId", ["leadId"])
    .index("accessToken", ["accessToken"]),

  // Contracts
  contracts: defineTable({
    orgId: v.id("organizations"),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    proposalId: v.optional(v.id("proposals")),
    title: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    content: v.string(), // markdown
    status: contractStatusValidator,
    sentAt: v.optional(v.number()),
    viewedAt: v.optional(v.number()),
    signedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    signatureData: v.optional(v.object({
      name: v.string(),
      agreedAt: v.number(),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
    })),
    accessToken: v.string(),
    templateKey: v.optional(v.string()),
    createdBy: v.id("users"),
    // DocuSeal e-signatures
    docusealSubmissionId: v.optional(v.number()),
    docusealSigningUrl: v.optional(v.string()),
    docusealDocumentUrl: v.optional(v.string()),
    signingMethod: v.optional(signingMethodValidator),
  })
    .index("orgId", ["orgId"])
    .index("orgId_status", ["orgId", "status"])
    .index("leadId", ["leadId"])
    .index("proposalId", ["proposalId"])
    .index("accessToken", ["accessToken"]),

  // Workflow Rules
  workflowRules: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    trigger: workflowTriggerValidator,
    conditions: v.any(),
    actions: v.array(v.object({
      type: workflowActionTypeValidator,
      config: v.any(),
    })),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("orgId", ["orgId"])
    .index("orgId_trigger", ["orgId", "trigger"]),

  // Email Sequences
  emailSequences: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    steps: v.array(v.object({
      delayDays: v.number(),
      subject: v.string(),
      body: v.string(),
    })),
    isActive: v.boolean(),
    createdBy: v.id("users"),
  })
    .index("orgId", ["orgId"]),

  // Email Sequence Enrollments
  emailSequenceEnrollments: defineTable({
    orgId: v.id("organizations"),
    sequenceId: v.id("emailSequences"),
    leadId: v.id("crmLeads"),
    currentStep: v.number(),
    status: enrollmentStatusValidator,
    nextSendAt: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("orgId", ["orgId"])
    .index("sequenceId", ["sequenceId"])
    .index("leadId", ["leadId"])
    .index("status_nextSendAt", ["status", "nextSendAt"]),

  // ========== VOICE CALLS (Retell AI) ==========

  retellCalls: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    agentId: v.optional(v.string()), // agent chat context (if initiated from agent chat)
    retellCallId: v.optional(v.string()), // Retell's call ID (set after API responds)
    retellAgentId: v.string(), // Retell agent used for the call
    fromNumber: v.string(),
    toNumber: v.string(),
    status: v.union(
      v.literal("initiating"),
      v.literal("registered"),
      v.literal("ongoing"),
      v.literal("ended"),
      v.literal("error"),
    ),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    transcript: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    summary: v.optional(v.string()),
    sentiment: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    startTimestamp: v.optional(v.number()),
    endTimestamp: v.optional(v.number()),
    disconnectionReason: v.optional(v.string()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
  })
    .index("orgId", ["orgId"])
    .index("retellCallId", ["retellCallId"])
    .index("userId", ["userId"])
    .index("orgId_status", ["orgId", "status"]),

  // ========== EXPENSES (Profitability Tracking) ==========
  expenses: defineTable({
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("agentProjects")),
    leadId: v.optional(v.id("crmLeads")),
    category: expenseCategoryValidator,
    description: v.string(),
    amount: v.number(),
    currency: v.string(),
    date: v.number(), // timestamp
    vendor: v.optional(v.string()),
    recurring: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    // QuickBooks sync
    qbExpenseId: v.optional(v.string()),
    qbSyncedAt: v.optional(v.number()),
  })
    .index("orgId", ["orgId"])
    .index("projectId", ["projectId"])
    .index("orgId_category", ["orgId", "category"]),

  // ========== TEMPLATE GALLERY ==========

  customTemplates: defineTable({
    orgId: v.id("organizations"),
    type: templateTypeValidator,
    name: v.string(),
    description: v.optional(v.string()),
    content: v.string(), // JSON string for invoice/proposal items, markdown for contracts
    createdBy: v.id("users"),
  })
    .index("orgId", ["orgId"])
    .index("orgId_type", ["orgId", "type"]),

  // ========== INTEGRATIONS ==========

  integrations: defineTable({
    orgId: v.id("organizations"),
    provider: integrationProviderValidator,
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
    realmId: v.optional(v.string()), // QuickBooks company ID
    connectedAt: v.number(),
    connectedBy: v.id("users"),
    status: integrationStatusValidator,
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("orgId", ["orgId"])
    .index("orgId_provider", ["orgId", "provider"]),

  integrationSyncMap: defineTable({
    orgId: v.id("organizations"),
    integrationId: v.id("integrations"),
    localTable: v.string(),
    localId: v.string(),
    externalId: v.string(),
    lastSyncedAt: v.number(),
    syncDirection: v.union(v.literal("push"), v.literal("pull"), v.literal("both")),
  })
    .index("integrationId", ["integrationId"])
    .index("orgId_localTable_localId", ["orgId", "localTable", "localId"])
    .index("orgId_externalId", ["orgId", "externalId"]),

  // GitHub repos tracked per organization
  githubRepos: defineTable({
    orgId: v.id("organizations"),
    repoFullName: v.string(),
    repoUrl: v.string(),
    description: v.optional(v.string()),
    defaultBranch: v.string(),
    isPrivate: v.boolean(),
    linkedProjectId: v.optional(v.id("agentProjects")),
    addedBy: v.id("users"),
    addedAt: v.number(),
  })
    .index("orgId", ["orgId"])
    .index("orgId_repoFullName", ["orgId", "repoFullName"]),

  // VPS instance tracking (live state synced from orchestrator)
  vpsInstances: defineTable({
    agentId: v.string(),
    serviceUnit: v.string(),
    systemdState: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("failed"),
      v.literal("activating"),
      v.literal("deactivating"),
      v.literal("unknown"),
    ),
    gatewayPort: v.number(),
    gatewayReachable: v.boolean(),
    pid: v.optional(v.number()),
    uptime: v.optional(v.string()),
    lastStarted: v.optional(v.string()),
    memoryUsage: v.optional(v.number()),
    lastSyncedAt: v.number(),
  })
    .index("agentId", ["agentId"]),
});

export default schema;
