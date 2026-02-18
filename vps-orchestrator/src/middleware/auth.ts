import type { Context, Next } from "hono";
import { CONFIG } from "../config";

// Simple in-memory rate limiter per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // requests per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

export async function apiKeyAuth(c: Context, next: Next) {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  // Rate limit before checking auth to prevent brute-force
  if (isRateLimited(ip)) {
    return c.json({ error: "Too many requests" }, 429);
  }

  // Only accept API key via headers — never query params (they leak in logs/referrers)
  const apiKey =
    c.req.header("X-API-Key") ||
    c.req.header("Authorization")?.replace("Bearer ", "");

  if (!CONFIG.apiKey || apiKey !== CONFIG.apiKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
