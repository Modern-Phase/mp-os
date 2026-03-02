// src/components/agents/CallHistory.tsx
// Shows recent voice call history for the organization

import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { ScrollArea } from "@/ui/scroll-area";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";

interface CallHistoryProps {
  orgId: Id<"organizations">;
  limit?: number;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.round(diffMs / (1000 * 60));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.round(diffHours)}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CallHistory({ orgId, limit = 10 }: CallHistoryProps) {
  const calls = useQuery(api.retellCalls.getCallsByOrg, { orgId, limit });

  if (!calls || calls.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6">
        <Phone className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No call history yet
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-80">
      <div className="space-y-2">
        {calls.map((call) => (
          <div
            key={call._id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="mt-0.5">
              {call.direction === "inbound" ? (
                <PhoneIncoming className="w-4 h-4 text-blue-500" />
              ) : (
                <PhoneOutgoing className="w-4 h-4 text-emerald-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {call.direction === "inbound" ? "Inbound" : "Outbound"} Call
                </span>
                {call.agentId && (
                  <span className="text-xs text-muted-foreground">
                    — {call.agentId}
                  </span>
                )}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  call.status === "ended"
                    ? "bg-muted text-muted-foreground"
                    : call.status === "ongoing"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : call.status === "error"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-blue-500/10 text-blue-600"
                }`}>
                  {call.status}
                </span>
              </div>

              {call.summary && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {call.summary}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {call.durationMs && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(call.durationMs)}
                  </span>
                )}
                <span>{formatTimestamp(call._creationTime)}</span>
                {call.sentiment && (
                  <span className="capitalize">{call.sentiment}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
