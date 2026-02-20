// src/components/crm/LeadCard.tsx

import { useState } from 'react'
import { Card, CardContent } from '@/ui/card'
import { Calendar } from 'lucide-react'
import { cn } from '@/utils/misc'
import { STAGE_CARD_BORDERS, formatRelativeDate } from '@/components/kanban/kanban-utils'

const SOURCE_LABELS: Record<string, string> = {
  cold_outreach: 'Cold',
  inbound: 'Inbound',
  referral: 'Referral',
  linkedin: 'LinkedIn',
  website: 'Website',
  other: 'Other',
}

interface LeadCardProps {
  lead: any
  agents: any[]
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}

function FollowUpPill({ timestamp }: { timestamp: number }) {
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

export function LeadCard({ lead, agents, onClick, onDragStart }: LeadCardProps) {
  const [isDragging, setIsDragging] = useState(false)

  const agent = lead.assignedAgent
    ? agents.find((a: any) => a.agentId === lead.assignedAgent)
    : null

  const stageBorder = STAGE_CARD_BORDERS[lead.stage] || 'border-l-gray-400'

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100)
  }

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
        stageBorder,
        isDragging && 'opacity-50 scale-[0.98] cursor-grabbing',
        !isDragging && 'hover:-translate-y-[1px] hover:shadow-md',
      )}
    >
      <CardContent className="p-3 space-y-1.5">
        {/* Company */}
        <h4 className="font-semibold text-[13px] leading-tight line-clamp-1">{lead.company}</h4>

        {/* Contact */}
        <p className="text-xs text-muted-foreground/70 line-clamp-1">
          {lead.contactName}
          {lead.contactTitle && ` — ${lead.contactTitle}`}
        </p>

        {/* Bottom row: value pill + agent + source + follow-up */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {lead.value > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {formatValue(lead.value)}
            </span>
          )}
          {agent && (
            <div
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${agent.color}12`, color: agent.color }}
            >
              {agent.emoji}
            </div>
          )}
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
            {SOURCE_LABELS[lead.source] || lead.source}
          </span>
          {lead.nextFollowUp && <FollowUpPill timestamp={lead.nextFollowUp} />}
        </div>
      </CardContent>
    </Card>
  )
}
