// src/components/tickets/TicketDetailDialog.tsx
// Full ticket view/edit dialog

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TicketStatus, Priority } from '~/convex/schema'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import {
  Trash2,
  Save,
  ExternalLink,
  Video,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { cn } from '@/utils/misc'

const STATUS_OPTIONS: { value: TicketStatus; label: string; color: string }[] = [
  { value: 'open', label: 'Open', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'waiting', label: 'Waiting', color: 'bg-purple-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface TicketDetailDialogProps {
  ticketId: Id<'tickets'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TicketDetailDialog({
  ticketId,
  open,
  onOpenChange,
}: TicketDetailDialogProps) {
  const ticket = useQuery(
    api.tickets.getTicket,
    ticketId ? { ticketId } : 'skip',
  )
  const updateTicket = useMutation(api.tickets.updateTicket)
  const deleteTicket = useMutation(api.tickets.deleteTicket)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TicketStatus>('open')
  const [priority, setPriority] = useState<Priority>('medium')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title)
      setDescription(ticket.description)
      setStatus(ticket.status)
      setPriority(ticket.priority)
    }
  }, [ticket])

  const handleSave = async () => {
    if (!ticketId) return
    setSaving(true)
    try {
      await updateTicket({
        ticketId,
        title,
        description,
        status,
        priority,
      })
    } catch (e) {
      console.error('Failed to update ticket:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!ticketId) return
    if (!confirm('Delete this ticket? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteTicket({ ticketId })
      onOpenChange(false)
    } catch (e) {
      console.error('Failed to delete ticket:', e)
    } finally {
      setDeleting(false)
    }
  }

  if (!ticket) return null

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === ticket.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex-1">Ticket Detail</DialogTitle>
            <Badge variant="outline" className="text-xs">
              {ticket.source}
            </Badge>
            {statusOpt && (
              <Badge className={cn('text-white text-xs', statusOpt.color)}>
                {statusOpt.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-1"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full', opt.color)} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {ticket.leadName && (
              <span>
                Client: <span className="text-foreground">{ticket.leadName}</span>
              </span>
            )}
            {ticket.projectName && (
              <span>
                Project: <span className="text-foreground">{ticket.projectName}</span>
              </span>
            )}
            {ticket.assigneeName && (
              <span>
                Assigned: <span className="text-foreground">{ticket.assigneeName}</span>
              </span>
            )}
            {ticket.creatorName && (
              <span>
                Created by: <span className="text-foreground">{ticket.creatorName}</span>
              </span>
            )}
          </div>

          {/* Tags */}
          {ticket.tags && ticket.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ticket.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Loom embed + transcript */}
          {ticket.loomUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                <a
                  href={ticket.loomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View Loom Video
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {/* Embed */}
              {ticket.loomUrl.includes('loom.com/share/') && (
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={ticket.loomUrl.replace('/share/', '/embed/')}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              )}
              {/* Transcript accordion */}
              {ticket.loomTranscript && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setTranscriptOpen(!transcriptOpen)}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform',
                        transcriptOpen && 'rotate-180',
                      )}
                    />
                    Transcript
                  </Button>
                  {transcriptOpen && (
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                      {ticket.loomTranscript}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* GitHub issue link */}
          {ticket.githubIssueUrl && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                GitHub #{ticket.githubIssueNumber}
              </Badge>
              <a
                href={ticket.githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View Issue
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Created: {new Date(ticket._creationTime).toLocaleDateString()}</p>
            {ticket.resolvedAt && (
              <p>Resolved: {new Date(ticket.resolvedAt).toLocaleDateString()}</p>
            )}
            {ticket.closedAt && (
              <p>Closed: {new Date(ticket.closedAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
