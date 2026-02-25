import { useState } from "react"
import { useAction, useQuery as useConvexQuery } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Id } from "~/convex/_generated/dataModel"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog"
import { cn } from "@/utils/misc"
import { Play, Square, RotateCcw, Loader2, Trash2 } from "lucide-react"

interface VpsInstance {
  agentId: string
  serviceUnit: string
  systemdState: string
  gatewayPort: number
  gatewayReachable: boolean
  pid?: number
  uptime?: string
  lastStarted?: string
  memoryUsage?: number
}

interface AgentDef {
  agentId: string
  name: string
  role: string
  emoji: string
  color: string
  department: string
  expertise: string[]
}

interface InstanceCardProps {
  agent: AgentDef
  vpsInstance?: VpsInstance
  isSelected: boolean
  onClick: () => void
  onRefresh?: () => void
  orgId?: Id<"organizations">
}

export function InstanceCard({
  agent,
  vpsInstance,
  isSelected,
  onClick,
  onRefresh,
  orgId,
}: InstanceCardProps) {
  const controlInstance = useAction(api.vpsOrchestrator.controlInstance)
  const deleteInstance = useAction(api.vpsOrchestrator.deleteInstance)
  const [loading, setLoading] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const healthScore = useConvexQuery(
    api.agentHealth.getAgentHealthScore,
    orgId ? { orgId, agentId: agent.agentId } : "skip",
  )

  const status = vpsInstance?.systemdState || "unknown"
  const isRunning = status === "active"
  const gatewayOk = vpsInstance?.gatewayReachable || false

  const statusColor =
    isRunning && gatewayOk
      ? "bg-green-500"
      : isRunning
        ? "bg-yellow-500"
        : status === "failed"
          ? "bg-red-500"
          : "bg-gray-400"

  const statusLabel =
    isRunning && gatewayOk
      ? "Online"
      : isRunning
        ? "Starting"
        : status === "failed"
          ? "Failed"
          : status === "inactive"
            ? "Stopped"
            : status

  const handleControl = async (command: "start" | "stop" | "restart") => {
    setLoading(command)
    try {
      await controlInstance({ instanceId: agent.agentId, command })
      onRefresh?.()
    } catch (err) {
      console.error(`Failed to ${command}:`, err)
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteInstance({ instanceId: agent.agentId, orgId: orgId ? String(orgId) : undefined })
      onRefresh?.()
      setShowDeleteDialog(false)
    } catch (err) {
      console.error("Failed to delete instance:", err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ backgroundColor: `${agent.color}20` }}
            >
              {agent.emoji}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">{agent.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", statusColor)} />
            <span className="text-[10px] text-muted-foreground">
              {statusLabel}
            </span>
          </div>
        </div>

        {vpsInstance && (
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="outline" className="text-[10px]">
              :{vpsInstance.gatewayPort}
            </Badge>
            {vpsInstance.uptime && (
              <Badge variant="outline" className="text-[10px]">
                {vpsInstance.uptime}
              </Badge>
            )}
            {vpsInstance.memoryUsage && (
              <Badge variant="outline" className="text-[10px]">
                {Math.round(vpsInstance.memoryUsage / 1024 / 1024)}MB
              </Badge>
            )}
            {healthScore && (
              <Badge
                className={cn(
                  "text-[10px]",
                  healthScore.label === "healthy"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : healthScore.label === "degraded"
                      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                      : healthScore.label === "critical"
                        ? "bg-red-500/10 text-red-700 dark:text-red-400"
                        : "bg-gray-500/10 text-gray-700 dark:text-gray-400",
                )}
              >
                {healthScore.score}%
              </Badge>
            )}
          </div>
        )}

        <div
          className="mt-3 flex gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {!isRunning ? (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] gap-1"
              disabled={!!loading}
              onClick={() => handleControl("start")}
            >
              {loading === "start" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Start
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1"
                disabled={!!loading}
                onClick={() => handleControl("restart")}
              >
                {loading === "restart" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                Restart
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] gap-1 text-red-500 hover:text-red-600"
                disabled={!!loading}
                onClick={() => handleControl("stop")}
              >
                {loading === "stop" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Square className="w-3 h-3" />
                )}
                Stop
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1 text-red-500 hover:text-red-600 ml-auto"
            disabled={!!loading || isRunning}
            onClick={() => setShowDeleteDialog(true)}
            title={isRunning ? "Stop the agent before deleting" : "Delete instance"}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Delete confirmation dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {agent.name}?</DialogTitle>
              <DialogDescription>
                This will remove the agent instance and all VPS data. Sessions, chat history,
                and workspace files on the server will be permanently deleted. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
