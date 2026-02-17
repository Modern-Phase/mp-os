import { CONFIG } from "../config";

async function run(
  cmd: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

export type ServiceState =
  | "active"
  | "inactive"
  | "failed"
  | "activating"
  | "deactivating"
  | "unknown";

export interface GatewayStatus {
  state: ServiceState;
  pid?: number;
  uptime?: string;
  lastStarted?: string;
  memoryUsage?: number;
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const service = `${CONFIG.serviceName}.service`;

  const { stdout: stateOut } = await run(["systemctl", "is-active", service]);
  const state = parseState(stateOut);

  if (state !== "active") {
    return { state };
  }

  const { stdout: showOut } = await run([
    "systemctl",
    "show",
    service,
    "--property=MainPID,ActiveEnterTimestamp,MemoryCurrent",
    "--no-pager",
  ]);

  const props = Object.fromEntries(
    showOut
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1)];
      }),
  );

  const pid = parseInt(props.MainPID || "0") || undefined;
  const lastStarted = props.ActiveEnterTimestamp || undefined;
  const memoryBytes = parseInt(props.MemoryCurrent || "0") || undefined;

  let uptime: string | undefined;
  if (lastStarted && lastStarted !== "") {
    const started = new Date(lastStarted);
    const diff = Date.now() - started.getTime();
    uptime = formatUptime(diff);
  }

  return { state, pid, uptime, lastStarted, memoryUsage: memoryBytes };
}

export async function startGateway(): Promise<void> {
  const { exitCode, stderr } = await run([
    "systemctl",
    "start",
    `${CONFIG.serviceName}.service`,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Failed to start gateway: ${stderr}`);
  }
}

export async function stopGateway(): Promise<void> {
  const { exitCode, stderr } = await run([
    "systemctl",
    "stop",
    `${CONFIG.serviceName}.service`,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Failed to stop gateway: ${stderr}`);
  }
}

export async function restartGateway(): Promise<void> {
  const { exitCode, stderr } = await run([
    "systemctl",
    "restart",
    `${CONFIG.serviceName}.service`,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Failed to restart gateway: ${stderr}`);
  }
}

function parseState(state: string): ServiceState {
  const s = state.trim().toLowerCase();
  if (s === "active") return "active";
  if (s === "inactive") return "inactive";
  if (s === "failed") return "failed";
  if (s === "activating") return "activating";
  if (s === "deactivating") return "deactivating";
  return "unknown";
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
