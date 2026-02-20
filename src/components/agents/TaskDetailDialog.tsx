// src/components/agents/TaskDetailDialog.tsx

import { useState, useEffect, useMemo } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Trash2, Save, ArrowRightLeft, ChevronDown, X } from 'lucide-react'
import { cn } from '@/utils/misc'
import { PRIORITY_COLORS } from '@/components/kanban/kanban-utils'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const

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
  const [tagsList, setTagsList] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
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
      setTagsList(task.tags || [])
      setNewTag('')
      setContext(task.context || '')
      setStatus(task.status || 'todo')
      setShowHandoff(false)
      setHandoffAgent('')
      setHandoffNote('')
    }
  }, [task?._id])

  const hasUnsavedChanges = useMemo(() => {
    if (!task) return false
    const tagsChanged = JSON.stringify(tagsList) !== JSON.stringify(task.tags || [])
    const dueDateChanged = (dueDate ? new Date(dueDate).getTime() : undefined) !== task.dueDate
    return (
      title !== (task.title || '') ||
      description !== (task.description || '') ||
      priority !== (task.priority || 'medium') ||
      agentId !== (task.agentId || '') ||
      context !== (task.context || '') ||
      tagsChanged ||
      dueDateChanged
    )
  }, [title, description, priority, agentId, dueDate, tagsList, context, task])

  if (!task) return null

  const getAgentInfo = (id: string) => {
    return agents.find((a: any) => a.agentId === id) || {
      name: id,
      emoji: '🦞',
      color: '#6B7280',
    }
  }

  const currentAgent = getAgentInfo(agentId)

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setStatus(newStatus)
    await updateStatus({ taskId: task._id, status: newStatus })
  }

  const handleSave = async () => {
    const changes: Record<string, any> = {}
    if (title !== task.title) changes.title = title
    if (description !== task.description) changes.description = description
    if (priority !== task.priority) changes.priority = priority
    if (agentId !== task.agentId) changes.agentId = agentId
    const newDueDate = dueDate ? new Date(dueDate).getTime() : undefined
    if (newDueDate !== task.dueDate) changes.dueDate = newDueDate
    if (JSON.stringify(tagsList) !== JSON.stringify(task.tags || [])) changes.tags = tagsList
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

  const removeTag = (index: number) => {
    setTagsList((prev) => prev.filter((_, i) => i !== index))
  }

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tagsList.includes(trimmed)) {
      setTagsList((prev) => [...prev, trimmed])
    }
    setNewTag('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-0">
          <DialogTitle className="sr-only">Task Details</DialogTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            variant="minimal"
            className="text-xl font-semibold px-0 focus-visible:ring-0 shadow-none border-b border-transparent focus-visible:border-border/50 transition-colors rounded-none"
            placeholder="Task title"
          />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4">
          <div className="grid grid-cols-[1fr,240px] gap-6">
            {/* LEFT: Main content */}
            <div className="space-y-5 min-w-0">
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Context / Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Context / Notes
                </label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Additional context for the agent..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Handoff info */}
              {task.handoffFrom && (
                <div className="flex items-center gap-2 text-sm text-blue-500 bg-blue-50 dark:bg-blue-950/50 rounded-lg p-3">
                  <ArrowRightLeft className="w-4 h-4 shrink-0" />
                  <span>
                    Handed off from <strong>{getAgentInfo(task.handoffFrom).name}</strong>
                    {task.handoffNote && `: "${task.handoffNote}"`}
                  </span>
                </div>
              )}

              {/* Handoff action (collapsible) */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowHandoff(!showHandoff)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Hand off to another agent
                  <ChevronDown className={cn('w-4 h-4 ml-auto transition-transform duration-200', showHandoff && 'rotate-180')} />
                </button>
                <div className={cn(
                  'overflow-hidden transition-all duration-200',
                  showHandoff ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0',
                )}>
                  <div className="p-3 pt-0 space-y-2">
                    <Select value={handoffAgent} onValueChange={setHandoffAgent}>
                      <SelectTrigger className="h-8 text-sm">
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
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleHandoff} disabled={!handoffAgent}>
                        Confirm Handoff
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowHandoff(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-muted-foreground/70 pt-3 border-t space-y-1">
                <p>Created {new Date(task._creationTime).toLocaleString()}</p>
                {task.completedAt && (
                  <p>Completed {new Date(task.completedAt).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* RIGHT: Metadata sidebar */}
            <div className="space-y-5 border-l pl-6">
              {/* Status pills */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        status === opt.value
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority segmented control */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Priority
                </label>
                <div className="flex gap-1">
                  {PRIORITY_OPTIONS.map((p) => {
                    const colors = PRIORITY_COLORS[p]
                    return (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          'flex-1 py-1.5 rounded-md text-[11px] font-medium capitalize transition-all',
                          priority === p
                            ? cn(colors.bg, 'text-white shadow-sm')
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Agent */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Agent
                </label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="h-8 text-sm">
                    <span style={{ color: currentAgent.color }}>
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
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Tags with chip input */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Tags
                </label>
                {tagsList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tagsList.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs group/tag"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(i)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      e.preventDefault()
                      addTag(newTag)
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-xs text-muted-foreground/60 animate-fade-in">
                Unsaved changes
              </span>
            )}
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
