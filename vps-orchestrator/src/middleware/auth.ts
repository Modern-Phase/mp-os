import type { Context, Next } from "hono";
import { CONFIG } from "../config";

export async function apiKeyAuth(c: Context, next: Next) {
  const apiKey =
    c.req.header("X-API-Key") ||
    c.req.header("Authorization")?.replace("Bearer ", "") ||
    c.req.query("apiKey");

  if (!CONFIG.apiKey || apiKey !== CONFIG.apiKey) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
