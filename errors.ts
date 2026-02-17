// TODO BEFORE LAUNCH: Error messages need UX pass for end users
// Many error messages throughout the codebase are too technical:
//   - "Authentication required to upload documents" → "Please sign in to upload files"
//   - "Collection not found or access denied" → "This collection doesn't exist or you don't have access"
//   - "OPENAI_API_KEY not configured" → "Service temporarily unavailable. Please try again later."
//   - "Query too long (max 10000 characters)" → "Your message is too long. Please shorten it and try again."
//
// Files with technical errors that need review:
//   - convex/documents.ts (especially line 107, 112, and all auth errors)
//   - convex/ragProcess.ts (all the "Document not found", "file not found" errors)
//   - convex/collections.ts (auth and validation errors)
//   - convex/chat.ts (auth and validation errors)
//   - convex/rag.ts (search and auth errors)
//
// General principles for user-facing errors:
//   - Never mention technical terms (auth, userId, clerkId, storageId, etc.)
//   - Be clear about what went wrong and what the user can do
//   - Offer actionable next steps when possible
//   - Keep it friendly and reassuring, not scary

export const ERRORS = {
  // Authentication.
  AUTH_EMAIL_NOT_SENT: "Unable to send email.",
  AUTH_USER_NOT_CREATED: "Unable to create user.",
  AUTH_SOMETHING_WENT_WRONG:
    "Something went wrong while trying to authenticate.",
  // Onboarding.
  ONBOARDING_USERNAME_ALREADY_EXISTS: "Username already exists.",
  ONBOARDING_SOMETHING_WENT_WRONG:
    "Something went wrong while trying to onboard.",
  // Stripe.
  STRIPE_MISSING_SIGNATURE: "Unable to verify webhook signature.",
  STRIPE_MISSING_ENDPOINT_SECRET: "Unable to verify webhook endpoint.",
  STRIPE_CUSTOMER_NOT_CREATED: "Unable to create customer.",
  STRIPE_SOMETHING_WENT_WRONG:
    "Something went wrong while trying to handle Stripe API.",
  // Chat / API.
  CHAT_MESSAGE_TOO_LONG: "Message is too long.",
  PROMPT_INJECTION_DETECTED:
    "Your message was flagged as potentially malicious. Please rephrase and try again.",
  USAGE_LIMIT_EXCEEDED: "Usage limit reached for this period.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please try again later.",
  // Misc.
  UNKNOWN: "Unknown error.",
  ENVS_NOT_INITIALIZED: "Environment variables not initialized.",
  SOMETHING_WENT_WRONG: "Something went wrong.",
} as const;

/** API error codes for client handling */
export const API_ERROR_CODES = {
  USAGE_LIMIT_EXCEEDED: "USAGE_LIMIT_EXCEEDED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  MESSAGE_TOO_LONG: "MESSAGE_TOO_LONG",
  PROMPT_INJECTION: "PROMPT_INJECTION",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL: "INTERNAL_ERROR",
} as const;
