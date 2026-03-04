// Assign-to-Agent button + status badge for GitHub issues
// Shows "Assign to Agent" when no active job, or a status badge when a job exists

import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import type { AgentJobStatus } from "~/convex/schema";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Bot, Loader2 } from "lucide-react";
import { cn } from "@/utils/misc";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; spinning?: boolean }
> = {
  queued: { label: "Queued", color: "bg-gray-500 text-white" },
  cloning: { label: "Cloning", color: "bg-blue-500 text-white", spinning: true },
  working: { label: "Working", color: "bg-yellow-500 text-white", spinning: true },
  testing: { label: "Testing", color: "bg-purple-500 text-white", spinning: true },
  pr_created: { label: "PR Open", color: "bg-green-500 text-white" },
  revision: { label: "Revising", color: "bg-orange-500 text-white", spinning: true },
  needs_human: { label: "Needs Help", color: "bg-red-500 text-white" },
  merged: { label: "Merged", color: "bg-emerald-600 text-white" },
  closed: { label: "Closed", color: "bg-gray-400 text-white" },
  failed: { label: "Failed", color: "bg-red-600 text-white" },
};

interface AssignToAgentButtonProps {
  orgId: Id<"organizations">;
  issue: {
    number: number;
    title: string;
    url: string;
    body?: string;
  };
  repoFullName: string;
  defaultBranch: string;
  onJobClick?: (jobId: Id<"agentJobs">) => void;
}

export function AssignToAgentButton({
  orgId,
  issue,
  repoFullName,
  defaultBranch,
  onJobClick,
}: AssignToAgentButtonProps) {
  const job = useConvexQuery(api.agentJobs.getJobForIssue, {
    repoFullName,
    githubIssueNumber: issue.number,
  });

  const enqueueJob = useMutation(api.agentJobs.enqueueJob);

  const handleAssign = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await enqueueJob({
        orgId,
        githubIssueUrl: issue.url,
        githubIssueNumber: issue.number,
        githubIssueTitle: issue.title,
        githubIssueBody: issue.body,
        repoFullName,
        defaultBranch,
        triggerMode: "manual",
      });
    } catch (err: any) {
      console.error("Failed to assign agent:", err);
    }
  };

  const handleBadgeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (job?._id && onJobClick) {
      onJobClick(job._id);
    }
  };

  // No job or only terminal old jobs — show assign button
  if (!job || ["merged", "closed", "failed", "needs_human"].includes(job.status)) {
    // For failed/needs_human, still show the badge but also allow re-trigger
    if (job && ["failed", "needs_human"].includes(job.status)) {
      const config = STATUS_CONFIG[job.status];
      return (
        <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
          <Badge
            className={cn("text-[10px] cursor-pointer", config.color)}
            onClick={handleBadgeClick}
          >
            {config.label}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleAssign}
            title="Retry with agent"
          >
            <Bot className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={handleAssign}
        title="Assign to AI Agent"
      >
        <Bot className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Agent</span>
      </Button>
    );
  }

  // Active job — show status badge
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;

  return (
    <Badge
      className={cn("text-[10px] cursor-pointer gap-1", config.color)}
      onClick={handleBadgeClick}
    >
      {config.spinning && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {config.label}
    </Badge>
  );
}
