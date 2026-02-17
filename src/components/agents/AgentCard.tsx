// src/components/agents/AgentCard.tsx

import { useQuery } from '@tanstack/react-query'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface AgentCardProps {
  agent: any
  orgId: Id<'organizations'>
  onClick?: () => void
  isActive?: boolean
}

export function AgentCard({ agent, orgId, onClick, isActive }: AgentCardProps) {
  const { data: tasks } = useQuery(
    api.agents.getAgentTasks,
    { orgId, agentId: agent.agentId }
  )

  const stats = {
    total: tasks?.length || 0,
    inProgress: tasks?.filter((t: any) => t.status === 'in_progress').length || 0,
    blocked: tasks?.filter((t: any) => t.status === 'blocked').length || 0,
    done: tasks?.filter((t: any) => t.status === 'done').length || 0,
  }

  const status = stats.inProgress > 0 ? 'working' : stats.blocked > 0 ? 'blocked' : 'idle'

  const getStatusIcon = () => {
    switch (status) {
      case 'working': return <Activity className="w-4 h-4 text-green-500" />
      case 'blocked': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'idle': return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isActive ? 'ring-2 ring-offset-2' : ''
      }`}
      style={{ 
        borderColor: isActive ? agent.color : undefined,
      }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{ backgroundColor: `${agent.color}20` }}
            >
              {agent.emoji}
            </div>
            <div>
              <h3 className="font-semibold text-sm">{agent.name}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                {agent.role}
              </p>
            </div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="mt-3 flex items-center gap-2">
          {stats.inProgress > 0 && (
            <Badge variant="default" className="text-[10px] bg-blue-500">
              {stats.inProgress} active
            </Badge>
          )}
          {stats.blocked > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {stats.blocked} blocked
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {agent.expertise.slice(0, 2).map((skill: string) => (
            <span 
              key={skill}
              className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full"
            >
              {skill}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
