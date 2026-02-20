import { useQuery as useConvexQuery } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Progress } from "@/ui/progress";
import { ScrollArea } from "@/ui/scroll-area";
import { cn } from "@/utils/misc";
import {
  Activity,
  Cpu,
  Clock,
  MessageSquare,
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Timer,
  ListChecks,
  Zap,
} from "lucide-react";

interface AgentDef {
  agentId: string;
  name: string;
  emoji: string;
  color: string;
  role: string;
}

interface AgentHealthDashboardProps {
  agent: AgentDef;
  orgId: Id<"organizations">;
}

function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ========== INFRA STATUS CARD ==========

function InfraStatusCard({
  infra,
}: {
  infra: NonNullable<ReturnType<typeof useConvexQuery<typeof api.agentHealth.getAgentInfraHealth>>>;
}) {
  if (!infra) return null;

  const statusConfig = {
    healthy: { label: "Healthy", color: "bg-green-500/10 text-green-700 dark:text-green-400", dot: "bg-green-500" },
    degraded: { label: "Degraded", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
    critical: { label: "Critical", color: "bg-red-500/10 text-red-700 dark:text-red-400", dot: "bg-red-500" },
    offline: { label: "Offline", color: "bg-gray-500/10 text-gray-700 dark:text-gray-400", dot: "bg-gray-400" },
  };
  const cfg = statusConfig[infra.status];

  const syncFreshColor =
    infra.syncFreshness !== null
      ? infra.syncFreshness < 30_000
        ? "text-green-600 dark:text-green-400"
        : infra.syncFreshness < 60_000
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  const memoryPercent = infra.memoryUsageMb > 0 ? Math.min((infra.memoryUsageMb / 512) * 100, 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Infrastructure
          </CardTitle>
          <Badge className={cn("text-xs", cfg.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", cfg.dot)} />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Systemd State */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" />
            Systemd
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                infra.systemdState === "active" ? "bg-green-500" : "bg-red-500",
              )}
            />
            {infra.systemdState}
          </span>
        </div>

        {/* Gateway */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            {infra.gatewayReachable ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            Gateway
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                infra.gatewayReachable ? "bg-green-500" : "bg-red-500",
              )}
            />
            {infra.gatewayReachable ? "Reachable" : "Unreachable"}
            {infra.gatewayPort && (
              <span className="text-xs text-muted-foreground">:{infra.gatewayPort}</span>
            )}
          </span>
        </div>

        {/* Memory Usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" />
              Memory
            </span>
            <span>{infra.memoryUsageMb}MB / 512MB</span>
          </div>
          <Progress value={memoryPercent} className="h-1.5" />
        </div>

        {/* Uptime */}
        {infra.uptime && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Uptime
            </span>
            <span>{infra.uptime}</span>
          </div>
        )}

        {/* Last Sync */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            <Timer className="w-3.5 h-3.5" />
            Last Sync
          </span>
          <span className={syncFreshColor}>
            {infra.lastSyncedAt
              ? formatRelativeTime(Date.now() - infra.lastSyncedAt)
              : "Never"}
          </span>
        </div>

        {/* PID */}
        {infra.pid && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              PID
            </span>
            <span className="font-mono text-xs">{infra.pid}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ========== METRIC CARD ==========

function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  suffix?: string;
  color: "green" | "yellow" | "red" | "neutral";
}) {
  const colorClasses = {
    green: "text-green-600 dark:text-green-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    red: "text-red-600 dark:text-red-400",
    neutral: "text-foreground",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={cn("text-2xl font-bold", colorClasses[color])}>
          {value}
          {suffix && <span className="text-sm font-normal ml-0.5">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ========== MAIN COMPONENT ==========

export function AgentHealthDashboard({ agent, orgId }: AgentHealthDashboardProps) {
  const infra = useConvexQuery(api.agentHealth.getAgentInfraHealth, {
    agentId: agent.agentId,
  });

  const ops = useConvexQuery(api.agentHealth.getAgentOperationalHealth, {
    orgId,
    agentId: agent.agentId,
  });

  if (!infra || !ops) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Activity className="w-5 h-5 animate-pulse mr-2" />
        Loading health data...
      </div>
    );
  }

  const successColor: "green" | "yellow" | "red" =
    ops.successRate >= 95 ? "green" : ops.successRate >= 80 ? "yellow" : "red";
  const latencyColor: "green" | "yellow" | "red" =
    ops.avgLatencyMs < 5000 ? "green" : ops.avgLatencyMs < 15000 ? "yellow" : "red";
  const taskColor: "green" | "yellow" | "red" =
    ops.taskCompletionRate >= 70 ? "green" : ops.taskCompletionRate >= 40 ? "yellow" : "red";

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 pb-6 pr-4">
        {/* Infrastructure Status */}
        <InfraStatusCard infra={infra} />

        {/* Operational Metrics Grid */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Operational Metrics
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={CheckCircle2}
              label="Success Rate"
              value={ops.successRate}
              suffix="%"
              color={successColor}
            />
            <MetricCard
              icon={Timer}
              label="Avg Latency"
              value={formatLatency(ops.avgLatencyMs)}
              color={latencyColor}
            />
            <MetricCard
              icon={MessageSquare}
              label="Messages (1h)"
              value={ops.messagesLastHour}
              color="neutral"
            />
            <MetricCard
              icon={Activity}
              label="Active Sessions"
              value={ops.activeSessionCount}
              color="neutral"
            />
            <MetricCard
              icon={Brain}
              label="Memories"
              value={ops.memoryCount}
              color="neutral"
            />
            <MetricCard
              icon={ListChecks}
              label="Task Completion"
              value={ops.taskCompletionRate}
              suffix="%"
              color={ops.totalTasks > 0 ? taskColor : "neutral"}
            />
          </div>
        </div>

        {/* Recent Errors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Recent Errors
              {ops.failedCount > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-auto">
                  {ops.failedCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ops.recentErrors.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-2">
                <CheckCircle2 className="w-4 h-4" />
                No recent errors
              </div>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {ops.recentErrors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(Date.now() - err.timestamp)}
                          {err.attempts > 1 && ` (${err.attempts} attempts)`}
                        </p>
                        <p className="text-xs truncate">{err.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
