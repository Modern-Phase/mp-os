import { useState, useCallback, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { ScrollArea } from "@/ui/scroll-area"
import { Loader2, ArrowLeft, MessageSquare, RefreshCw, Wifi } from "lucide-react"

interface SessionInfo {
  id: string
  agentId: string
  messageCount: number
  lastActivity: string
  sizeBytes: number
}

interface SessionMessage {
  role: string
  content: string
  timestamp?: string
}

interface SessionViewerProps {
  instanceId: string
  agentName: string
}

export function SessionViewer({ instanceId, agentName }: SessionViewerProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSessions = useAction(api.vpsOrchestrator.getSessions)
  const getSessionMessages = useAction(api.vpsOrchestrator.getSessionMessages)

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSessions({ instanceId })
      setSessions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions")
    } finally {
      setIsLoading(false)
    }
  }, [getSessions, instanceId])

  const loadMessages = useCallback(
    async (sessionId: string) => {
      setIsLoadingMessages(true)
      try {
        const data = await getSessionMessages({ instanceId, sessionId })
        setMessages(data.messages || [])
        setSelectedSession(sessionId)
      } catch (err) {
        console.error("Failed to load messages:", err)
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [getSessionMessages, instanceId],
  )

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Message detail view
  if (selectedSession) {
    return (
      <div className="h-full flex flex-col rounded-xl border bg-card">
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedSession(null)
              setMessages([])
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-base font-semibold truncate">
            Session: {selectedSession}
          </h3>
        </div>
        <div className="flex-1 min-h-0 p-5">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`rounded-xl p-4 max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : msg.role === "assistant"
                            ? "bg-muted"
                            : "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      <div className="text-[11px] font-medium mb-1.5 opacity-60 uppercase tracking-wider">
                        {msg.role}
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                      {msg.timestamp && (
                        <span className="text-[10px] opacity-40 mt-2 block">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                      <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm font-medium text-foreground/70">No messages</p>
                    <p className="text-xs text-muted-foreground/60">This session has no recorded messages</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    )
  }

  // Session list view
  return (
    <div className="h-full flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">
            Sessions — {agentName}
          </h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={loadSessions}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="flex-1 min-h-0 p-5">
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Wifi className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-foreground/70 mb-1">
              No sessions found
            </p>
            <p className="text-xs text-muted-foreground/60 max-w-[240px] mb-3">
              Sessions appear after chatting with this agent. Make sure the VPS instance is running.
            </p>
            <Button size="sm" variant="outline" onClick={loadSessions}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className="w-full text-left p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                  onClick={() => loadMessages(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate max-w-[220px]">
                        {session.id}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {session.messageCount} msgs
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 ml-[26px] text-xs text-muted-foreground">
                    <span>
                      {new Date(session.lastActivity).toLocaleDateString()}{" "}
                      {new Date(session.lastActivity).toLocaleTimeString()}
                    </span>
                    <span>{formatBytes(session.sizeBytes)}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
