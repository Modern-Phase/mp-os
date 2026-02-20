// src/components/agents/GlobalTaskBoard.tsx

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TaskStatus } from '~/convex/schema'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Plus, Filter, LayoutGrid, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/misc'
import { TaskCard } from '@/components/kanban/TaskCard'
import { TaskDetailDialog } from '@/components/agents/TaskDetailDialog'
import { STATUS_DOT_COLORS, STATUS_ACCENT_COLORS } from '@/components/kanban/kanban-utils'

const COLUMNS: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done']

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
}

interface GlobalTaskBoardProps {
  orgId: Id<'organizations'>
  agents: any[]
}

export function GlobalTaskBoard({ orgId, agents }: GlobalTaskBoardProps) {
  const tasks = useQuery(api.agents.getAllTasks, { orgId })
  const updateStatus = useMutation(api.agents.updateTaskStatus)
  const createTask = useMutation(api.agents.createTask)

  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    agentId: '',
  })

  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [quickAddColumn, setQuickAddColumn] = useState<TaskStatus | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickAddAgent, setQuickAddAgent] = useState('')
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [doneCollapsed, setDoneCollapsed] = useState(false)

  // Filters
  const [activeAgentFilters, setActiveAgentFilters] = useState<Set<string>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const toggleAgentFilter = (agentId: string) => {
    setActiveAgentFilters((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) next.delete(agentId)
      else next.add(agentId)
      return next
    })
  }

  const filteredTasks = (tasks || []).filter((task: any) => {
    if (activeAgentFilters.size > 0 && !activeAgentFilters.has(task.agentId)) return false
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
    return true
  })

  const getAgentInfo = (agentId: string) => {
    return agents.find((a: any) => a.agentId === agentId) || {
      name: agentId,
      emoji: '🦞',
      color: '#6B7280',
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    setDragOverColumn(null)
    const taskId = e.dataTransfer.getData('taskId') as Id<'agentTasks'>
    if (taskId) {
      await updateStatus({ taskId, status })
    }
  }

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.agentId) return
    await createTask({
      orgId,
      title: newTask.title,
      description: newTask.description,
      agentId: newTask.agentId as any,
      priority: newTask.priority as any,
    })
    setNewTask({ title: '', description: '', priority: 'medium', agentId: '' })
    setNewTaskOpen(false)
  }

  const handleQuickAdd = async (status: TaskStatus) => {
    if (!quickAddTitle.trim() || !quickAddAgent) return
    const taskId = await createTask({
      orgId,
      title: quickAddTitle.trim(),
      description: '',
      agentId: quickAddAgent as any,
      priority: 'medium',
    })
    if (status !== 'todo') {
      await updateStatus({ taskId, status })
    }
    setQuickAddTitle('')
    setQuickAddAgent('')
    setQuickAddColumn(null)
  }

  const getTasksByColumn = (status: TaskStatus) => {
    return filteredTasks.filter((t: any) => t.status === status)
  }

  // Summary counts
  const totalCount = filteredTasks.length
  const inProgressCount = filteredTasks.filter((t: any) => t.status === 'in_progress').length
  const blockedCount = filteredTasks.filter((t: any) => t.status === 'blocked').length
  const hasFilters = activeAgentFilters.size > 0 || priorityFilter !== 'all'
  const hasNoTasks = tasks !== undefined && filteredTasks.length === 0

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">All Agent Tasks</h2>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="text-muted-foreground tabular-nums">{totalCount} total</span>
            {inProgressCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 tabular-nums">{inProgressCount} in progress</span>
            )}
            {blockedCount > 0 && (
              <span className="text-red-600 dark:text-red-400 tabular-nums">{blockedCount} blocked</span>
            )}
          </div>
        </div>

        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select
                value={newTask.agentId}
                onValueChange={(v) => setNewTask({ ...newTask, agentId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assign to agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.agentId} value={agent.agentId}>
                      {agent.emoji} {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <Textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
              <Select
                value={newTask.priority}
                onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateTask} disabled={!newTask.title || !newTask.agentId} className="w-full">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {agents.map((agent: any) => (
            <button
              key={agent.agentId}
              onClick={() => toggleAgentFilter(agent.agentId)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all border',
                activeAgentFilters.size === 0 || activeAgentFilters.has(agent.agentId)
                  ? 'border-current/30 opacity-100'
                  : 'border-transparent opacity-35 hover:opacity-55',
              )}
              style={{ color: agent.color }}
            >
              {agent.emoji} {agent.name}
            </button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setActiveAgentFilters(new Set())
              setPriorityFilter('all')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Board */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center flex-1 animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-sm font-semibold text-foreground/80 mb-1">
            {hasFilters ? 'No tasks match filters' : 'No tasks yet'}
          </h3>
          <p className="text-xs text-muted-foreground/60 max-w-[220px] text-center mb-4">
            {hasFilters ? 'Try adjusting your filters' : 'Create your first task to get started'}
          </p>
          {!hasFilters && (
            <Button size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create first task
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 flex-1 min-h-0">
          {COLUMNS.map((status) => {
            const columnTasks = getTasksByColumn(status)
            const count = columnTasks.length
            const isCollapsed = status === 'done' && doneCollapsed

            return (
              <div
                key={status}
                className={cn(
                  'flex flex-col rounded-xl border transition-colors duration-200 group/col overflow-hidden',
                  'bg-muted/30 dark:bg-muted/20 border-border/50',
                  dragOverColumn === status && 'border-primary/40 bg-primary/5',
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status) }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, status)}
              >
                {/* Column header */}
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLORS[status])} />
                    <h3 className="font-semibold text-sm text-foreground/90">
                      {STATUS_LABELS[status]}
                    </h3>
                    <span className="text-xs text-muted-foreground/60 tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {status === 'done' && count > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover/col:opacity-100 transition-opacity"
                        onClick={() => setDoneCollapsed(!doneCollapsed)}
                      >
                        <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', !doneCollapsed && 'rotate-90')} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover/col:opacity-100 transition-opacity"
                      onClick={() => {
                        setQuickAddColumn(quickAddColumn === status ? null : status)
                        setQuickAddTitle('')
                        setQuickAddAgent('')
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Accent line */}
                <div className={cn('h-px bg-gradient-to-r from-transparent to-transparent', STATUS_ACCENT_COLORS[status])} />

                {/* Cards area */}
                {!isCollapsed && (
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {/* Quick-add ghost card */}
                      {quickAddColumn === status && (
                        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-3 space-y-2 animate-fade-in">
                          <Select
                            value={quickAddAgent}
                            onValueChange={setQuickAddAgent}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Agent..." />
                            </SelectTrigger>
                            <SelectContent>
                              {agents.map((agent: any) => (
                                <SelectItem key={agent.agentId} value={agent.agentId}>
                                  {agent.emoji} {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            variant="minimal"
                            placeholder="Task title..."
                            value={quickAddTitle}
                            onChange={(e) => setQuickAddTitle(e.target.value)}
                            className="h-8 text-sm placeholder:text-muted-foreground/40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && quickAddTitle.trim() && quickAddAgent) handleQuickAdd(status)
                              if (e.key === 'Escape') {
                                setQuickAddColumn(null)
                                setQuickAddTitle('')
                              }
                            }}
                          />
                          <p className="text-[10px] text-muted-foreground/50">
                            Enter to add &middot; Esc to cancel
                          </p>
                        </div>
                      )}

                      {/* Task cards */}
                      {columnTasks.map((task: any) => {
                        const taskAgent = getAgentInfo(task.agentId)
                        return (
                          <TaskCard
                            key={task._id}
                            task={task}
                            agent={taskAgent}
                            showAgent
                            onDragStart={(e) => handleDragStart(e, task._id)}
                            onClick={() => setSelectedTask(task)}
                          />
                        )
                      })}

                      {/* Column empty state */}
                      {count === 0 && quickAddColumn !== status && (
                        <button
                          onClick={() => {
                            setQuickAddColumn(status)
                            setQuickAddTitle('')
                            setQuickAddAgent('')
                          }}
                          className="flex flex-col items-center justify-center w-full py-8 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors group/empty"
                        >
                          <Plus className="w-4 h-4 mb-1 opacity-0 group-hover/empty:opacity-100 transition-opacity" />
                          <span className="text-[10px]">No tasks</span>
                        </button>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Task detail dialog */}
      <TaskDetailDialog
        task={selectedTask}
        agents={agents}
        orgId={orgId}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
      />
    </div>
  )
}
