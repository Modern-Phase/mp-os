import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import { Id } from "@cvx/_generated/dataModel";
import { Progress } from "@/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Cpu,
  Database,
  Upload,
} from "lucide-react";
import { cn } from "@/utils/misc";

interface ProcessingProgressProps {
  documentId: Id<"documents">;
  className?: string;
  compact?: boolean;
}

const STATUS_CONFIG = {
  queued: {
    icon: Clock,
    label: "Queued",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    animate: false,
  },
  uploading: {
    icon: Upload,
    label: "Uploading",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    animate: true,
  },
  parsing: {
    icon: FileText,
    label: "Parsing PDF",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    animate: true,
  },
  chunking: {
    icon: Cpu,
    label: "Processing",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    animate: true,
  },
  embedding: {
    icon: Database,
    label: "Embedding",
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: "Ready",
    color: "text-green-500",
    bg: "bg-green-500/10",
    animate: false,
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-red-500",
    bg: "bg-red-500/10",
    animate: false,
  },
};

export function ProcessingProgress({
  documentId,
  className,
  compact = false,
}: ProcessingProgressProps) {
  const job = useQuery(api.processingJobs.getJobStatus, { documentId });

  if (!job) return null;

  const statusConfig =
    (STATUS_CONFIG as any)[job.status] || STATUS_CONFIG.queued;
  const StatusIcon = statusConfig.icon;
  const progress = job.progressPercent;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <StatusIcon
          className={cn(
            "h-4 w-4 shrink-0",
            statusConfig.color,
            statusConfig.animate && "animate-spin",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                statusConfig.color,
              )}
            >
              {job.statusMessage || statusConfig.label}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-1 mt-1" />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <StatusIcon
              className={cn(
                "h-4 w-4",
                statusConfig.color,
                statusConfig.animate && "animate-spin",
              )}
            />
            Document Processing
          </span>
          <Badge
            variant="secondary"
            className={cn("text-[10px]", statusConfig.bg, statusConfig.color)}
          >
            {statusConfig.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
            <span>{job.statusMessage}</span>
            <span>{progress}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          {job.totalPages !== undefined && (
            <div>
              <p className="text-muted-foreground">Pages</p>
              <p className="font-medium">
                {job.processedPages} / {job.totalPages || "?"}
              </p>
            </div>
          )}
          {job.totalChunks !== undefined && (
            <div>
              <p className="text-muted-foreground">Chunks</p>
              <p className="font-medium">
                {job.processedChunks} / {job.totalChunks || "?"}
              </p>
            </div>
          )}
        </div>

        {job.errorMessage && (
          <div className="rounded border border-destructive/20 bg-destructive/5 p-2">
            <p className="text-[10px] text-destructive break-words font-medium">
              {job.errorMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
