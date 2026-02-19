// src/components/agents/TaskBoard.tsx

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TaskStatus } from '~/convex/schema'
import { Card, CardContent } from '@/ui/card'
import { Badge } from '@/ui/badge'
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
import { Calendar, ArrowRightLeft, Plus, ClipboardList, Check } from 'lucide-react'
import { TaskDetailDialog } from '@/components/agents/TaskDetailDialog'

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

  // Task detail dialog
  const [selectedTask, setSelectedTask] = useState<any | null>(null)

  // Inline quick-add
  const [quickAddColumn, setQuickAddColumn] = useState<TaskStatus | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
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

  const getColumnColor = (status: TaskStatus) => {
    switch (status) {
      case 'backlog': return 'bg-gray-50 dark:bg-gray-900 border-gray-200'
      case 'todo': return 'bg-blue-50 dark:bg-blue-950 border-blue-200'
      case 'in_progress': return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200'
      case 'review': return 'bg-purple-50 dark:bg-purple-950 border-purple-200'
      case 'blocked': return 'bg-red-50 dark:bg-red-950 border-red-200'
      case 'done': return 'bg-green-50 dark:bg-green-950 border-green-200'
    }
  }

  const allAgents = agents || [agent]
  const hasNoTasks = tasks !== undefined && tasks.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <h2 className="text-xl font-bold" style={{ color: agent.color }}>
              {agent.name}
            </h2>
            <p className="text-sm text-muted-foreground">{agent.role}</p>
          </div>
        </div>

        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task for {agent.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <Textarea
                placeholder="Description"
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
              <Button onClick={handleCreateTask}>Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Board-level empty state or Kanban columns */}
      {hasNoTasks ? (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-380px)] text-muted-foreground">
          <ClipboardList className="h-12 w-12 opacity-10 mb-4" />
          <p className="text-sm font-medium mb-2">No tasks for {agent.name}</p>
          <p className="text-xs mb-4">Create a task to get this agent started</p>
          <Button size="sm" onClick={() => setNewTaskOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create first task
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 h-[calc(100vh-280px)]">
          {COLUMNS.map((status) => (
            <div
              key={status}
              className={`flex flex-col rounded-lg border-2 ${getColumnColor(status)}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="p-3 border-b border-opacity-20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {STATUS_LABELS[status]}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {getTasksByColumn(status).length}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setQuickAddColumn(quickAddColumn === status ? null : status)
                        setQuickAddTitle('')
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {/* Inline quick-add form */}
                  {quickAddColumn === status && (
                    <div className="p-2 border rounded-lg bg-background">
                      <div className="flex gap-1">
                        <Input
                          placeholder="Task title..."
                          value={quickAddTitle}
                          onChange={(e) => setQuickAddTitle(e.target.value)}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickAdd(status)
                            if (e.key === 'Escape') {
                              setQuickAddColumn(null)
                              setQuickAddTitle('')
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={!quickAddTitle.trim()}
                          onClick={() => handleQuickAdd(status)}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Task cards */}
                  {getTasksByColumn(status).map((task: any) => (
                    <Card
                      key={task._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task._id)}
                      onClick={() => setSelectedTask(task)}
                      className="cursor-move hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm line-clamp-2">
                            {task.title}
                          </h4>
                          {task.handoffFrom && (
                            <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {task.priority === 'urgent' && (
                            <Badge variant="destructive" className="text-[10px]">
                              Urgent
                            </Badge>
                          )}
                          {task.priority === 'high' && (
                            <Badge className="text-[10px] bg-orange-500">
                              High
                            </Badge>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Column empty state */}
                  {getTasksByColumn(status).length === 0 && quickAddColumn !== status && (
                    <p className="text-xs italic text-muted-foreground text-center py-8">
                      No tasks
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
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
