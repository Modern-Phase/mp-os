import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./utils/auth";
import { GITHUB_TOKEN } from "./env";

// ─── Helpers ───────────────────────────────────────────────────

async function getGitHubToken(
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

async function githubFetch(token: string, path: string, params?: Record<string, string>) {
  const url = new URL(`https://api.github.com${path}`);
  if (params) {
    for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
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
