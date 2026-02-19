// src/components/agents/GlobalContextPanel.tsx

import { useQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { ScrollArea } from '@/ui/scroll-area'
import { Progress } from '@/ui/progress'
import {
  Target,
  Folder,
  TrendingUp,
  Activity
} from 'lucide-react'

interface GlobalContextPanelProps {
  orgId: Id<'organizations'>
  projects: any[]
  activity: any[]
}

export function GlobalContextPanel({ orgId, projects, activity }: GlobalContextPanelProps) {
  const context = useQuery(
    api.agents.getGlobalContext,
    { orgId }
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Target className="w-5 h-5" />
          Global Context
        </h2>
        {context && (
          <span className="text-xs text-muted-foreground">
            Updated by {(context as any).updatedBy}
          </span>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-150px)]">
        <div className="space-y-4 pr-4">
          {/* Active Projects */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Active Projects ({projects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Folder className="h-8 w-8 opacity-10 mb-2" />
                  <p className="text-xs">No active projects</p>
                </div>
              ) : (
                projects.map((project) => (
                  <div key={project._id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{project.name}</h4>
                        <p className="text-xs text-muted-foreground">{project.client}</p>
                      </div>
                      <StatusDot status={project.status} />
                    </div>
                    <Progress value={project.progress} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {project.agents.map((agentId: string) => (
                          <AgentEmoji key={agentId} agentId={agentId} />
                        ))}
                      </div>
                      <span>{project.progress}%</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Company Priorities */}
          {(context as any)?.companyPriorities && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Priorities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(context as any).companyPriorities.slice(0, 3).map((priority: any) => (
                  <div key={priority.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                    <PriorityBadge priority={priority.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{priority.title}</p>
                      {priority.deadline && (
                        <p className="text-xs text-red-500">
                          Due {new Date(priority.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Activity className="h-8 w-8 opacity-10 mb-2" />
                  <p className="text-xs">No recent activity</p>
                </div>
              ) : (
                activity.slice(0, 5).map((item: any) => (
                  <div key={item._id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                    <AgentEmoji agentId={item.agentId} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.target}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planning: 'bg-gray-500',
    in_progress: 'bg-blue-500',
    review: 'bg-purple-500',
    delivered: 'bg-green-500',
  }
  return <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-500'}`} />
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-gray-200 text-gray-700',
    medium: 'bg-blue-200 text-blue-700',
    high: 'bg-orange-200 text-orange-700',
    urgent: 'bg-red-200 text-red-700',
  }
  return (
    <Badge className={`text-[10px] ${colors[priority] || colors.medium}`}>
      {priority}
    </Badge>
  )
}

function AgentEmoji({ agentId }: { agentId: string }) {
  const emojis: Record<string, string> = {
    larry: '🤖',
    lexi: '📧',
    maya: '📊',
    oliver: '📋',
    sam: '📅',
    fiona: '💵',
    carl: '🤝',
    taylor: '⚡',
    dana: '🎨',
  }
  return <span className="text-sm" title={agentId}>{emojis[agentId] || '👤'}</span>
}
