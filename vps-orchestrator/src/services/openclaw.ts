// OpenClaw config helpers (simplified for single-gateway architecture)

import { readFile } from "fs/promises";
import { join } from "path";
import { CONFIG } from "../config";

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: { primary?: string };
      workspace?: string;
    };
  };
  [key: string]: unknown;
}

let cachedConfig: OpenClawConfig | null = null;
let configLastRead = 0;
const CONFIG_CACHE_TTL = 5000;

export async function getOpenClawConfig(): Promise<OpenClawConfig> {
  const now = Date.now();
  if (cachedConfig && now - configLastRead < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  const configPath = join(CONFIG.openclawHome, "openclaw.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    cachedConfig = JSON.parse(raw);
    configLastRead = now;
    return cachedConfig!;
  } catch {
    return {};
  }
}

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(
      `http://127.0.0.1:${CONFIG.gatewayPort}/`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
