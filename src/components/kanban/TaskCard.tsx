// src/components/kanban/TaskCard.tsx
// Shared premium task card used by TaskBoard and GlobalTaskBoard

import { useState } from 'react'
import { Card, CardContent } from '@/ui/card'
import { cn } from '@/utils/misc'
import { Calendar, ArrowRightLeft } from 'lucide-react'
import { PRIORITY_COLORS, formatRelativeDate } from '@/components/kanban/kanban-utils'

interface TaskCardProps {
  task: any
  agent?: { name: string; emoji: string; color: string }
  showAgent?: boolean
  onDragStart: (e: React.DragEvent) => void
  onClick: () => void
}

function DueDatePill({ timestamp }: { timestamp: number }) {
  const { label, isOverdue, isSoon } = formatRelativeDate(timestamp)
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium',
        isOverdue && 'text-red-500',
        isSoon && !isOverdue && 'text-amber-600 dark:text-amber-400',
        !isOverdue && !isSoon && 'text-muted-foreground',
      )}
    >
      <Calendar className="w-3 h-3" />
      {label}
    </div>
  )
}

export function TaskCard({ task, agent, showAgent = false, onDragStart, onClick }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false)

  const priorityColors = PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? PRIORITY_COLORS.medium

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    onDragStart(e)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={cn(
        'cursor-grab border-l-[3px] transition-all duration-200',
        priorityColors.border,
        isDragging && 'opacity-50 scale-[0.98] cursor-grabbing',
        !isDragging && 'hover:-translate-y-[1px] hover:shadow-md hover:border-l-[3px]',
      )}
    >
      <CardContent className="p-3 space-y-1.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-[13px] leading-tight line-clamp-2">
            {task.title}
          </h4>
          {task.handoffFrom && (
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Bottom metadata row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {/* Agent pill */}
          {showAgent && agent && (
            <div
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${agent.color}12`, color: agent.color }}
            >
              {agent.emoji} {agent.name}
            </div>
          )}

          {/* Due date */}
          {task.dueDate && <DueDatePill timestamp={task.dueDate} />}

          {/* Tags (max 2 + overflow) */}
          {task.tags?.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {task.tags?.length > 2 && (
            <span className="text-[9px] text-muted-foreground/60">
              +{task.tags.length - 2}
            </span>
          )}

          {/* Handoff source */}
          {task.handoffFrom && (
            <div className="flex items-center gap-1 text-[10px] text-blue-500/80">
              <ArrowRightLeft className="w-2.5 h-2.5" />
              handoff
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
