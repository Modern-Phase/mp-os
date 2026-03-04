// Agent Job Log Viewer — reactive log display with actions
// Shows timestamped log entries, PR link, retry/cancel buttons

import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import type { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import {
  ExternalLink,
  RotateCcw,
  XCircle,
  Clock,
  GitPullRequest,
  AlertTriangle,
  Info,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/utils/misc";

const LEVEL_STYLES: Record<string, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "text-muted-foreground" },
  warn: { icon: AlertTriangle, color: "text-yellow-500" },
  error: { icon: AlertCircle, color: "text-red-500" },
};

interface AgentJobLogViewerProps {
  jobId: Id<"agentJobs">;
}

export function AgentJobLogViewer({ jobId }: AgentJobLogViewerProps) {
  const job = useConvexQuery(api.agentJobs.getJob, { jobId });
  const cancelJob = useMutation(api.agentJobs.cancelJob);
  const retryJob = useMutation(api.agentJobs.retryJob);

  if (!job) return null;

  const canCancel = !["merged", "closed", "failed", "needs_human"].includes(
    job.status,
  );
  const canRetry = job.status === "failed" || job.status === "needs_human";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {job.githubIssueTitle}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{job.repoFullName}</span>
            <span>#{job.githubIssueNumber}</span>
            <span>branch: {job.branch}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => retryJob({ jobId })}
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs text-red-500 hover:text-red-600"
              onClick={() => cancelJob({ jobId })}
            >
              <XCircle className="h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* PR Link */}
      {job.prUrl && (
        <a
          href={job.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <GitPullRequest className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-foreground">
            PR #{job.prNumber}
          </span>
          <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
        </a>
      )}

      {/* Error message */}
      {job.errorMessage && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900">
          <p className="text-xs text-red-700 dark:text-red-300 font-mono">
            {job.errorMessage}
          </p>
        </div>
      )}

      {/* Attempts */}
      {job.attempts > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RotateCcw className="h-3 w-3" />
          Attempts: {job.attempts}/{job.maxAttempts}
        </div>
      )}

      {/* Token usage */}
      {job.tokenUsage && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Tokens: {job.tokenUsage.inputTokens.toLocaleString()} in /{" "}
            {job.tokenUsage.outputTokens.toLocaleString()} out
          </span>
          {job.tokenUsage.totalCost != null && (
            <span>Cost: ${job.tokenUsage.totalCost.toFixed(4)}</span>
          )}
        </div>
      )}

      {/* Log entries */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Activity Log
        </p>
        <div className="max-h-64 overflow-y-auto space-y-0.5 rounded-lg border border-border p-2 bg-muted/20">
          {(job.logs || []).length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2 text-center">
              No log entries yet
            </p>
          ) : (
            (job.logs || []).map(
              (
                log: { timestamp: number; level: string; message: string },
                i: number,
              ) => {
                const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
                const Icon = style.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 py-1 text-xs"
                  >
                    <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", style.color)} />
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={cn("min-w-0", style.color)}>
                      {log.message}
                    </span>
                  </div>
                );
              },
            )
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        {job.startedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Started: {new Date(job.startedAt).toLocaleString()}
          </span>
        )}
        {job.completedAt && (
          <span>Completed: {new Date(job.completedAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
