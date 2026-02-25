// src/components/agents/ToolCallDisplay.tsx
// Collapsible tool call display within agent chat messages

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Badge } from "@/ui/badge";
import { cn } from "@/utils/misc";
import { ChevronRight, Wrench, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ToolCallDisplayProps {
  messageId: Id<"agentChatMessages">;
  runId?: string;
}

interface ToolCall {
  _id: string;
  toolName: string;
  toolInput: string;
  toolResult?: string;
  status: "pending" | "success" | "error";
  duration?: number;
  startedAt: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateJson(json: string, maxLen = 200): string {
  if (json.length <= maxLen) return json;
  return json.slice(0, maxLen) + "...";
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  let inputSummary = "";
  try {
    const parsed = JSON.parse(tc.toolInput);
    // Show a concise summary of the input
    if (parsed.path) inputSummary = parsed.path;
    else if (parsed.command) inputSummary = parsed.command;
    else if (parsed.query) inputSummary = parsed.query;
    else if (parsed.url) inputSummary = parsed.url;
    else inputSummary = truncateJson(tc.toolInput, 80);
  } catch {
    inputSummary = truncateJson(tc.toolInput, 80);
  }

  const statusIcon =
    tc.status === "pending" ? (
      <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
    ) : tc.status === "success" ? (
      <CheckCircle2 className="h-3 w-3 text-green-500" />
    ) : (
      <XCircle className="h-3 w-3 text-red-500" />
    );

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-90",
          )}
        />
        {statusIcon}
        <span className="text-xs font-medium text-foreground">{tc.toolName}</span>
        {inputSummary && (
          <span className="text-xs text-muted-foreground truncate">{inputSummary}</span>
        )}
        {tc.duration != null && (
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {formatDuration(tc.duration)}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2 bg-muted/20">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground font-medium">Input</span>
            <pre className="text-xs text-foreground/80 mt-0.5 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(tc.toolInput), null, 2);
                } catch {
                  return tc.toolInput;
                }
              })()}
            </pre>
          </div>
          {tc.toolResult && (
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-medium">Result</span>
              <pre className="text-xs text-foreground/80 mt-0.5 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(tc.toolResult), null, 2);
                  } catch {
                    return tc.toolResult;
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallDisplay({ messageId, runId }: ToolCallDisplayProps) {
  const [showAll, setShowAll] = useState(false);

  // Query by messageId (preferred) or fallback to runId
  const toolCallsByMsg = useQuery(
    api.agentChat.getToolCallsByMessageId,
    { messageId },
  );
  const toolCallsByRun = useQuery(
    api.agentChat.getToolCallsByRunId,
    runId ? { runId } : "skip",
  );

  const toolCalls = (toolCallsByMsg?.length ? toolCallsByMsg : toolCallsByRun) as ToolCall[] | undefined;

  if (!toolCalls || toolCalls.length === 0) return null;

  const displayCalls = showAll ? toolCalls : toolCalls.slice(0, 3);
  const hasMore = toolCalls.length > 3;

  return (
    <div className="mt-2 space-y-1">
      <button
        onClick={() => setShowAll(!showAll)}
        className="flex items-center gap-1.5"
      >
        <Badge variant="outline" className="gap-1 text-[10px] font-normal cursor-pointer hover:bg-muted">
          <Wrench className="h-3 w-3" />
          {toolCalls.length} tool call{toolCalls.length > 1 ? "s" : ""}
        </Badge>
      </button>

      {(showAll || toolCalls.length <= 3) && (
        <div className="space-y-1 ml-1">
          {displayCalls.map((tc) => (
            <ToolCallItem key={tc._id} tc={tc} />
          ))}
          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              +{toolCalls.length - 3} more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
