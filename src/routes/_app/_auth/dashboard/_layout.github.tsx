import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation, useAction } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import {
  Loader2,
  GitBranch,
  GitCommit,
  GitPullRequest,
  CircleDot,
  Plus,
  Trash2,
  ExternalLink,
  Lock,
  Globe,
  Link2,
  Unlink,
  Star,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/utils/misc";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/github",
)({
  component: GitHubPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - GitHub`,
  }),
});

type Tab = "commits" | "pulls" | "issues";

function GitHubPage() {
  const currentUser = useConvexQuery(api.app.getCurrentUser);
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<"organizations"> | undefined;

  const connection = useConvexQuery(api.github.getConnection, orgId ? { orgId } : "skip");
  const trackedRepos = useConvexQuery(api.github.getTrackedRepos, orgId ? { orgId } : "skip");

  const connectGitHub = useMutation(api.github.connectGitHub);
  const disconnectGitHub = useMutation(api.github.disconnectGitHub);
  const addTrackedRepo = useMutation(api.github.addTrackedRepo);
  const removeTrackedRepo = useMutation(api.github.removeTrackedRepo);

  const listUserRepos = useAction(api.github.listUserRepos);
  const getRepoCommits = useAction(api.github.getRepoCommits);
  const getRepoPullRequests = useAction(api.github.getRepoPullRequests);
  const getRepoIssues = useAction(api.github.getRepoIssues);

  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browseRepos, setBrowseRepos] = useState<any>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("commits");
  const [tabData, setTabData] = useState<any>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = connection?.status === "active";

  const handleConnect = async () => {
    if (!orgId || !token.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      await connectGitHub({ orgId, token: token.trim() });
      setToken("");
    } catch (err: any) {
      setError(err.message || "Failed to connect");
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!orgId) return;
    try {
      await disconnectGitHub({ orgId });
      setBrowseRepos(null);
      setSelectedRepo(null);
      setTabData(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBrowseRepos = async () => {
    if (!orgId) return;
    setBrowsing(true);
    setError(null);
    try {
      const repos = await listUserRepos({ orgId });
      setBrowseRepos(repos);
    } catch (err: any) {
      setError(err.message || "Failed to fetch repos");
    }
    setBrowsing(false);
  };

  const handleTrackRepo = async (repo: any) => {
    if (!orgId) return;
    try {
      await addTrackedRepo({
        orgId,
        repoFullName: repo.fullName,
        repoUrl: repo.url,
        description: repo.description || undefined,
        defaultBranch: repo.defaultBranch || "main",
        isPrivate: repo.isPrivate,
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveRepo = async (repoId: Id<"githubRepos">) => {
    if (!orgId) return;
    try {
      await removeTrackedRepo({ orgId, repoId });
      if (selectedRepo) {
        const repo = trackedRepos?.find((r: any) => r._id === repoId);
        if (repo && repo.repoFullName === selectedRepo) {
          setSelectedRepo(null);
          setTabData(null);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSelectRepo = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setActiveTab("commits");
    await loadTabData(repoFullName, "commits");
  };

  const loadTabData = async (repoFullName: string, tab: Tab) => {
    if (!orgId) return;
    setTabLoading(true);
    setTabData(null);
    try {
      let data;
      if (tab === "commits") {
        data = await getRepoCommits({ orgId, repoFullName });
      } else if (tab === "pulls") {
        data = await getRepoPullRequests({ orgId, repoFullName });
      } else {
        data = await getRepoIssues({ orgId, repoFullName });
      }
      setTabData(data);
    } catch (err: any) {
      setError(err.message);
    }
    setTabLoading(false);
  };

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab);
    if (selectedRepo) await loadTabData(selectedRepo, tab);
  };

  const isRepoTracked = (fullName: string) =>
    trackedRepos?.some((r: any) => r.repoFullName === fullName) ?? false;

  // ─── Not connected ─────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">GitHub</h1>
          <p className="text-sm text-muted-foreground">Connect your GitHub account to browse repos, commits, PRs, and issues</p>
        </div>

        <div className="max-w-lg border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-medium">Connect GitHub</h3>
              <p className="text-sm text-muted-foreground">Enter a Personal Access Token with <code>repo</code> scope</p>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            <div className="flex items-center gap-2">
              <Button onClick={handleConnect} disabled={connecting || !token.trim()}>
                {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Connect
              </Button>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=MP+OS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Create token <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Connected — main layout ───────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex items-center justify-between shrink-0 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">GitHub</h1>
          <p className="text-sm text-muted-foreground">
            Connected {connection?.connectedAt ? `on ${new Date(connection.connectedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleBrowseRepos} disabled={browsing}>
            {browsing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add Repo
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            <Unlink className="h-4 w-4 mr-1" /> Disconnect
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300 shrink-0 mb-4">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* Repo browser modal */}
      {browseRepos && (
        <div className="shrink-0 mb-4">
          <RepoBrowser
            repos={browseRepos}
            isTracked={isRepoTracked}
            onTrack={handleTrackRepo}
            onClose={() => setBrowseRepos(null)}
          />
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar — tracked repos */}
        <div className="w-64 shrink-0 border border-border rounded-lg p-3 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 pb-2">
            Tracked Repos ({trackedRepos?.length || 0})
          </p>
          {trackedRepos?.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-4">
              No repos tracked yet. Click "Add Repo" to browse your GitHub repos.
            </p>
          )}
          {trackedRepos?.map((repo: any) => (
            <div
              key={repo._id}
              className={cn(
                "group flex items-center justify-between rounded-md px-2 py-2 text-sm cursor-pointer transition-colors",
                selectedRepo === repo.repoFullName
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
              onClick={() => handleSelectRepo(repo.repoFullName)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {repo.isPrivate ? (
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{repo.repoFullName.split("/")[1]}</span>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveRepo(repo._id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Main content — repo detail */}
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          {!selectedRepo ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center space-y-2">
                <GitBranch className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-sm">Select a tracked repo to view activity</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Repo header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedRepo}</span>
                  <a
                    href={`https://github.com/${selectedRepo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b">
                {(
                  [
                    { key: "commits", label: "Commits", icon: GitCommit },
                    { key: "pulls", label: "Pull Requests", icon: GitPullRequest },
                    { key: "issues", label: "Issues", icon: CircleDot },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                      activeTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {tabLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !tabData ? (
                  <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                    No data loaded
                  </div>
                ) : activeTab === "commits" ? (
                  <CommitList commits={tabData} />
                ) : activeTab === "pulls" ? (
                  <PullRequestList prs={tabData} />
                ) : (
                  <IssueList issues={tabData} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Repo Browser ──────────────────────────────────────────────

function RepoBrowser({
  repos,
  isTracked,
  onTrack,
  onClose,
}: {
  repos: { personal: any[]; organizations: Record<string, any[]> };
  isTracked: (fullName: string) => boolean;
  onTrack: (repo: any) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filterRepos = (list: any[]) =>
    list.filter(
      (r) =>
        r.fullName.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()),
    );

  const personalFiltered = filterRepos(repos.personal);
  const orgEntries = Object.entries(repos.organizations)
    .map(([org, list]) => [org, filterRepos(list)] as const)
    .filter(([, list]) => list.length > 0);

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Browse Repos</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <Input
        placeholder="Search repos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-80 overflow-y-auto space-y-4">
        {personalFiltered.length > 0 && (
          <RepoGroup label="Personal" repos={personalFiltered} isTracked={isTracked} onTrack={onTrack} />
        )}
        {orgEntries.map(([org, list]) => (
          <RepoGroup key={org} label={org} repos={list} isTracked={isTracked} onTrack={onTrack} />
        ))}
        {personalFiltered.length === 0 && orgEntries.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No repos match your search</p>
        )}
      </div>
    </div>
  );
}

function RepoGroup({
  label,
  repos,
  isTracked,
  onTrack,
}: {
  label: string;
  repos: any[];
  isTracked: (fullName: string) => boolean;
  onTrack: (repo: any) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">{label}</p>
      <div className="space-y-1">
        {repos.map((repo) => {
          const tracked = isTracked(repo.fullName);
          return (
            <div
              key={repo.fullName}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {repo.isPrivate ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate font-medium">{repo.name}</span>
                {repo.language && (
                  <span className="text-xs text-muted-foreground">{repo.language}</span>
                )}
                {repo.stargazersCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" /> {repo.stargazersCount}
                  </span>
                )}
              </div>
              {repo.description && (
                <span className="text-xs text-muted-foreground max-w-xs truncate mx-2 hidden md:block">
                  {repo.description}
                </span>
              )}
              <Button
                variant={tracked ? "secondary" : "outline"}
                size="sm"
                disabled={tracked}
                onClick={() => onTrack(repo)}
                className="shrink-0"
              >
                {tracked ? "Tracked" : "Track"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Commit List ───────────────────────────────────────────────

function CommitList({ commits }: { commits: any[] }) {
  if (!commits.length) {
    return <p className="text-sm text-muted-foreground p-4">No commits found</p>;
  }
  return (
    <div className="divide-y">
      {commits.map((c) => (
        <a
          key={c.sha}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          {c.authorAvatar ? (
            <img src={c.authorAvatar} alt="" className="h-6 w-6 rounded-full mt-0.5" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs mt-0.5">
              {(c.authorLogin || c.authorName || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{c.message.split("\n")[0]}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{c.authorLogin || c.authorName}</span>
              <span className="font-mono">{c.sha.slice(0, 7)}</span>
              <span>{relativeTime(c.date)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Pull Request List ─────────────────────────────────────────

function PullRequestList({ prs }: { prs: any[] }) {
  if (!prs.length) {
    return <p className="text-sm text-muted-foreground p-4">No pull requests found</p>;
  }
  return (
    <div className="divide-y">
      {prs.map((pr) => (
        <a
          key={pr.number}
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <GitPullRequest
            className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              pr.state === "open" ? "text-green-600" : "text-purple-600",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{pr.title}</span>
              {pr.draft && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Draft
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {pr.labels?.map((l: any) => (
                <Badge
                  key={l.name}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    borderColor: `#${l.color}`,
                    color: `#${l.color}`,
                  }}
                >
                  {l.name}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>#{pr.number}</span>
              <span>{pr.authorLogin}</span>
              <span>{relativeTime(pr.createdAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Issue List ────────────────────────────────────────────────

function IssueList({ issues }: { issues: any[] }) {
  if (!issues.length) {
    return <p className="text-sm text-muted-foreground p-4">No issues found</p>;
  }
  return (
    <div className="divide-y">
      {issues.map((issue) => (
        <a
          key={issue.number}
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <CircleDot
            className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              issue.state === "open" ? "text-green-600" : "text-red-600",
            )}
          />
          <div className="min-w-0 flex-1">
            <span className="text-sm font-medium">{issue.title}</span>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {issue.labels?.map((l: any) => (
                <Badge
                  key={l.name}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    borderColor: `#${l.color}`,
                    color: `#${l.color}`,
                  }}
                >
                  {l.name}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>#{issue.number}</span>
              <span>{issue.authorLogin}</span>
              {issue.assignees?.length > 0 && (
                <span className="flex items-center gap-1">
                  {issue.assignees.map((a: any) => (
                    <img
                      key={a.login}
                      src={a.avatar}
                      alt={a.login}
                      title={a.login}
                      className="h-4 w-4 rounded-full"
                    />
                  ))}
                </span>
              )}
              {issue.comments > 0 && (
                <span className="flex items-center gap-0.5">
                  <MessageSquare className="h-3 w-3" /> {issue.comments}
                </span>
              )}
              <span>{relativeTime(issue.createdAt)}</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(dateStr: string) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
