// src/routes/_app/_auth/dashboard/_layout.agent-chat.tsx
// Individual agent chat page

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { useState, useEffect } from 'react'
import { AgentChat } from '@/components/agents/AgentChat'
import { AgentCard } from '@/components/agents/AgentCard'
import { Id } from '~/convex/_generated/dataModel'

type AgentChatSearch = {
  agentId?: string
}

export const Route = createFileRoute('/_app/_auth/dashboard/_layout/agent-chat')({
  component: AgentChatPage,
  validateSearch: (search: Record<string, unknown>): AgentChatSearch => ({
    agentId: typeof search.agentId === 'string' ? search.agentId : undefined,
  }),
})

function AgentChatPage() {
  const { agentId: searchAgentId } = Route.useSearch()
  const currentUser = useQuery(api.app.getCurrentUser)

  // Derive orgId from first membership
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<'organizations'> | undefined

  const agents = useQuery(
    api.agents.getAgents,
    orgId ? { orgId } : 'skip',
  )

  const [selectedAgent, setSelectedAgent] = useState<any>(null)

  // Auto-select agent from URL search param (e.g. from notification click)
  useEffect(() => {
    if (searchAgentId && agents && !selectedAgent) {
      const match = agents.find((a: any) => a.agentId === searchAgentId)
      if (match) setSelectedAgent(match)
    }
  }, [searchAgentId, agents, selectedAgent])

  if (!currentUser || !orgId || !agents) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar - Agent List */}
      <aside className="w-72 border-r bg-gray-50 dark:bg-gray-900 p-4 flex flex-col overflow-hidden">
        <h2 className="font-semibold mb-4 flex items-center gap-2 shrink-0">
          <span>💬</span> Chat with Agents
        </h2>
        <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
          {agents.map((agent: any) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              orgId={orgId}
              isActive={selectedAgent?.agentId === agent.agentId}
              onClick={() => setSelectedAgent(agent)}
            />
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {selectedAgent ? (
          <AgentChat
            agent={selectedAgent}
            orgId={orgId}
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
