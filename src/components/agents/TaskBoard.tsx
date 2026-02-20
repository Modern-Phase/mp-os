// src/components/agents/TaskBoard.tsx

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
import { Plus, ClipboardList, ChevronRight } from 'lucide-react'
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

interface TaskBoardProps {
  agent: any
  orgId: Id<'organizations'>
  agents?: any[]
}

export function TaskBoard({ agent, orgId, agents }: TaskBoardProps) {
  const tasks = useQuery(
    api.agents.getAgentTasks,
    { orgId, agentId: agent.agentId }
  )

  const updateStatus = useMutation(api.agents.updateTaskStatus)
  const createTask = useMutation(api.agents.createTask)

  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
  })

  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [quickAddColumn, setQuickAddColumn] = useState<TaskStatus | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null)
  const [doneCollapsed, setDoneCollapsed] = useState(false)

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
    if (!newTask.title) return
    await createTask({
      orgId,
      title: newTask.title,
      description: newTask.description,
      agentId: agent.agentId,
      priority: newTask.priority as any,
    })
    setNewTask({ title: '', description: '', priority: 'medium' })
    setNewTaskOpen(false)
  }

  const handleQuickAdd = async (status: TaskStatus) => {
    if (!quickAddTitle.trim()) return
    const taskId = await createTask({
      orgId,
      title: quickAddTitle.trim(),
      description: '',
      agentId: agent.agentId,
      priority: 'medium',
    })
    if (status !== 'todo') {
      await updateStatus({ taskId, status })
    }
    setQuickAddTitle('')
    setQuickAddColumn(null)
  }

  const getTasksByColumn = (status: TaskStatus) => {
    return tasks?.filter((t: any) => t.status === status) || []
  }

  const allAgents = agents || [agent]
  const hasNoTasks = tasks !== undefined && tasks.length === 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: `${agent.color}15` }}
          >
            {agent.emoji}
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </h2>
            <p className="text-xs text-muted-foreground">{agent.role}</p>
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
              <DialogTitle>Create Task for {agent.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                autoFocus
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
              <Button onClick={handleCreateTask} disabled={!newTask.title.trim()} className="w-full">
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Board */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-380px)] animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-sm font-semibold text-foreground/80 mb-1">
            No tasks for {agent.name}
          </h3>
          <p className="text-xs text-muted-foreground/60 max-w-[220px] text-center mb-4">
            Create a task to get this agent working on something
          </p>
          <Button size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create first task
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 h-[calc(100vh-280px)]">
          {COLUMNS.map((status) => {
            const columnTasks = getTasksByColumn(status)
            const count = columnTasks.length
            const isCollapsed = status === 'done' && doneCollapsed

            return (
              <div
                key={status}
                className={cn(
                  'flex flex-col rounded-xl border transition-colors duration-200 group/col',
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
                    <h3 className="font-medium text-sm text-foreground/90">
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
                        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-3 animate-fade-in">
                          <Input
                            variant="minimal"
                            placeholder="Task title..."
                            value={quickAddTitle}
                            onChange={(e) => setQuickAddTitle(e.target.value)}
                            className="h-8 text-sm placeholder:text-muted-foreground/40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && quickAddTitle.trim()) handleQuickAdd(status)
                              if (e.key === 'Escape') {
                                setQuickAddColumn(null)
                                setQuickAddTitle('')
                              }
                            }}
                          />
                          <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                            Enter to add &middot; Esc to cancel
                          </p>
                        </div>
                      )}

                      {/* Task cards */}
                      {columnTasks.map((task: any) => (
                        <TaskCard
                          key={task._id}
                          task={task}
                          onDragStart={(e) => handleDragStart(e, task._id)}
                          onClick={() => setSelectedTask(task)}
                        />
                      ))}

                      {/* Column empty state */}
                      {count === 0 && quickAddColumn !== status && (
                        <button
                          onClick={() => {
                            setQuickAddColumn(status)
                            setQuickAddTitle('')
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
        agents={allAgents}
        orgId={orgId}
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
      />
    </div>
  )
}
