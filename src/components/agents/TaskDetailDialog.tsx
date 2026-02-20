// src/components/agents/TaskDetailDialog.tsx

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TaskStatus } from '~/convex/schema'
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
import { Trash2, Save, ArrowRightLeft } from 'lucide-react'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

interface TaskDetailDialogProps {
  task: any
  agents: any[]
  orgId: Id<'organizations'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskDetailDialog({
  task,
  agents,
  orgId: _orgId,
  open,
  onOpenChange,
}: TaskDetailDialogProps) {
  const updateTask = useMutation(api.agents.updateTask)
  const updateStatus = useMutation(api.agents.updateTaskStatus)
  const handoffTask = useMutation(api.agents.handoffTask)
  const deleteTask = useMutation(api.agents.deleteTask)

  // Local edit state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [agentId, setAgentId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tags, setTags] = useState('')
  const [context, setContext] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')

  // Handoff state
  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffAgent, setHandoffAgent] = useState('')
  const [handoffNote, setHandoffNote] = useState('')

  // Reset local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setPriority(task.priority || 'medium')
      setAgentId(task.agentId || '')
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
      setTags((task.tags || []).join(', '))
      setContext(task.context || '')
      setStatus(task.status || 'todo')
      setShowHandoff(false)
      setHandoffAgent('')
      setHandoffNote('')
    }
  }, [task?._id])

  if (!task) return null

  const getAgentInfo = (id: string) => {
    return agents.find((a: any) => a.agentId === id) || {
      name: id,
      emoji: '🦞',
      color: '#6B7280',
    }
  }

  const currentAgent = getAgentInfo(agentId)

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as TaskStatus)
    await updateStatus({ taskId: task._id, status: newStatus as TaskStatus })
  }

  const handleSave = async () => {
    const changes: Record<string, any> = {}

    if (title !== task.title) changes.title = title
    if (description !== task.description) changes.description = description
    if (priority !== task.priority) changes.priority = priority
    if (agentId !== task.agentId) changes.agentId = agentId

    const newDueDate = dueDate ? new Date(dueDate).getTime() : undefined
    if (newDueDate !== task.dueDate) changes.dueDate = newDueDate

    const newTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    const oldTags = task.tags || []
    if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) changes.tags = newTags

    if (context !== (task.context || '')) changes.context = context

    if (Object.keys(changes).length > 0) {
      await updateTask({ taskId: task._id, ...changes })
    }

    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return
    await deleteTask({ taskId: task._id })
    onOpenChange(false)
  }

  const handleHandoff = async () => {
    if (!handoffAgent) return
    await handoffTask({
      taskId: task._id,
      toAgentId: handoffAgent as any,
      note: handoffNote || undefined,
    })
    setShowHandoff(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Task Details</DialogTitle>
          <div className="space-y-3">
            {/* Title */}
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-none px-0 focus-visible:ring-0 shadow-none"
              placeholder="Task title"
            />

            {/* Agent + Status row */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="w-auto h-8 gap-1.5 border-dashed">
                  <span
                    className="text-sm font-medium"
                    style={{ color: currentAgent.color }}
                  >
                    {currentAgent.emoji} {currentAgent.name}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.agentId} value={agent.agentId}>
                      {agent.emoji} {agent.name} — {agent.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-auto h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          {/* Priority + Due Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Due Date
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tags
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags..."
            />
            {tags && (
              <div className="flex gap-1 flex-wrap">
                {tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Context / Notes
            </label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Additional context for the agent..."
              rows={2}
            />
          </div>

          {/* Handoff section */}
          {task.handoffFrom && (
            <div className="flex items-center gap-2 text-sm text-blue-500 bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
              <ArrowRightLeft className="w-4 h-4 shrink-0" />
              <span>
                Handed off from <strong>{getAgentInfo(task.handoffFrom).name}</strong>
                {task.handoffNote && `: "${task.handoffNote}"`}
              </span>
            </div>
          )}

          {!showHandoff ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHandoff(true)}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Hand off to another agent
            </Button>
          ) : (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">Hand off task</p>
              <Select value={handoffAgent} onValueChange={setHandoffAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a: any) => a.agentId !== agentId)
                    .map((agent: any) => (
                      <SelectItem key={agent.agentId} value={agent.agentId}>
                        {agent.emoji} {agent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                value={handoffNote}
                onChange={(e) => setHandoffNote(e.target.value)}
                placeholder="Handoff note (optional)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleHandoff} disabled={!handoffAgent}>
                  Confirm Handoff
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHandoff(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
            <p>Created: {new Date(task._creationTime).toLocaleString()}</p>
            {task.completedAt && (
              <p>Completed: {new Date(task.completedAt).toLocaleString()}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between mt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
