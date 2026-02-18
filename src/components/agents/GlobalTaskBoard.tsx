// src/components/agents/GlobalTaskBoard.tsx

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
import { Calendar, ArrowRightLeft, Plus, Filter } from 'lucide-react'

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

  // Filters
  const [activeAgentFilters, setActiveAgentFilters] = useState<Set<string>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  const toggleAgentFilter = (agentId: string) => {
    setActiveAgentFilters((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) {
        next.delete(agentId)
      } else {
        next.add(agentId)
      }
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

  const getTasksByColumn = (status: TaskStatus) => {
    return filteredTasks.filter((t: any) => t.status === status)
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

  // Summary counts
  const totalCount = filteredTasks.length
  const inProgressCount = filteredTasks.filter((t: any) => t.status === 'in_progress').length
  const blockedCount = filteredTasks.filter((t: any) => t.status === 'blocked').length

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">All Agent Tasks</h2>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="text-muted-foreground">{totalCount} total</span>
            <span className="text-yellow-600 dark:text-yellow-400">{inProgressCount} In Progress</span>
            <span className="text-red-600 dark:text-red-400">{blockedCount} Blocked</span>
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
              <Button onClick={handleCreateTask} disabled={!newTask.title || !newTask.agentId}>
                Create Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {agents.map((agent: any) => (
            <button
              key={agent.agentId}
              onClick={() => toggleAgentFilter(agent.agentId)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors border ${
                activeAgentFilters.size === 0 || activeAgentFilters.has(agent.agentId)
                  ? 'border-current opacity-100'
                  : 'border-transparent opacity-40'
              }`}
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
        {(activeAgentFilters.size > 0 || priorityFilter !== 'all') && (
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

      {/* Kanban columns */}
      <div className="grid grid-cols-6 gap-3 flex-1 min-h-0">
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
                <Badge variant="secondary" className="text-xs">
                  {getTasksByColumn(status).length}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {getTasksByColumn(status).map((task: any) => {
                  const agent = getAgentInfo(task.agentId)
                  return (
                    <Card
                      key={task._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task._id)}
                      className="cursor-move hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm line-clamp-2">
                            {task.title}
                          </h4>
                          {task.handoffFrom && (
                            <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Agent badge */}
                        <div
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                          style={{
                            backgroundColor: `${agent.color}15`,
                            color: agent.color,
                          }}
                        >
                          {agent.emoji} {agent.name}
                        </div>

                        {/* Handoff indicator */}
                        {task.handoffFrom && (
                          <div className="flex items-center gap-1 text-[10px] text-blue-500">
                            <ArrowRightLeft className="w-3 h-3" />
                            from {getAgentInfo(task.handoffFrom).name}
                          </div>
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
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  )
}
