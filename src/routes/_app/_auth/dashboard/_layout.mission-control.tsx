// src/routes/_app/_auth/dashboard/_layout.mission-control.tsx
// Mission Control — Multi-Agent Dashboard with live VPS management

import { useState, useEffect, useMemo, useCallback } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery as useConvexQuery, useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Id } from "~/convex/_generated/dataModel"
import { Button } from "@/ui/button"
import { ScrollArea } from "@/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import {
  LayoutGrid,
  Users,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { InstanceCard } from "@/components/agents/InstanceCard"
import { TaskBoard } from "@/components/agents/TaskBoard"
import { SoulEditor } from "@/components/agents/SoulEditor"
import { SessionViewer } from "@/components/agents/SessionViewer"
import { LogViewer } from "@/components/agents/LogViewer"
import { AgentChat } from "@/components/agents/AgentChat"
import { GlobalContextPanel } from "@/components/agents/GlobalContextPanel"
import { VpsConnectionStatus } from "@/components/agents/VpsConnectionStatus"
import { InstanceCreateWizard } from "@/components/agents/InstanceCreateWizard"

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/mission-control")({
  component: MissionControlPage,
})

function MissionControlPage() {
  const currentUser = useConvexQuery(api.app.getCurrentUser)
  const orgId = currentUser?.orgId as Id<"organizations"> | undefined

  // Agent definitions (static metadata)
  const agents = useConvexQuery(
    api.agents.getAgents,
    orgId ? { orgId } : "skip",
  )

  // VPS instances (live state, reactive)
  const vpsInstances = useConvexQuery(api.vpsOrchestrator.getVpsInstances)

  // Projects and activity for context panel
  const projects = useConvexQuery(
    api.agents.getProjects,
    orgId ? { orgId } : "skip",
  )
  const recentActivity = useConvexQuery(
    api.agents.getRecentActivity,
    orgId ? { orgId, limit: 20 } : "skip",
  )

  // Action to sync VPS instances
  const listInstances = useAction(api.vpsOrchestrator.listInstances)

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("tasks")
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Merge agent definitions with VPS live data
  const mergedAgents = useMemo(() => {
    if (!agents) return []
    return agents.map((agent: any) => {
      const vps = vpsInstances?.find(
        (i: any) => i.agentId === agent.agentId,
      )
      return { ...agent, vps }
    })
  }, [agents, vpsInstances])

  // Also include VPS instances that don't have a matching agent definition
  const unmatchedInstances = useMemo(() => {
    if (!vpsInstances) return []
    const agentIds = new Set(agents?.map((a: any) => a.agentId) || [])
    return vpsInstances
      .filter((i: any) => !agentIds.has(i.agentId))
      .map((i: any) => ({
        agentId: i.agentId,
        name: i.agentId,
        role: "OpenClaw Instance",
        emoji: "🦞",
        color: "#EF4444",
        department: "custom",
        expertise: [],
        vps: i,
      }))
  }, [agents, vpsInstances])

  const allAgents = useMemo(
    () => [...mergedAgents, ...unmatchedInstances],
    [mergedAgents, unmatchedInstances],
  )

  // Sync VPS state on mount and periodically
  const syncVps = useCallback(async () => {
    setIsSyncing(true)
    try {
      await listInstances()
    } catch (err) {
      console.error("Failed to sync VPS instances:", err)
    } finally {
      setIsSyncing(false)
    }
  }, [listInstances])

  useEffect(() => {
    syncVps()
    const interval = setInterval(syncVps, 15000)
    return () => clearInterval(interval)
  }, [syncVps])

  const selectedAgentData = selectedAgent
    ? allAgents.find((a: any) => a.agentId === selectedAgent)
    : null

  if (!currentUser || !agents) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeCount = allAgents.filter(
    (a: any) => a.vps?.systemdState === "active",
  ).length

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
            <p className="text-xs text-muted-foreground">
              Multi-Agent Command Center
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <VpsConnectionStatus />
          <div className="text-sm text-muted-foreground">
            {activeCount}/{allAgents.length} Online
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncVps}
            disabled={isSyncing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
            />
            Sync
          </Button>
          <Button size="sm" onClick={() => setShowCreateWizard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Instance
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Instance List */}
        <aside className="w-72 border-r bg-gray-50 dark:bg-gray-900 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Instances ({allAgents.length})
            </h2>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {allAgents.map((agent: any) => (
                <InstanceCard
                  key={agent.agentId}
                  agent={agent}
                  vpsInstance={agent.vps}
                  isSelected={selectedAgent === agent.agentId}
                  onClick={() => setSelectedAgent(agent.agentId)}
                  onRefresh={syncVps}
                />
              ))}
              {allAgents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No instances found. Create one or check VPS connection.
                </p>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex overflow-hidden">
          {selectedAgent && selectedAgentData ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Agent Header */}
              <div className="px-6 pt-4 pb-2 flex items-center gap-3 border-b">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                  style={{
                    backgroundColor: `${selectedAgentData.color}20`,
                  }}
                >
                  {selectedAgentData.emoji}
                </div>
                <div>
                  <h2 className="font-semibold text-sm">
                    {selectedAgentData.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedAgentData.role}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-3">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="soul">SOUL.md</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                  </TabsList>

                  <div className="mt-4 overflow-auto flex-1">
                    <TabsContent value="tasks">
                      {orgId && (
                        <TaskBoard agent={selectedAgentData} orgId={orgId} />
                      )}
                    </TabsContent>

                    <TabsContent value="soul">
                      <SoulEditor
                        instanceId={selectedAgent}
                        agentName={selectedAgentData.name}
                      />
                    </TabsContent>

                    <TabsContent value="sessions">
                      <SessionViewer
                        instanceId={selectedAgent}
                        agentName={selectedAgentData.name}
                      />
                    </TabsContent>

                    <TabsContent value="chat">
                      {orgId && (
                        <AgentChat
                          agent={selectedAgentData}
                          orgId={orgId}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="logs">
                      <LogViewer
                        instanceId={selectedAgent}
                        agentName={selectedAgentData.name}
                        vpsUrl="" // Will be populated from config
                        apiKey="" // Will be populated from config
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <LayoutGrid className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  Select an instance to manage
                </p>
                <p className="text-sm">
                  Click any instance card from the sidebar
                </p>
              </div>
            </div>
          )}

          {/* Right Panel - Global Context */}
          {orgId && (
            <aside className="w-80 border-l bg-white dark:bg-gray-950 p-4">
              <GlobalContextPanel
                orgId={orgId}
                projects={projects || []}
                activity={recentActivity || []}
              />
            </aside>
          )}
        </main>
      </div>

      {/* Create Wizard Modal */}
      {showCreateWizard && (
        <InstanceCreateWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={syncVps}
        />
      )}
    </div>
  )
}
