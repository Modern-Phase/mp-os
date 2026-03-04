// convex/tickets.ts — Ticket system for client change requests

import { v } from "convex/values";
import {
  action,
  query,
  mutation,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./utils/auth";
import { getGitHubToken, githubFetch } from "./github";
import { OPEN_ROUTER, HELICONE_API_KEY, SITE_URL } from "./env";
import {
  ticketSourceValidator,
  ticketStatusValidator,
  priorityValidator,
} from "./schema";

// ─── Queries ───────────────────────────────────────────────────

export const getTickets = query({
  args: {
    orgId: v.id("organizations"),
    status: v.optional(ticketStatusValidator),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let tickets;
    if (args.status) {
      tickets = await ctx.db
        .query("tickets")
        .withIndex("orgId_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", args.status!),
        )
        .collect();
    } else {
      tickets = await ctx.db
        .query("tickets")
        .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
        .collect();
    }

    // Apply additional filters
    if (args.leadId) {
      tickets = tickets.filter((t) => t.leadId === args.leadId);
    }
    if (args.projectId) {
      tickets = tickets.filter((t) => t.projectId === args.projectId);
    }

    // Join lead/project names
    const enriched = await Promise.all(
      tickets.map(async (t) => {
        const lead = t.leadId ? await ctx.db.get(t.leadId) : null;
        const project = t.projectId ? await ctx.db.get(t.projectId) : null;
        const assignee = t.assignedTo ? await ctx.db.get(t.assignedTo) : null;
        return {
          ...t,
          leadName: lead?.company,
          projectName: project?.name,
          assigneeName: assignee?.username || assignee?.email,
        };
      }),
    );

    return enriched.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getTicket = query({
  args: { ticketId: v.id("tickets") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    const lead = ticket.leadId ? await ctx.db.get(ticket.leadId) : null;
    const project = ticket.projectId
      ? await ctx.db.get(ticket.projectId)
      : null;
    const assignee = ticket.assignedTo
      ? await ctx.db.get(ticket.assignedTo)
      : null;
    const creator = await ctx.db.get(ticket.createdBy);

    return {
      ...ticket,
      leadName: lead?.company,
      leadContactName: lead?.contactName,
      projectName: project?.name,
      assigneeName: assignee?.username || assignee?.email,
      creatorName: creator?.username || creator?.email,
    };
  },
});

export const getTicketsByLead = query({
  args: { leadId: v.id("crmLeads") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("leadId", (q) => q.eq("leadId", args.leadId))
      .collect();
    return tickets.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getTicketsByProject = query({
  args: { projectId: v.id("agentProjects") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    return tickets.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getTicketStats = query({
  args: { orgId: v.id("organizations") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("orgId", (q) => q.eq("orgId", args.orgId))
      .collect();

    const stats = {
      total: tickets.length,
      open: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
    };
    for (const t of tickets) {
      stats[t.status as keyof typeof stats] =
        (stats[t.status as keyof typeof stats] as number) + 1;
    }
    return stats;
  },
});

// ─── Mutations ─────────────────────────────────────────────────

export const createTicket = mutation({
  args: {
    orgId: v.id("organizations"),
    title: v.string(),
    description: v.string(),
    source: ticketSourceValidator,
    priority: priorityValidator,
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    loomUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    assignedTo: v.optional(v.id("users")),
    syncToGitHub: v.optional(v.boolean()),
    githubRepoId: v.optional(v.id("githubRepos")),
    githubIssueNumber: v.optional(v.number()),
    githubIssueUrl: v.optional(v.string()),
  },
  returns: v.id("tickets"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const ticketId = await ctx.db.insert("tickets", {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      source: args.source,
      status: "open",
      priority: args.priority,
      leadId: args.leadId,
      projectId: args.projectId,
      loomUrl: args.loomUrl,
      tags: args.tags,
      assignedTo: args.assignedTo,
      createdBy: userId,
      githubRepoId: args.githubRepoId,
      githubIssueNumber: args.githubIssueNumber,
      githubIssueUrl: args.githubIssueUrl,
    });

    // Schedule Loom processing if URL provided (chains into GitHub issue creation)
    if (args.loomUrl && args.source === "loom") {
      const repo =
        args.syncToGitHub && args.githubRepoId
          ? await ctx.db.get(args.githubRepoId)
          : null;
      await ctx.scheduler.runAfter(0, internal.tickets.processLoomUrlInternal, {
        orgId: args.orgId,
        ticketId,
        loomUrl: args.loomUrl,
        syncToGitHub: args.syncToGitHub || false,
        repoFullName: repo?.repoFullName,
      });
    } else if (args.syncToGitHub && args.githubRepoId) {
      // Non-Loom tickets: create GitHub issue immediately
      const repo = await ctx.db.get(args.githubRepoId);
      if (repo) {
        await ctx.scheduler.runAfter(
          0,
          internal.tickets.createGitHubIssueInternal,
          {
            orgId: args.orgId,
            ticketId,
            repoFullName: repo.repoFullName,
            title: args.title,
            body: args.description,
          },
        );
      }
    }

    return ticketId;
  },
});

export const updateTicket = mutation({
  args: {
    ticketId: v.id("tickets"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(ticketStatusValidator),
    priority: v.optional(priorityValidator),
    assignedTo: v.optional(v.id("users")),
    leadId: v.optional(v.id("crmLeads")),
    projectId: v.optional(v.id("agentProjects")),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const { ticketId, ...updates } = args;
    const patch: Record<string, any> = {};

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) patch[key] = val;
    }

    // Auto-set timestamps on status changes
    if (args.status === "resolved") {
      patch.resolvedAt = Date.now();
    }
    if (args.status === "closed") {
      patch.closedAt = Date.now();
    }

    await ctx.db.patch(ticketId, patch);
    return null;
  },
});

export const deleteTicket = mutation({
  args: { ticketId: v.id("tickets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.ticketId);
    return null;
  },
});

// ─── Internal Mutations (called from actions) ──────────────────

export const PREAUTH_linkGitHubIssue = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    repoId: v.id("githubRepos"),
    issueNumber: v.number(),
    issueUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      githubRepoId: args.repoId,
      githubIssueNumber: args.issueNumber,
      githubIssueUrl: args.issueUrl,
    });
  },
});

export const PREAUTH_updateLoomData = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    title: v.string(),
    description: v.string(),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, {
      title: args.title,
      description: args.description,
      loomTranscript: args.transcript,
    });
  },
});

// ─── Actions (external API calls) ─────────────────────────────

export const createGitHubIssueInternal = internalAction({
  args: {
    orgId: v.id("organizations"),
    ticketId: v.id("tickets"),
    repoFullName: v.string(),
    title: v.string(),
    body: v.string(),
    labels: v.optional(v.array(v.string())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const token = await getGitHubToken(ctx, args.orgId as string);
    const [owner, repo] = args.repoFullName.split("/");

    const issue = await githubFetch(
      token,
      `/repos/${owner}/${repo}/issues`,
      undefined,
      {
        method: "POST",
        body: JSON.stringify({
          title: args.title,
          body: args.body,
          labels: args.labels || [],
        }),
      },
    );

    // Look up the repo doc by fullName to get its _id
    const repoDoc: any = await ctx.runQuery(
      internal.tickets.getRepoByFullName,
      {
        orgId: args.orgId,
        repoFullName: args.repoFullName,
      },
    );

    if (repoDoc) {
      await ctx.runMutation(internal.tickets.PREAUTH_linkGitHubIssue, {
        ticketId: args.ticketId,
        repoId: repoDoc._id,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      });
    }

    return { number: issue.number, url: issue.html_url };
  },
});

// ─── Loom Helpers ─────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

function extractLoomVideoId(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9]+)/);
  return m ? m[1] : null;
}

/** Extract signed transcript CDN URL from __APOLLO_STATE__ */
function extractTranscriptUrl(html: string): string | null {
  const m = html.match(
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  );
  if (!m) return null;
  try {
    const apollo = JSON.parse(m[1]);
    for (const key of Object.keys(apollo)) {
      if (key.startsWith("VideoTranscriptDetails:")) {
        const url = apollo[key]?.source_url;
        if (typeof url === "string" && url.startsWith("http")) return url;
      }
    }
  } catch {
    /* parse failed */
  }
  return null;
}

/** Extract Loom AI-generated description from __APOLLO_STATE__ or og:description */
function extractDescriptionFromHTML(html: string): string {
  // Try Apollo state first (richer data)
  const m = html.match(
    /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
  );
  if (m) {
    try {
      const apollo = JSON.parse(m[1]);
      for (const key of Object.keys(apollo)) {
        if (key.startsWith("RegularUserVideo:")) {
          const desc = apollo[key]?.description;
          if (typeof desc === "string" && desc.length > 20) return desc;
        }
      }
    } catch {
      /* ignore */
    }
  }
  // Fallback to og:description
  const ogDesc = html.match(
    /<meta\s+property="og:description"\s+content="([^"]*?)"/,
  );
  if (ogDesc) return ogDesc[1].replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return "";
}

/** Fetch transcript from signed CDN URL and join phrase values */
async function fetchTranscriptFromCDN(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) return "";
  const data = await res.json();
  if (Array.isArray(data?.phrases)) {
    return data.phrases
      .map((p: any) => p.value || "")
      .join(" ")
      .trim();
  }
  return "";
}

function extractTitleFromHTML(html: string): string {
  const ogMatch = html.match(
    /<meta\s+(?:property|name)="og:title"\s+content="([^"]*?)"/,
  );
  if (ogMatch) return ogMatch[1];
  const ldMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      if (ld.name) return ld.name;
    } catch {
      /* ignore */
    }
  }
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  if (titleMatch) return titleMatch[1].replace(/ \| Loom$/, "").trim();
  return "";
}

/** Extract direct video file URL from page source for Whisper fallback */
function extractVideoUrlFromHTML(html: string): string | null {
  const ndMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1]);
      const vp = nd?.props?.pageProps?.video;
      const urls = [
        vp?.url,
        vp?.asset_url,
        vp?.raw_cdn_url,
        vp?.source_url,
      ];
      for (const u of urls) {
        if (typeof u === "string" && u.startsWith("http")) return u;
      }
    } catch {
      /* ignore */
    }
  }
  // og:video meta that points to an actual file (skip embed URLs)
  const ogVid = html.match(
    /<meta\s+property="og:video(?::url)?"\s+content="([^"]*?)"/,
  );
  if (ogVid && !ogVid[1].includes("/embed/")) return ogVid[1];
  // <source src="...mp4">
  const src = html.match(/<source[^>]+src="([^"]*?\.mp4[^"]*?)"/);
  if (src) return src[1];
  return null;
}

/** Transcribe video audio via OpenRouter multimodal model (Gemini Flash) */
async function transcribeViaOpenRouter(videoUrl: string): Promise<string> {
  if (!OPEN_ROUTER) return "";
  // Download video and base64-encode it
  const res = await fetch(videoUrl);
  if (!res.ok) return "";
  const buf = await res.arrayBuffer();
  // Skip if > 15 MB (base64 bloats ~33%, keep request reasonable)
  if (buf.byteLength > 15 * 1024 * 1024) return "";

  const base64 = Buffer.from(buf).toString("base64");
  const dataUri = `data:video/mp4;base64,${base64}`;

  const baseURL = HELICONE_API_KEY
    ? "https://openrouter.helicone.ai/api/v1"
    : "https://openrouter.ai/api/v1";

  const aiRes = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPEN_ROUTER}`,
      "HTTP-Referer": SITE_URL || "http://localhost:5173",
      "X-Title": "Loom Video Transcriber",
      ...(HELICONE_API_KEY
        ? { "Helicone-Auth": `Bearer ${HELICONE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe the spoken audio from this video. Return ONLY the transcript text, no timestamps or labels.",
            },
            {
              type: "image_url",
              image_url: { url: dataUri },
            },
          ],
        },
      ],
    }),
  });
  if (!aiRes.ok) return "";
  const data = await aiRes.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

/** AI-summarize a transcript into a ticket title + description */
async function summarizeTranscript(
  transcript: string,
): Promise<{ title: string; description: string } | null> {
  if (!OPEN_ROUTER || !transcript) return null;
  const baseURL = HELICONE_API_KEY
    ? "https://openrouter.helicone.ai/api/v1"
    : "https://openrouter.ai/api/v1";

  const aiRes = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPEN_ROUTER}`,
      "HTTP-Referer": SITE_URL || "http://localhost:5173",
      "X-Title": "Ticket Loom Processor",
      ...(HELICONE_API_KEY
        ? { "Helicone-Auth": `Bearer ${HELICONE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes client video transcripts into actionable tickets. Output valid JSON only.",
        },
        {
          role: "user",
          content: `Summarize this client Loom video transcript into a change request ticket.

Transcript:
${transcript.slice(0, 8000)}

Return JSON with:
- "title": concise ticket title (max 80 chars)
- "description": detailed description of what the client wants changed, formatted in markdown with bullet points for distinct requests`,
        },
      ],
    }),
  });
  if (!aiRes.ok) return null;
  const data = await aiRes.json();
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title || "",
    description: parsed.description || "",
  };
}

// ─── Loom Preview (public — returns data without creating anything) ──

export const previewLoomUrl = action({
  args: { loomUrl: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) => {
    let transcript = "";
    let title = "";
    let description = "";
    let method = "none";

    // Fetch page
    let html = "";
    try {
      const res = await fetch(args.loomUrl, { headers: BROWSER_HEADERS });
      html = await res.text();
      title = extractTitleFromHTML(html);
    } catch {
      /* continue */
    }

    // Extract transcript from Apollo CDN
    if (html) {
      const transcriptUrl = extractTranscriptUrl(html);
      if (transcriptUrl) {
        try {
          transcript = await fetchTranscriptFromCDN(transcriptUrl);
          if (transcript) method = "apollo-cdn";
        } catch {
          /* ignore */
        }
      }
    }

    // Fallback: Loom's AI description
    let loomDescription = "";
    if (html) {
      loomDescription = extractDescriptionFromHTML(html);
    }

    // Fallback: oEmbed
    if (!title || (!transcript && !loomDescription)) {
      try {
        const oembedRes = await fetch(
          `https://www.loom.com/v1/oembed?url=${encodeURIComponent(args.loomUrl)}`,
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          title = title || oembed.title || "";
          if (!transcript && !loomDescription && oembed.description) {
            loomDescription = oembed.description;
          }
        }
      } catch {
        /* ignore */
      }
    }

    // AI summarize transcript into ticket format
    if (transcript) {
      try {
        const summary = await summarizeTranscript(transcript);
        if (summary) {
          title = summary.title || title;
          description = summary.description;
        } else {
          description = transcript.slice(0, 2000);
        }
      } catch {
        description = transcript.slice(0, 2000);
      }
    } else if (loomDescription) {
      description = loomDescription;
      if (method === "none") method = "loom-description";
    }

    return {
      title: title || "Loom Video Request",
      description: description || "See attached Loom video",
      transcript,
      method,
    };
  },
});

// ─── Loom Processing Action (internal — called after ticket creation) ──

export const processLoomUrlInternal = internalAction({
  args: {
    orgId: v.id("organizations"),
    ticketId: v.id("tickets"),
    loomUrl: v.string(),
    syncToGitHub: v.optional(v.boolean()),
    repoFullName: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let transcript = "";
    let title = "";
    let description = "";
    let method = "none";

    // ── Step 1: Fetch page with browser-like headers ──────────
    let html = "";
    try {
      const res = await fetch(args.loomUrl, { headers: BROWSER_HEADERS });
      html = await res.text();
      title = extractTitleFromHTML(html);
    } catch {
      // Network error — continue to fallbacks
    }

    // ── Step 2: Extract transcript from signed CDN URL ───────
    if (html) {
      const transcriptUrl = extractTranscriptUrl(html);
      if (transcriptUrl) {
        try {
          transcript = await fetchTranscriptFromCDN(transcriptUrl);
          if (transcript) method = "apollo-cdn";
        } catch {
          /* CDN fetch failed */
        }
      }
    }

    // ── Step 3: Fallback — use Loom's AI description ─────────
    let loomDescription = "";
    if (html) {
      loomDescription = extractDescriptionFromHTML(html);
    }

    // ── Step 4: Fallback — oEmbed for title + description ────
    if (!title || (!transcript && !loomDescription)) {
      try {
        const oembedRes = await fetch(
          `https://www.loom.com/v1/oembed?url=${encodeURIComponent(args.loomUrl)}`,
        );
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          title = title || oembed.title || "";
          if (!transcript && !loomDescription && oembed.description) {
            loomDescription = oembed.description;
          }
        }
      } catch {
        /* ignore */
      }
    }

    // ── Step 5: Fallback — multimodal transcription via Gemini ─
    if (!transcript && !loomDescription && OPEN_ROUTER) {
      const videoUrl = html ? extractVideoUrlFromHTML(html) : null;
      if (videoUrl) {
        transcript = await transcribeViaOpenRouter(videoUrl);
        if (transcript) method = "gemini-transcribe";
      }
    }

    // ── Step 6: AI summarize transcript ──────────────────────
    if (transcript) {
      try {
        const summary = await summarizeTranscript(transcript);
        if (summary) {
          title = summary.title || title;
          description = summary.description;
        } else {
          description = transcript.slice(0, 2000);
        }
      } catch {
        description = transcript.slice(0, 2000);
      }
    } else if (loomDescription) {
      // Loom already generated a good AI summary — use it directly
      description = loomDescription;
      if (!method || method === "none") method = "loom-description";
    }

    // ── Step 7: Update ticket in DB ──────────────────────────
    const finalTitle = title || "Loom Video Request";
    const finalDescription = description || "See attached Loom video";

    if (title || description || transcript) {
      await ctx.runMutation(internal.tickets.PREAUTH_updateLoomData, {
        ticketId: args.ticketId,
        title: finalTitle,
        description: finalDescription,
        transcript,
      });
    }

    // ── Step 8: Chain into GitHub issue creation ─────────────
    if (args.syncToGitHub && args.repoFullName) {
      const loomLink = `\n\n---\n[Loom Video](${args.loomUrl})`;
      await ctx.runAction(internal.tickets.createGitHubIssueInternal, {
        orgId: args.orgId,
        ticketId: args.ticketId,
        repoFullName: args.repoFullName,
        title: finalTitle,
        body: finalDescription + loomLink,
        labels: ["loom"],
      });
    }

    return {
      title: finalTitle,
      description: finalDescription,
      transcriptLength: transcript.length,
      method,
    };
  },
});

// ─── Internal Queries ──────────────────────────────────────────

import { internalQuery } from "./_generated/server";

export const getRepoByFullName = internalQuery({
  args: {
    orgId: v.id("organizations"),
    repoFullName: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return ctx.db
      .query("githubRepos")
      .withIndex("orgId_repoFullName", (q) =>
        q.eq("orgId", args.orgId).eq("repoFullName", args.repoFullName),
      )
      .first();
  },
});
