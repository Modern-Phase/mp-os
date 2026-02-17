import { useState, useEffect, useCallback } from "react"
import { useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { cn } from "@/utils/misc"

export function VpsConnectionStatus() {
  const checkConnection = useAction(api.vpsOrchestrator.checkConnection)
  const [status, setStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking")
  const [instanceCount, setInstanceCount] = useState(0)

  const check = useCallback(async () => {
    try {
      const result = await checkConnection()
      setStatus(result.connected ? "connected" : "disconnected")
      if (result.instanceCount) setInstanceCount(result.instanceCount)
    } catch {
      setStatus("disconnected")
    }
  }, [checkConnection])

  useEffect(() => {
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [check])

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          status === "connected" && "bg-green-500",
          status === "disconnected" && "bg-red-500",
          status === "checking" && "bg-yellow-500 animate-pulse",
        )}
      />
      <span className="text-muted-foreground">
        {status === "connected"
          ? `VPS Connected${instanceCount > 0 ? ` (${instanceCount})` : ""}`
          : status === "disconnected"
            ? "VPS Disconnected"
            : "Checking..."}
      </span>
    </div>
  )
}
