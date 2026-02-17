/**
 * Prompt Security Module
 * Pure utility functions for protecting against prompt injection, PII leakage, and AI hijacking.
 * Zero Convex framework imports - can be used in tests and serverless functions.
 */

// ============================================================================
// Prompt Injection Detection
// ============================================================================

/** Patterns that flag a prompt-injection attempt in user input.
 *  Each regex matches only clear, imperative injection phrases — not questions
 *  about prompt injection or other legitimate uses of the same words. */
export const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|system|rules)\b/i,
  /\bforget\s+(all\s+)?(previous|prior)\s+(instructions?|prompts?|context|rules)\b/i,
  /\bdisregard\s+(all\s+)?(your\s+)?(previous|prior)\s+(instructions?|prompts?|rules)\b/i,
  // Attempts to inject or close XML system tags
  /<\/?system>|<\/?prompt>|<\/?instructions>/i,
  // Raw LLM special tokens (Llama / ChatML / GPT-2)
  /\[INST\]|<<SYS>>|<\|(?:im_start|endoftext)\|>/i,
  // Inline "new system prompt:" style overrides
  /\bnew\s+(system\s+)?(?:instructions?|prompt)\s*[:=]/i,
];

/** Returns true when the text contains a recognised prompt-injection pattern. */
export function containsInjectionAttempt(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

/** Scripted response for when the model detects an injection attempt */
export const INJECTION_FAILURE_RESPONSE =
  "I detected what appears to be an attempt to manipulate my instructions. I cannot process that request. Please ask me something else.";

// ============================================================================
// Message Role Sanitization
// ============================================================================

/** Keep only user / assistant messages; strip system, tool, and function roles
 *  that a client should never be allowed to inject. */
export function sanitizeMessageRoles(
  raw: { role?: string; content?: string; parts?: unknown[] }[],
): { role: "user" | "assistant"; content?: string; parts?: unknown[] }[] {
  return raw
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ ...m, role: m.role as "user" | "assistant" }));
}

// ============================================================================
// Canary Token (System Prompt Leakage Detection)
// ============================================================================

/** Generates a unique 32-character hex token for embedding in system prompts.
 *  Uses crypto.getRandomValues when available, falls back to Math.random for test environments. */
export function generateCanaryToken(): string {
  // Try crypto.getRandomValues first (available in modern browsers and Node.js)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for environments without crypto (like some test runners)
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += Math.floor(Math.random() * 16).toString(16);
  }
  return token;
}

/** Detects and strips the canary token from text.
 *  Returns whether the token was found and the text with all occurrences removed. */
export function stripCanaryToken(
  text: string,
  token: string,
): { stripped: string; found: boolean } {
  const found = text.includes(token);
  const stripped = found ? text.split(token).join("") : text;
  return { stripped, found };
}

// ============================================================================
// PII Detection and Redaction
// ============================================================================

/** PII patterns with labels for logging and redaction */
export const PII_PATTERNS: { label: string; pattern: RegExp }[] = [
  {
    label: "SSN",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    label: "CREDIT_CARD",
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  },
  {
    label: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    label: "PHONE",
    pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    label: "API_KEY",
    pattern: /\b(?:sk-|pk-|api[_-]?key[=:]\s*)[A-Za-z0-9_-]{20,}\b/gi,
  },
];

/** Scans text for PII patterns and returns all matches with labels */
export function scanForPII(
  text: string,
): { hasPII: boolean; matches: { label: string; value: string }[] } {
  const matches: { label: string; value: string }[] = [];

  for (const { label, pattern } of PII_PATTERNS) {
    // Reset regex state before each use (global flag is stateful)
    pattern.lastIndex = 0;

    const found = text.matchAll(pattern);
    for (const match of found) {
      matches.push({ label, value: match[0] });
    }
  }

  return {
    hasPII: matches.length > 0,
    matches,
  };
}

/** Redacts all PII patterns in text with labeled placeholders */
export function redactPII(text: string): string {
  let redacted = text;

  for (const { label, pattern } of PII_PATTERNS) {
    // Reset regex state before each use
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, `[REDACTED-${label}]`);
  }

  return redacted;
}
