// src/components/tickets/ProjectTicketsTab.tsx
// Ticket list filtered by projectId, for embedding in project detail

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Button } from '@/ui/button'
import { Plus, Ticket, ExternalLink } from 'lucide-react'
import { cn } from '@/utils/misc'
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog'
import { TicketDetailDialog } from '@/components/tickets/TicketDetailDialog'

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  waiting: 'bg-purple-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
}

interface ProjectTicketsTabProps {
  orgId: Id<'organizations'>
  projectId: Id<'agentProjects'>
}

export function ProjectTicketsTab({ orgId, projectId }: ProjectTicketsTabProps) {
  const tickets = useQuery(api.tickets.getTicketsByProject, { projectId })
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<Id<'tickets'> | null>(null)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tickets?.length || 0} ticket{tickets?.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          New Ticket
        </Button>
      </div>

      {!tickets || tickets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Ticket className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tickets for this project</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tickets.map((ticket: any) => (
            <button
              key={ticket._id}
              onClick={() => setSelectedTicketId(ticket._id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted/50 transition-colors"
            >
              <div className={cn('h-2 w-2 rounded-full shrink-0', STATUS_COLORS[ticket.status])} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ticket.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.source} &middot; {new Date(ticket._creationTime).toLocaleDateString()}
                </p>
              </div>
              <span className={cn('text-xs font-medium', PRIORITY_COLORS[ticket.priority])}>
                {ticket.priority}
              </span>
              {ticket.githubIssueUrl && (
                <a
                  href={ticket.githubIssueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </button>
          ))}
        </div>
      )}

      <CreateTicketDialog
        orgId={orgId}
        defaultProjectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      />
    </div>
  )
}
