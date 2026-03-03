// src/routes/_app/_auth/dashboard/_layout.task.$taskId.tsx
// Full-page task detail

import { useState, useEffect, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TaskStatus } from '~/convex/schema'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import {
  ArrowLeft,
  Trash2,
  Save,
  ArrowRightLeft,
  ChevronDown,
  X,
  Loader2,
  Paperclip,
  Activity,
} from 'lucide-react'
import { cn } from '@/utils/misc'
import { PRIORITY_COLORS } from '@/components/kanban/kanban-utils'
import { TaskAttachments } from '@/components/agents/TaskAttachments'
import { TaskActivityFeed } from '@/components/agents/TaskActivityFeed'
import siteConfig from '~/site.config'

export const Route = createFileRoute(
  '/_app/_auth/dashboard/_layout/task/$taskId',
)({
  component: TaskDetailPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Task`,
  }),
})

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const

function TaskDetailPage() {
  const { taskId } = Route.useParams()

  const currentUser = useQuery(api.app.getCurrentUser)
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<'organizations'> | undefined
  const task = useQuery(api.agents.getTask, { taskId: taskId as Id<'agentTasks'> })
  const agents = useQuery(api.agents.getAgents, orgId ? { orgId } : 'skip')

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

  // Tab state
  const [activeTab, setActiveTab] = useState('attachments')

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
  }, [task?._id, task?._creationTime])

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

  if (task === undefined) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (task === null) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go back
        </Button>
      </div>
    )
  }

  const allAgents = agents || []

  const getAgentInfo = (id: string) => {
    return allAgents.find((a: any) => a.agentId === id) || {
      name: id,
      emoji: '',
      color: '#6B7280',
      role: '',
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
    if (agentId !== (task.agentId || '')) {
      if (agentId) {
        changes.agentId = agentId
      } else {
        changes.clearAgent = true
      }
    }
    const newDueDate = dueDate ? new Date(dueDate).getTime() : undefined
    if (newDueDate !== task.dueDate) changes.dueDate = newDueDate
    if (JSON.stringify(tagsList) !== JSON.stringify(task.tags || [])) changes.tags = tagsList
    if (context !== (task.context || '')) changes.context = context
    if (Object.keys(changes).length > 0) {
      await updateTask({ taskId: task._id, ...changes })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return
    await deleteTask({ taskId: task._id })
    window.history.back()
  }

  const handleHandoff = async () => {
    if (!handoffAgent) return
    await handoffTask({
      taskId: task._id,
      toAgentId: handoffAgent as any,
      note: handoffNote || undefined,
    })
    setShowHandoff(false)
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
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-2"
        onClick={() => window.history.back()}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        variant="minimal"
        className="text-2xl font-semibold px-0 focus-visible:ring-0 shadow-none border-b border-transparent focus-visible:border-border/50 transition-colors rounded-none h-auto py-1"
        placeholder="Task title"
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-8">
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
              rows={5}
              className="resize-none text-sm"
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
              className="resize-none text-sm"
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
                    {allAgents
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

          {/* Tabs: Attachments | Activity */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="attachments" className="gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                Attachments
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Activity
              </TabsTrigger>
            </TabsList>
            <TabsContent value="attachments" className="mt-4">
              <TaskAttachments taskId={task._id} />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <TaskActivityFeed taskId={task._id} />
            </TabsContent>
          </Tabs>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground/70 pt-3 border-t space-y-1">
            <p>Created {new Date(task._creationTime).toLocaleString()}</p>
            {task.completedAt && (
              <p>Completed {new Date(task.completedAt).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* RIGHT: Metadata sidebar */}
        <div className="space-y-5 lg:border-l lg:pl-6">
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
            <Select value={agentId || 'none'} onValueChange={(v) => setAgentId(v === 'none' ? '' : v)}>
              <SelectTrigger className="h-8 text-sm">
                {agentId ? (
                  <span style={{ color: currentAgent.color }}>
                    {currentAgent.emoji} {currentAgent.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No agent</span>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No agent</SelectItem>
                {allAgents.map((agent: any) => (
                  <SelectItem key={agent.agentId} value={agent.agentId}>
                    <span>{agent.emoji} {agent.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{agent.role}</span>
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
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
      </div>
    </div>
  )
}
