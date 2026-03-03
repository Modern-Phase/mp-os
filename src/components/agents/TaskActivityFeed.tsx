// src/components/agents/TaskActivityFeed.tsx

import { useQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Loader2 } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
  task_created: 'created this task',
  task_updated: 'updated this task',
  task_deleted: 'deleted this task',
  task_todo: 'moved to To Do',
  task_in_progress: 'moved to In Progress',
  task_review: 'moved to Review',
  task_blocked: 'marked as Blocked',
  task_done: 'marked as Done',
  task_backlog: 'moved to Backlog',
  task_handoff_sent: 'sent a handoff',
  task_handoff_accepted: 'accepted handoff',
  task_handoff_rejected: 'rejected handoff',
  document_attached: 'attached a document',
  document_removed: 'removed a document',
}

const AGENT_COLORS: Record<string, string> = {
  larry: '#3B82F6',
  oliver: '#10B981',
  fiona: '#059669',
  taylor: '#EF4444',
  max: '#1E40AF',
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface TaskActivityFeedProps {
  taskId: Id<'agentTasks'>
}

export function TaskActivityFeed({ taskId }: TaskActivityFeedProps) {
  const activity = useQuery(api.agents.getTaskActivity, { taskId, limit: 50 })

  if (!activity) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (activity.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/60 py-6 text-center">
        No activity yet
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {activity.map((entry, index) => {
        const label = ACTION_LABELS[entry.action] || entry.action
        const color = AGENT_COLORS[entry.agentId] || '#6B7280'
        const isLast = index === activity.length - 1

        return (
          <div key={entry._id} className="flex gap-3 relative">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
            )}
            {/* Dot */}
            <div
              className="w-[22px] h-[22px] rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[10px]"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            </div>
            {/* Content */}
            <div className="pb-4 min-w-0">
              <p className="text-sm">
                <span className="font-medium" style={{ color }}>
                  {entry.agentId}
                </span>
                {' '}
                <span className="text-muted-foreground">{label}</span>
              </p>
              {entry.target && (
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                  {entry.target}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                {formatRelativeTime(entry.timestamp)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
