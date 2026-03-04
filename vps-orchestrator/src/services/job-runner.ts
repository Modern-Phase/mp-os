// vps-orchestrator/src/services/job-runner.ts
// Async job execution: clone repo, run OpenCode (via OpenRouter), run tests, push + create PR

import { CONFIG } from "../config";
import { mkdir, rm, readFile, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

export interface JobParams {
  jobId: string;
  orgId: string;
  repoFullName: string;
  branch: string;
  defaultBranch: string;
  githubToken: string;
  openRouterKey?: string;
  prompt: string;
  issueNumber: number;
  issueTitle: string;
  maxAttempts: number;
  isRevision?: boolean;
  isRetry?: boolean;
  attempt?: number;
}

const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const OPENCODE_BIN = "/root/.opencode/bin/opencode";

// Default model — OpenRouter model ID
// Prefer Claude for code tasks, fall back to others via OpenRouter routing
const DEFAULT_MODEL = "openrouter/anthropic/claude-sonnet-4";

/** Get the workspace dir for a job */
function getJobDir(jobId: string): string {
  const base = resolve(CONFIG.openclawHome, "jobs");
  const target = resolve(base, jobId);
  if (!target.startsWith(base + "/")) {
    throw new Error("Path traversal detected");
  }
  return target;
}

/**
 * Send a status webhook back to Convex.
 * Reuses the same HMAC signing pattern as webhook-sender.ts.
 */
async function sendJobWebhook(
  jobId: string,
  status: string,
  extra?: {
    message?: string;
    prUrl?: string;
    prNumber?: number;
    errorMessage?: string;
    tokenUsage?: { inputTokens: number; outputTokens: number; totalCost?: number };
  },
): Promise<void> {
  if (!CONFIG.convexSiteUrl) {
    console.warn("[job-runner] CONVEX_SITE_URL not configured, skipping webhook");
    return;
  }

  const url = `${CONFIG.convexSiteUrl}/webhooks/agent-job-status`;
  const payload = { jobId, status, ...extra };
  const body = JSON.stringify(payload);

  let signature = "";
  if (CONFIG.webhookSecret) {
    const timestamp = Date.now();
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(CONFIG.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const data = new TextEncoder().encode(`${timestamp}.${body}`);
    const sig = await crypto.subtle.sign("HMAC", key, data);
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    signature = `t=${timestamp},s=${hex}`;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signature && { "X-Webhook-Signature": signature }),
        },
        body,
      });

      if (response.ok) return;

      const text = await response.text();
      console.error(
        `[job-runner] Webhook ${response.status}: ${text} (attempt ${attempt + 1}/3)`,
      );

      if (response.status >= 400 && response.status < 500) return;
    } catch (err) {
      console.error(`[job-runner] Webhook failed (attempt ${attempt + 1}/3):`, err);
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
}

/** Run a shell command via Bun.spawn (no bash -c shell injection) */
async function exec(
  args: string[],
  cwd: string,
  timeoutMs = 60_000,
  extraEnv?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(args, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...extraEnv },
  });

  const timeout = setTimeout(() => proc.kill(), timeoutMs);

  try {
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    clearTimeout(timeout);
    return { stdout, stderr, exitCode };
  } catch {
    clearTimeout(timeout);
    return { stdout: "", stderr: "Process timed out", exitCode: 1 };
  }
}

/** Convenience: run a bash command string */
async function sh(
  cmd: string,
  cwd: string,
  timeoutMs = 60_000,
  extraEnv?: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return exec(["bash", "-c", cmd], cwd, timeoutMs, extraEnv);
}

/** Detect the package manager for a repo */
function detectPackageManager(repoDir: string): "bun" | "pnpm" | "yarn" | "npm" | null {
  try {
    if (existsSync(join(repoDir, "bun.lockb")) || existsSync(join(repoDir, "bun.lock"))) return "bun";
    if (existsSync(join(repoDir, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(repoDir, "yarn.lock"))) return "yarn";
    if (existsSync(join(repoDir, "package.json"))) return "npm";
  } catch {
    // No package.json
  }
  return null;
}

/** Install dependencies if a package manager is detected */
async function installDependencies(repoDir: string): Promise<void> {
  const pm = detectPackageManager(repoDir);
  if (!pm) return;

  const installCmd = pm === "pnpm" ? "pnpm install --frozen-lockfile" :
                     pm === "yarn" ? "yarn install --frozen-lockfile" :
                     pm === "bun" ? "bun install --frozen-lockfile" :
                     "npm ci";

  console.log(`[job-runner] Installing dependencies with ${pm}`);
  const result = await sh(installCmd, repoDir, 3 * 60 * 1000);

  // If frozen lockfile fails (e.g. lockfile out of date), try regular install
  if (result.exitCode !== 0) {
    console.warn(`[job-runner] Frozen install failed, trying regular install`);
    const fallbackCmd = `${pm} install`;
    const fallback = await sh(fallbackCmd, repoDir, 3 * 60 * 1000);
    if (fallback.exitCode !== 0) {
      console.warn(`[job-runner] Dependency install failed: ${fallback.stderr.slice(0, 500)}`);
    }
  }
}

/** Detect test command from package.json */
async function detectTestCommand(repoDir: string): Promise<string | null> {
  try {
    const pkgPath = join(repoDir, "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
      const pm = detectPackageManager(repoDir);
      return pm ? `${pm} test` : "npm test";
    }
  } catch {
    // No package.json or invalid
  }

  try {
    const makefile = await readFile(join(repoDir, "Makefile"), "utf-8");
    if (/^test:/m.test(makefile)) return "make test";
  } catch {
    // No Makefile
  }

  return null;
}

/**
 * Write OpenCode config into the repo so it picks up OpenRouter credentials.
 */
async function writeOpenCodeConfig(repoDir: string): Promise<void> {
  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: {
      openrouter: {},
    },
  };
  await writeFile(join(repoDir, "opencode.json"), JSON.stringify(config, null, 2));
}

/**
 * Main job runner — called async (non-blocking) from the route handler.
 */
export async function runJob(params: JobParams): Promise<void> {
  const { jobId, repoFullName, branch, defaultBranch, githubToken, prompt } = params;
  const jobDir = getJobDir(jobId);
  const repoDir = join(jobDir, "repo");

  try {
    // 1. Setup workspace
    await mkdir(jobDir, { recursive: true });

    // 2. Clone or reuse repo
    if (params.isRevision || params.isRetry) {
      if (existsSync(repoDir)) {
        await sendJobWebhook(jobId, "working", { message: "Pulling latest changes" });
        await sh(`git pull origin ${branch} || true`, repoDir);
      } else {
        await sendJobWebhook(jobId, "cloning", { message: "Cloning repository" });
        const cloneUrl = `https://x-access-token:${githubToken}@github.com/${repoFullName}.git`;
        const result = await sh(`git clone --depth 50 '${cloneUrl}' repo`, jobDir, 120_000);
        if (result.exitCode !== 0) {
          throw new Error(`Clone failed: ${result.stderr}`);
        }
        await sh(`git checkout ${branch} || git checkout -b ${branch}`, repoDir);
      }
    } else {
      await sendJobWebhook(jobId, "cloning", { message: "Cloning repository" });
      const cloneUrl = `https://x-access-token:${githubToken}@github.com/${repoFullName}.git`;
      const result = await sh(`git clone --depth 50 '${cloneUrl}' repo`, jobDir, 120_000);
      if (result.exitCode !== 0) {
        throw new Error(`Clone failed: ${result.stderr}`);
      }
      await sh(`git checkout -b ${branch}`, repoDir);
    }

    // 3. Configure git
    await sh(
      'git config user.name "mp-agent[bot]" && git config user.email "agent@modernphase.io"',
      repoDir,
    );

    // 4. Install dependencies
    await sendJobWebhook(jobId, "working", { message: "Installing dependencies" });
    await installDependencies(repoDir);

    // 5. Write OpenCode config for OpenRouter
    await writeOpenCodeConfig(repoDir);

    // 6. Send working status
    await sendJobWebhook(jobId, "working", { message: "Agent is analyzing the codebase" });

    // 7. Write prompt to a temp file (avoids shell escaping issues)
    const promptFile = join(jobDir, "prompt.txt");
    await writeFile(promptFile, prompt);
    const promptContent = await readFile(promptFile, "utf-8");

    // 8. Run OpenCode in non-interactive mode
    //    opencode run --model <provider/model> "<prompt>"
    //    OPENROUTER_API_KEY is passed from orchestrator env
    const model = CONFIG.openCodeModel || DEFAULT_MODEL;
    console.log(`[job-runner] Running OpenCode with model=${model} in ${repoDir}`);

    // Use key from payload (passed by Convex) or fall back to orchestrator env
    const apiKey = params.openRouterKey || CONFIG.openRouterApiKey;
    if (!apiKey) {
      throw new Error("No OpenRouter API key — set OPEN_ROUTER in Convex env or OPENROUTER_API_KEY in orchestrator env");
    }

    const openCodeResult = await exec(
      [OPENCODE_BIN, "run", "--model", model, promptContent],
      repoDir,
      JOB_TIMEOUT_MS,
      { OPENROUTER_API_KEY: apiKey },
    );

    console.log(`[job-runner] OpenCode exit=${openCodeResult.exitCode} stdout=${openCodeResult.stdout.length}b stderr=${openCodeResult.stderr.length}b`);

    if (openCodeResult.exitCode !== 0) {
      const errOutput = (openCodeResult.stderr || openCodeResult.stdout).slice(0, 1500);
      await sendJobWebhook(jobId, "failed", {
        message: "OpenCode exited with error",
        errorMessage: errOutput,
      });
      return;
    }

    // 9. Check if there are any changes to commit
    const diffResult = await sh("git diff --stat HEAD", repoDir);
    const stagedResult = await sh("git diff --cached --stat", repoDir);
    const untrackedResult = await sh("git ls-files --others --exclude-standard", repoDir);

    const hasChanges =
      diffResult.stdout.trim() ||
      stagedResult.stdout.trim() ||
      untrackedResult.stdout.trim();

    if (!hasChanges) {
      await sendJobWebhook(jobId, "failed", {
        message: "Agent made no changes to the codebase",
        errorMessage: "No changes detected after agent run",
      });
      return;
    }

    // 10. Stage and commit if OpenCode didn't already
    const statusResult = await sh("git status --porcelain", repoDir);
    if (statusResult.stdout.trim()) {
      // Don't commit the opencode.json config file
      await sh("git checkout -- opencode.json 2>/dev/null || rm -f opencode.json", repoDir);
      await sh("git add -A", repoDir);

      // Check again after removing opencode.json
      const statusAfter = await sh("git status --porcelain", repoDir);
      if (statusAfter.stdout.trim()) {
        const commitMsg = `fix: ${params.issueTitle} (#${params.issueNumber})`;
        await exec(["git", "commit", "-m", commitMsg], repoDir);
      }
    }

    // 11. Run tests
    await sendJobWebhook(jobId, "testing", { message: "Running tests" });
    const testCmd = await detectTestCommand(repoDir);

    if (testCmd) {
      const testResult = await sh(testCmd, repoDir, 5 * 60 * 1000);
      if (testResult.exitCode !== 0) {
        const errorSummary = (testResult.stderr || testResult.stdout).slice(0, 500);
        await sendJobWebhook(jobId, "failed", {
          message: `Tests failed: ${errorSummary}`,
          errorMessage: `tests_failed: ${errorSummary}`,
        });
        return;
      }
    }

    // 12. Push branch
    const pushResult = await sh(
      `git push origin ${branch} --force-with-lease`,
      repoDir,
      60_000,
    );
    if (pushResult.exitCode !== 0) {
      throw new Error(`Push failed: ${pushResult.stderr}`);
    }

    // 13. Create PR via GitHub API
    const [owner, repo] = repoFullName.split("/");
    const prBody = `Closes #${params.issueNumber}\n\n---\n_Automatically generated by [MP Agent](https://modernphase.io)_`;

    const prResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          title: `fix: ${params.issueTitle} (#${params.issueNumber})`,
          body: prBody,
          head: branch,
          base: defaultBranch,
        }),
      },
    );

    if (!prResponse.ok) {
      const prError = await prResponse.text();
      throw new Error(`PR creation failed: ${prError}`);
    }

    const pr = (await prResponse.json()) as { html_url: string; number: number };

    // 14. Send final status
    await sendJobWebhook(jobId, "pr_created", {
      message: `PR #${pr.number} created`,
      prUrl: pr.html_url,
      prNumber: pr.number,
    });
  } catch (error) {
    console.error(`[job-runner] Job ${jobId} failed:`, error);
    await sendJobWebhook(jobId, "failed", {
      message: `Job error: ${error instanceof Error ? error.message : String(error)}`,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Cleanup a job workspace.
 */
export async function cleanupJob(jobId: string): Promise<void> {
  const jobDir = getJobDir(jobId);
  try {
    await rm(jobDir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}
