// src/routes/_app/_auth/dashboard/_layout.agent-chat.tsx
// Individual agent chat page

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../../convex/_generated/api'
import { useState } from 'react'
import { AgentChat } from '../../../../components/agents/AgentChat'
import { AgentCard } from '../../../../components/agents/AgentCard'
import { Button } from '../../../../components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const Route = createFileRoute('/_app/_auth/dashboard/agent-chat')({
  component: AgentChatPage,
})

function AgentChatPage() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.app.getCurrentUser(),
  })
  
  const { data: agents } = useQuery({
    queryKey: ['agents', currentUser?.orgId],
    queryFn: () => currentUser?.orgId 
      ? api.agents.getAgents({ orgId: currentUser.orgId })
      : null,
    enabled: !!currentUser?.orgId,
  })

  const [selectedAgent, setSelectedAgent] = useState<any>(null)

  if (!currentUser || !agents) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar - Agent List */}
      <aside className="w-72 border-r bg-gray-50 dark:bg-gray-900 p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <span>💬</span> Chat with Agents
        </h2>
        <div className="space-y-3">
          {agents.map((agent: any) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              orgId={currentUser.orgId}
              isActive={selectedAgent?.agentId === agent.agentId}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 p-6">
        {selectedAgent ? (
          <AgentChat 
            agent={selectedAgent} 
            orgId={currentUser.orgId}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <span className="text-6xl mb-4 block">👋</span>
              <p className="text-lg font-medium">Select an agent to start chatting</p>
              <p className="text-sm">Choose from the sidebar to talk to Larry, Lexi, Maya, and the team</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
