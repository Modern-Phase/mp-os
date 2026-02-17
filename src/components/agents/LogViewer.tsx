import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { ScrollArea } from "@/ui/scroll-area"
import { Pause, Play, Trash2 } from "lucide-react"

interface LogEntry {
  timestamp: string
  message: string
  priority?: string
}

interface LogViewerProps {
  instanceId: string
  agentName: string
  vpsUrl: string
  apiKey: string
}

export function LogViewer({
  instanceId,
  agentName,
  vpsUrl,
  apiKey,
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    pausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    if (!vpsUrl || !apiKey) return

    const url = `${vpsUrl}/api/instances/${instanceId}/logs?lines=100&apiKey=${encodeURIComponent(apiKey)}`

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.addEventListener("log", (event) => {
      if (pausedRef.current) return
      try {
        const data = JSON.parse(event.data) as LogEntry
        setLogs((prev) => [...prev.slice(-500), data])
      } catch {
        // Skip malformed entries
      }
    })

    eventSource.onopen = () => setIsConnected(true)
    eventSource.onerror = () => setIsConnected(false)

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [instanceId, vpsUrl, apiKey])

  // Auto-scroll
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isPaused])

  const priorityColor = (p?: string) => {
    switch (p) {
      case "3":
        return "text-red-400"
      case "4":
        return "text-yellow-400"
      case "6":
        return "text-blue-400"
      default:
        return "text-green-400"
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">
            Logs — {agentName}
          </CardTitle>
          <Badge
            variant={isConnected ? "default" : "outline"}
            className="text-[10px]"
          >
            {isConnected ? "Live" : "Disconnected"}
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? (
              <Play className="w-3 h-3" />
            ) : (
              <Pause className="w-3 h-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => setLogs([])}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {!vpsUrl || !apiKey ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              VPS connection not configured. Set VPS_ORCHESTRATOR_URL and
              VPS_API_KEY in your Convex environment.
            </p>
          </div>
        ) : (
          <ScrollArea
            className="h-[500px] bg-gray-950 rounded-lg p-4"
            ref={scrollRef}
          >
            <pre className="text-xs font-mono leading-relaxed">
              {logs.length === 0 ? (
                <span className="text-gray-500">Waiting for logs...</span>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className={priorityColor(entry.priority)}>
                    <span className="text-gray-500">
                      {new Date(entry.timestamp).toLocaleTimeString()}{" "}
                    </span>
                    {entry.message}
                  </div>
                ))
              )}
            </pre>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
