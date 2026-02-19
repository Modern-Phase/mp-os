// src/components/crm/LeadCard.tsx

import { Card, CardContent } from '@/ui/card'
import { Badge } from '@/ui/badge'
import { Calendar, AlertCircle } from 'lucide-react'

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

export function LeadCard({ lead, agents, onClick, onDragStart }: LeadCardProps) {
  const agent = lead.assignedAgent
    ? agents.find((a: any) => a.agentId === lead.assignedAgent)
    : null

  const isOverdue = lead.nextFollowUp && lead.nextFollowUp < Date.now()

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100)
  }

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-move hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3 space-y-2">
        {/* Company + value */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-1">{lead.company}</h4>
          {lead.value && (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
              {formatValue(lead.value)}
            </span>
          )}
        </div>

        {/* Contact */}
        <p className="text-xs text-muted-foreground line-clamp-1">
          {lead.contactName}
          {lead.contactTitle && ` — ${lead.contactTitle}`}
        </p>

        {/* Agent + Source badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {agent && (
            <div
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: `${agent.color}15`,
                color: agent.color,
              }}
            >
              {agent.emoji} {agent.name}
            </div>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {SOURCE_LABELS[lead.source] || lead.source}
          </Badge>
        </div>

        {/* Follow-up date */}
        {lead.nextFollowUp && (
          <div className={`flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
            {isOverdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {isOverdue ? 'Overdue: ' : ''}
            {new Date(lead.nextFollowUp).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
