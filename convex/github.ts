import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./utils/auth";
import { GITHUB_TOKEN } from "./env";

// ─── Helpers (exported for use by other modules) ──────────────

export async function getGitHubToken(
  ctx: { runQuery: any },
  orgId: string,
): Promise<string> {
  const connection = await ctx.runQuery(internal.github.getConnectionInternal, {
    orgId,
  });
  if (connection?.accessToken) return connection.accessToken;
  if (GITHUB_TOKEN) return GITHUB_TOKEN;
  throw new Error("No GitHub token configured");
}

export async function githubFetch(
  token: string,
  path: string,
  params?: Record<string, string>,
  options?: { method?: string; body?: string },
) {
  const url = new URL(`https://api.github.com${path}`);
  if (params) {
    for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  }
  const res = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options?.body ? { body: options.body } : {}),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Internal Queries ──────────────────────────────────────────

import { internalQuery } from "./_generated/server";

export const getConnectionInternal = internalQuery({
  args: { orgId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const orgId = ctx.db.normalizeId("organizations", args.orgId);
    if (!orgId) return null;
    return ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q: any) =>
        q.eq("orgId", orgId).eq("provider", "github"),
      )
      .first();
  },
});

// ─── Queries ───────────────────────────────────────────────────

export const getConnection = query({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q) =>
        q.eq("orgId", args.orgId).eq("provider", "github"),
      )
      .first();
    if (!integration) return null;
    return {
      status: integration.status,
      connectedAt: integration.connectedAt,
      lastError: integration.lastError,
    };
  },
});

export const getTrackedRepos = query({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return ctx.db
      .query("githubRepos")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

// ─── Mutations ─────────────────────────────────────────────────

export const connectGitHub = mutation({
  args: {
    orgId: v.id("organizations"),
    token: v.string(),
  },
  returns: v.id("integrations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Remove any existing GitHub integration for this org
    const existing = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q) =>
        q.eq("orgId", args.orgId).eq("provider", "github"),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);

    return ctx.db.insert("integrations", {
      orgId: args.orgId,
      provider: "github",
      accessToken: args.token,
      refreshToken: "",
      tokenExpiresAt: 0,
      connectedAt: Date.now(),
      connectedBy: userId,
      status: "active",
    });
  },
});

export const disconnectGitHub = mutation({
  args: { orgId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const integration = await ctx.db
      .query("integrations")
      .withIndex("orgId_provider", (q) =>
        q.eq("orgId", args.orgId).eq("provider", "github"),
      )
      .first();
    if (integration) await ctx.db.delete(integration._id);

    // Remove tracked repos
    const repos = await ctx.db
      .query("githubRepos")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    for (const repo of repos) {
      await ctx.db.delete(repo._id);
    }
    return null;
  },
});

export const addTrackedRepo = mutation({
  args: {
    orgId: v.id("organizations"),
    repoFullName: v.string(),
    repoUrl: v.string(),
    description: v.optional(v.string()),
    defaultBranch: v.string(),
    isPrivate: v.boolean(),
  },
  returns: v.id("githubRepos"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Prevent duplicates
    const existing = await ctx.db
      .query("githubRepos")
      .withIndex("orgId_repoFullName", (q) =>
        q.eq("orgId", args.orgId).eq("repoFullName", args.repoFullName),
      )
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("githubRepos", {
      orgId: args.orgId,
      repoFullName: args.repoFullName,
      repoUrl: args.repoUrl,
      description: args.description,
      defaultBranch: args.defaultBranch,
      isPrivate: args.isPrivate,
      addedBy: userId,
      addedAt: Date.now(),
    });
  },
});

export const removeTrackedRepo = mutation({
  args: {
    orgId: v.id("organizations"),
    repoId: v.id("githubRepos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.repoId);
    return null;
  },
});

export const linkRepoToProject = mutation({
  args: {
    repoId: v.id("githubRepos"),
    projectId: v.optional(v.id("agentProjects")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.repoId, { linkedProjectId: args.projectId });
    return null;
  },
});

// ─── Actions (GitHub REST API) ─────────────────────────────────

export const listUserRepos = action({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);

    // Fetch user's repos (owned + collaborator)
    const userRepos = await githubFetch(token, "/user/repos", {
      per_page: "100",
      sort: "updated",
      affiliation: "owner,collaborator",
    });

    // Fetch user's orgs
    const orgs: any[] = await githubFetch(token, "/user/orgs");

    // Fetch repos for each org
    const orgRepos: Record<string, any[]> = {};
    for (const org of orgs) {
      try {
        const repos = await githubFetch(token, `/orgs/${org.login}/repos`, {
          per_page: "100",
          sort: "updated",
        });
        orgRepos[org.login] = repos.map((r: any) => ({
          fullName: r.full_name,
          name: r.name,
          description: r.description,
          url: r.html_url,
          defaultBranch: r.default_branch,
          isPrivate: r.private,
          language: r.language,
          updatedAt: r.updated_at,
          stargazersCount: r.stargazers_count,
        }));
      } catch {
        // Skip orgs we can't read
      }
    }

    return {
      personal: userRepos.map((r: any) => ({
        fullName: r.full_name,
        name: r.name,
        description: r.description,
        url: r.html_url,
        defaultBranch: r.default_branch,
        isPrivate: r.private,
        language: r.language,
        updatedAt: r.updated_at,
        stargazersCount: r.stargazers_count,
      })),
      organizations: orgRepos,
    };
  },
});

export const getRepoCommits = action({
  args: {
    orgId: v.id("organizations"),
    repoFullName: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);
    const [owner, repo] = args.repoFullName.split("/");
    const commits = await githubFetch(token, `/repos/${owner}/${repo}/commits`, {
      per_page: "20",
    });
    return commits.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      authorName: c.commit.author?.name,
      authorLogin: c.author?.login,
      authorAvatar: c.author?.avatar_url,
      date: c.commit.author?.date,
      url: c.html_url,
    }));
  },
});

export const getRepoPullRequests = action({
  args: {
    orgId: v.id("organizations"),
    repoFullName: v.string(),
    state: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);
    const [owner, repo] = args.repoFullName.split("/");
    const prs = await githubFetch(token, `/repos/${owner}/${repo}/pulls`, {
      per_page: "30",
      state: args.state || "open",
      sort: "updated",
      direction: "desc",
    });
    return prs.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: pr.draft,
      authorLogin: pr.user?.login,
      authorAvatar: pr.user?.avatar_url,
      labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })),
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
      mergeable: pr.mergeable,
    }));
  },
});

export const getRepoIssues = action({
  args: {
    orgId: v.id("organizations"),
    repoFullName: v.string(),
    state: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);
    const [owner, repo] = args.repoFullName.split("/");
    const items = await githubFetch(token, `/repos/${owner}/${repo}/issues`, {
      per_page: "30",
      state: args.state || "open",
      sort: "updated",
      direction: "desc",
    });
    // GitHub Issues API includes PRs — filter them out
    const issues = items.filter((i: any) => !i.pull_request);
    return issues.map((i: any) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      authorLogin: i.user?.login,
      authorAvatar: i.user?.avatar_url,
      labels: i.labels?.map((l: any) => ({ name: l.name, color: l.color })),
      assignees: i.assignees?.map((a: any) => ({
        login: a.login,
        avatar: a.avatar_url,
      })),
      createdAt: i.created_at,
      updatedAt: i.updated_at,
      url: i.html_url,
      comments: i.comments,
    }));
  },
});

// ─── Internal Queries (for cross-module use) ──────────────────

export const getReposForProject = internalQuery({
  args: { projectId: v.id("agentProjects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    // Find repos linked to this project
    const allRepos = await ctx.db.query("githubRepos").collect();
    return allRepos.filter((r) => r.linkedProjectId === args.projectId);
  },
});

export const getTrackedReposWithProjects = internalQuery({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const repos = await ctx.db
      .query("githubRepos")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const enriched = await Promise.all(
      repos.map(async (repo) => {
        const project = repo.linkedProjectId
          ? await ctx.db.get(repo.linkedProjectId)
          : null;
        return {
          _id: repo._id,
          repoFullName: repo.repoFullName,
          defaultBranch: repo.defaultBranch,
          linkedProjectId: repo.linkedProjectId,
          projectName: project?.name || null,
        };
      }),
    );
    return enriched;
  },
});

// ─── Repo Metrics Action ──────────────────────────────────────

export const getRepoMetrics = action({
  args: {
    orgId: v.id("organizations"),
    repoFullName: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);
    const [owner, repo] = args.repoFullName.split("/");

    // Fetch commits (last 30 days), PRs (all states), issues (all states) in parallel
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [commits, openPRs, closedPRs, openIssues, closedIssues] = await Promise.all([
      githubFetch(token, `/repos/${owner}/${repo}/commits`, {
        per_page: "100",
        since,
      }),
      githubFetch(token, `/repos/${owner}/${repo}/pulls`, {
        per_page: "100",
        state: "open",
      }),
      githubFetch(token, `/repos/${owner}/${repo}/pulls`, {
        per_page: "100",
        state: "closed",
        sort: "updated",
        direction: "desc",
      }),
      githubFetch(token, `/repos/${owner}/${repo}/issues`, {
        per_page: "100",
        state: "open",
      }).then((items: any[]) => items.filter((i: any) => !i.pull_request)),
      githubFetch(token, `/repos/${owner}/${repo}/issues`, {
        per_page: "100",
        state: "closed",
        sort: "updated",
        direction: "desc",
      }).then((items: any[]) => items.filter((i: any) => !i.pull_request)),
    ]);

    // Commit frequency by day (last 30 days)
    const commitsByDay: Record<string, number> = {};
    for (const c of commits) {
      const date = (c.commit?.author?.date || "").slice(0, 10);
      if (date) commitsByDay[date] = (commitsByDay[date] || 0) + 1;
    }
    const commitFrequency = Object.entries(commitsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // PR cycle times (merged PRs)
    const mergedPRs = closedPRs.filter((pr: any) => pr.merged_at);
    const prCycleTimes = mergedPRs.slice(0, 20).map((pr: any) => {
      const created = new Date(pr.created_at).getTime();
      const merged = new Date(pr.merged_at).getTime();
      const hoursToMerge = Math.round((merged - created) / (1000 * 60 * 60));
      return {
        number: pr.number,
        title: pr.title,
        hoursToMerge,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
      };
    });

    // Issue burndown data
    const issueBurndown = {
      open: openIssues.length,
      closed: closedIssues.length,
      total: openIssues.length + closedIssues.length,
    };

    return {
      commitFrequency,
      prCycleTimes,
      issueBurndown,
      summary: {
        totalCommits: commits.length,
        openPRs: openPRs.length,
        mergedPRs: mergedPRs.length,
        openIssues: openIssues.length,
        closedIssues: closedIssues.length,
      },
    };
  },
});

// ─── All Open Issues Across Repos ────────────────────────────

export const getAllOpenIssues = action({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);

    // Get all tracked repos with project info
    const repos: any[] = await ctx.runQuery(
      internal.github.getTrackedReposWithProjects,
      { orgId: args.orgId },
    );

    if (!repos.length) return [];

    // Fetch open issues from all repos in parallel
    const repoIssues = await Promise.all(
      repos.map(async (repo) => {
        const [owner, repoName] = repo.repoFullName.split("/");
        try {
          const items = await githubFetch(
            token,
            `/repos/${owner}/${repoName}/issues`,
            { per_page: "30", state: "open", sort: "updated", direction: "desc" },
          );
          // Filter out PRs (GitHub includes them in /issues)
          const issues = items.filter((i: any) => !i.pull_request);
          return {
            repoId: repo._id,
            repoFullName: repo.repoFullName,
            defaultBranch: repo.defaultBranch,
            linkedProjectId: repo.linkedProjectId,
            projectName: repo.projectName,
            issues: issues.map((i: any) => ({
              number: i.number,
              title: i.title,
              body: i.body,
              state: i.state,
              authorLogin: i.user?.login,
              authorAvatar: i.user?.avatar_url,
              labels: i.labels?.map((l: any) => ({ name: l.name, color: l.color })),
              assignees: i.assignees?.map((a: any) => ({
                login: a.login,
                avatar: a.avatar_url,
              })),
              createdAt: i.created_at,
              updatedAt: i.updated_at,
              url: i.html_url,
              comments: i.comments,
            })),
          };
        } catch {
          // Skip repos that fail (permissions, etc.)
          return {
            repoId: repo._id,
            repoFullName: repo.repoFullName,
            defaultBranch: repo.defaultBranch,
            linkedProjectId: repo.linkedProjectId,
            projectName: repo.projectName,
            issues: [],
          };
        }
      }),
    );

    // Group by project
    const byProject: Record<
      string,
      {
        projectId: string | null;
        projectName: string;
        repos: { repoFullName: string; issues: any[] }[];
      }
    > = {};

    for (const ri of repoIssues) {
      const key = ri.linkedProjectId || "__unlinked__";
      if (!byProject[key]) {
        byProject[key] = {
          projectId: ri.linkedProjectId,
          projectName: ri.projectName || "Unlinked Repos",
          repos: [],
        };
      }
      if (ri.issues.length > 0) {
        byProject[key].repos.push({
          repoFullName: ri.repoFullName,
          issues: ri.issues,
        });
      }
    }

    // Convert to array, sort: linked projects first, then unlinked
    return Object.values(byProject)
      .filter((g) => g.repos.length > 0)
      .sort((a, b) => {
        if (a.projectId && !b.projectId) return -1;
        if (!a.projectId && b.projectId) return 1;
        return a.projectName.localeCompare(b.projectName);
      });
  },
});
