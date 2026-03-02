// src/components/agents/CallStatusBanner.tsx
// Reactive banner showing active voice call status

import { useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Loader2, Phone, PhoneCall, PhoneIncoming, PhoneOff, AlertCircle } from "lucide-react";

interface CallStatusBannerProps {
  orgId: Id<"organizations">;
  agentId?: string;
}

export function CallStatusBanner({ orgId, agentId }: CallStatusBannerProps) {
  const activeCall = useQuery(api.retellCalls.getActiveCall, { orgId, agentId });

  if (!activeCall) return null;

  const { status } = activeCall;

  if (status === "initiating") {
    return (
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border-b border-blue-500/20">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm font-medium text-blue-500">Connecting call...</span>
      </div>
    );
  }

  if (status === "registered") {
    return (
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
        <Phone className="h-4 w-4 text-amber-500 animate-pulse" />
        <span className="text-sm font-medium text-amber-500">Dialing...</span>
      </div>
    );
  }

  if (status === "ongoing") {
    const isInbound = (activeCall as any).direction === "inbound";
    return (
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
        {isInbound ? (
          <PhoneIncoming className="h-4 w-4 text-emerald-500" />
        ) : (
          <PhoneCall className="h-4 w-4 text-emerald-500" />
        )}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-emerald-500">
          {isInbound ? "Inbound call in progress" : "Call in progress"}
        </span>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-muted/50 border-b border-border">
        <PhoneOff className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-muted-foreground">Call ended</span>
          {activeCall.durationMs && (
            <span className="text-xs text-muted-foreground ml-2">
              ({Math.round(activeCall.durationMs / 1000)}s)
            </span>
          )}
          {activeCall.transcript && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {activeCall.transcript.slice(0, 120)}...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-destructive/10 border-b border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm font-medium text-destructive">
          Call failed: {activeCall.errorMessage || "Unknown error"}
        </span>
      </div>
    );
  }

  return null;
}
