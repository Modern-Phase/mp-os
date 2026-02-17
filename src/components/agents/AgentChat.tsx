// src/components/agents/AgentChat.tsx
// In-app chat interface for talking to agents

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface AgentChatProps {
  agent: any
  orgId: Id<'organizations'>
}

export function AgentChat({ agent, orgId }: AgentChatProps) {
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get chat history
  const { data: messages, refetch } = useQuery({
    queryKey: ['agentChat', orgId, agent.agentId],
    queryFn: async () => {
      const result = await api.agentChat.getAgentChatHistory({
        orgId,
        agentId: agent.agentId,
        limit: 50,
      })
      return result
    },
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  })

  // Create chat session
  const createSession = useMutation({
    mutationFn: async () => {
      const result = await api.agentChat.getOrCreateSession({
        orgId,
        agentId: agent.agentId,
      })
      return result
    },
    onSuccess: (id) => setSessionId(id),
  })

  // Send message
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) {
        const newSession = await createSession.mutateAsync()
        setSessionId(newSession)
      }
      
      return await api.agentChat.createChatMessage({
        orgId,
        agentId: agent.agentId,
        content,
        role: 'user',
        sessionId: sessionId || undefined,
      })
    },
    onSuccess: () => {
      setMessage('')
      refetch()
    },
  })

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Initialize session on first load
  useEffect(() => {
    if (!sessionId) {
      createSession.mutate()
    }
  }, [])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    sendMessage.mutate(message)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: `${agent.color}20` }}
          >
            {agent.emoji}
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </h3>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {/* Welcome message */}
            <div className="flex gap-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: `${agent.color}20` }}
              >
                {agent.emoji}
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 max-w-[80%]">
                <p className="text-sm">
                  Hi! I'm {agent.name}, your {agent.role.toLowerCase()}. 
                  I can help with: {agent.expertise.join(', ')}. What do you need?
                </p>
              </div>
            </div>

            {/* Chat messages */}
            {messages?.map((msg: any) => (
              <div 
                key={msg._id} 
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-blue-100' : ''
                  }`}
                  style={msg.role === 'agent' ? { backgroundColor: `${agent.color}20` } : {}}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : agent.emoji}
                </div>
                <div 
                  className={`rounded-lg p-3 max-w-[80%] ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <span className="text-[10px] opacity-70 mt-1 block">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sendMessage.isPending && (
              <div className="flex gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${agent.color}20` }}
                >
                  {agent.emoji}
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Message ${agent.name}...`}
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!message.trim() || sendMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
