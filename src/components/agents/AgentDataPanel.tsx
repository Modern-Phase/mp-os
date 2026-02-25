// src/components/agents/AgentDataPanel.tsx
// Sync controls and status for agent data (files, sessions, memories)

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { RefreshCw, Loader2, FolderOpen, MessageSquare } from "lucide-react";

interface AgentDataPanelProps {
  agentId: string;
  orgId: Id<"organizations">;
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AgentDataPanel({ agentId, orgId }: AgentDataPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncAgentData = useAction(api.agentSync.syncAgentData);
  const syncStatus = useQuery(api.agentSync.getSyncStatus, { orgId, agentId });

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAgentData({ agentId, orgId: String(orgId) });
      const msg = `Synced ${result.files} files, ${result.sessions} sessions`;
      setSyncResult(result.errors.length > 0 ? `${msg} (${result.errors.length} errors)` : msg);
    } catch (err) {
      setSyncResult(`Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Data Sync</h4>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Sync Now
        </Button>
      </div>

      {syncResult && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
          {syncResult}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5" />
          <span>{syncStatus?.fileCount ?? 0} files</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{syncStatus?.sessionCount ?? 0} sessions</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] font-normal">
            {formatRelativeTime(syncStatus?.lastSyncedAt ?? null)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
