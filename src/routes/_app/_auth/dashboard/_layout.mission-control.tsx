// src/routes/_app/_auth/dashboard/_layout.mission-control.tsx
// Mission Control — Multi-Agent Dashboard

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useConvex, useConvexAuth } from '@convex-dev/react-query'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { AgentId } from '@/convex/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  LayoutGrid, 
  Users, 
  Target, 
  Trophy, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
  ArrowRightLeft
} from 'lucide-react'
import { TaskBoard } from '@/components/agents/TaskBoard'
import { AgentCard } from '@/components/agents/AgentCard'
import { GlobalContextPanel } from '@/components/agents/GlobalContextPanel'

export const Route = createFileRoute('/_app/_auth/dashboard/mission-control')({
  component: MissionControlPage,
})

function MissionControlPage() {
  const { data: currentUser } = useQuery(api.app.getCurrentUser)
  const { data: agents } = useQuery(
    api.agents.getAgents,
    currentUser?.orgId ? { orgId: currentUser.orgId as Id<'organizations'> } : 'skip'
  )
  const { data: projects } = useQuery(
    api.agents.getProjects,
    currentUser?.orgId ? { orgId: currentUser.orgId as Id<'organizations'> } : 'skip'
  )
  const { data: recentActivity } = useQuery(
    api.agents.getRecentActivity,
    currentUser?.orgId ? { orgId: currentUser.orgId as Id<'organizations'>, limit: 20 } : 'skip'
  )

  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null)

  if (!currentUser || !agents) {
    return <div>Loading...</div>
  }

  const selectedAgentData = selectedAgent ? agents.find(a => a.agentId === selectedAgent) : null

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            MP
          </div>
          <div>
            <h1 className="font-bold text-lg">Mission Control</h1>
            <p className="text-xs text-muted-foreground">Multi-Agent Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {agents.length} Agents Active
          </div>
          <Button variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Activity Log
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Agent List */}
        <aside className="w-72 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Agents
            </h2>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agentId}
                  agent={agent}
                  orgId={currentUser.orgId as Id<'organizations'>}
                  isActive={selectedAgent === agent.agentId}
                  onClick={() => setSelectedAgent(agent.agentId)}
                />
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex overflow-hidden">
          {selectedAgent && selectedAgentData ? (
            <div className="flex-1 p-6 overflow-auto">
              <TaskBoard 
                agent={selectedAgentData}
                orgId={currentUser.orgId as Id<'organizations'>}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select an agent to view their task board</p>
                <p className="text-sm">Click any agent card from the sidebar</p>
              </div>
            </div>
          )}

          {/* Right Panel - Global Context */}
          <aside className="w-80 border-l bg-white dark:bg-gray-950 p-4">
            <GlobalContextPanel 
              orgId={currentUser.orgId as Id<'organizations'>}
              projects={projects || []}
              activity={recentActivity || []}
            />
          </aside>
        </main>
      </div>
    </div>
  )
}
