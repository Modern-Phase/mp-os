// src/routes/_app/_auth/dashboard/_layout.jobs.tsx
// Agent Jobs dashboard — lists all autonomous issue resolution jobs

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import type { AgentJobStatus } from "~/convex/schema";
import { Badge } from "@/ui/badge";
import { Card, CardContent } from "@/ui/card";
import {
  Loader2,
  Bot,
  GitPullRequest,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/utils/misc";
import { AgentJobLogViewer } from "@/components/agents/AgentJobLogViewer";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/jobs",
)({
  component: AgentJobsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Agent Jobs`,
  }),
});

const STATUS_PIPELINE: {
  value: AgentJobStatus | "all";
  label: string;
  color: string;
}[] = [
  { value: "all", label: "All", color: "" },
  { value: "queued", label: "Queued", color: "bg-gray-500" },
  { value: "cloning", label: "Cloning", color: "bg-blue-500" },
  { value: "working", label: "Working", color: "bg-yellow-500" },
  { value: "testing", label: "Testing", color: "bg-purple-500" },
  { value: "pr_created", label: "PR Created", color: "bg-green-500" },
  { value: "revision", label: "Revision", color: "bg-orange-500" },
  { value: "needs_human", label: "Needs Human", color: "bg-red-500" },
  { value: "merged", label: "Merged", color: "bg-emerald-600" },
  { value: "failed", label: "Failed", color: "bg-red-600" },
  { value: "closed", label: "Closed", color: "bg-gray-400" },
];

function AgentJobsPage() {
  const currentUser = useConvexQuery(api.app.getCurrentUser);
  const orgId = currentUser?.memberships?.[0]?.orgId as
    | Id<"organizations">
    | undefined;

  const [statusFilter, setStatusFilter] = useState<AgentJobStatus | "all">(
    "all",
  );
  const [expandedJobId, setExpandedJobId] = useState<Id<"agentJobs"> | null>(
    null,
  );

  const jobs = useConvexQuery(
    api.agentJobs.getJobs,
    orgId
      ? {
          orgId,
          status:
            statusFilter !== "all" ? (statusFilter as AgentJobStatus) : undefined,
        }
      : "skip",
  );

  if (!currentUser || !orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Autonomous GitHub issue resolution by AI agents
        </p>
      </div>

      {/* Pipeline status filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_PIPELINE.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s.color && (
              <div className={cn("h-2 w-2 rounded-full", s.color)} />
            )}
            {s.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {!jobs ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <Bot className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {statusFilter !== "all"
              ? `No ${statusFilter} jobs`
              : 'No agent jobs yet. Assign issues to an agent from the Tickets page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job: any) => {
            const isExpanded = expandedJobId === job._id;
            const statusConfig = STATUS_PIPELINE.find(
              (s) => s.value === job.status,
            );
            const isActive = ![
              "merged",
              "closed",
              "failed",
              "needs_human",
            ].includes(job.status);

            return (
              <Card key={job._id} className="overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedJobId(isExpanded ? null : job._id)
                  }
                  className="w-full text-left"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Expand arrow */}
                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>

                      {/* Status badge */}
                      <Badge
                        className={cn(
                          "text-[10px] shrink-0 text-white",
                          statusConfig?.color || "bg-gray-500",
                        )}
                      >
                        {isActive && (
                          <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                        )}
                        {statusConfig?.label || job.status}
                      </Badge>

                      {/* Title */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {job.githubIssueTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {job.repoFullName} #{job.githubIssueNumber} &middot;{" "}
                          {job.branch}
                        </p>
                      </div>

                      {/* PR link */}
                      {job.prUrl && (
                        <a
                          href={job.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 shrink-0"
                        >
                          <GitPullRequest className="h-3.5 w-3.5" />
                          PR #{job.prNumber}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}

                      {/* Trigger mode */}
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                      >
                        {job.triggerMode}
                      </Badge>

                      {/* Timestamp */}
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.startedAt
                          ? relativeTime(job.startedAt)
                          : relativeTime(job._creationTime)}
                      </span>
                    </div>
                  </CardContent>
                </button>

                {/* Expanded log viewer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border">
                    <div className="pt-4">
                      <AgentJobLogViewer jobId={job._id} />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
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
