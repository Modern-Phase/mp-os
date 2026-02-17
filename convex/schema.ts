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
});

export default schema;
