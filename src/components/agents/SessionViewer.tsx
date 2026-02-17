import { useState, useCallback, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { ScrollArea } from "@/ui/scroll-area"
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react"

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

  if (selectedSession) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
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
          <CardTitle className="text-sm font-semibold">
            Session: {selectedSession}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`rounded-lg p-3 max-w-[80%] ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : msg.role === "assistant"
                            ? "bg-gray-100 dark:bg-gray-800"
                            : "bg-yellow-50 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200"
                      }`}
                    >
                      <div className="text-[10px] font-medium mb-1 opacity-70">
                        {msg.role}
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      {msg.timestamp && (
                        <span className="text-[10px] opacity-50 mt-1 block">
                          {new Date(msg.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-8">
                    No messages in this session
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Sessions — {agentName}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            No sessions found
          </p>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  onClick={() => loadMessages(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {session.id}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {session.messageCount} msgs
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
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
      </CardContent>
    </Card>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
