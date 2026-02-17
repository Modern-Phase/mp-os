// src/components/agents/TaskBoard.tsx

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { TaskStatus } from '@/convex/schema'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, ArrowRightLeft, Plus } from 'lucide-react'

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
}

export function TaskBoard({ agent, orgId }: TaskBoardProps) {
  const { data: tasks, refetch } = useQuery(
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

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    const taskId = e.dataTransfer.getData('taskId') as Id<'agentTasks'>
    if (taskId) {
      await updateStatus.mutateAsync({ taskId, status })
      refetch()
    }
  }

  const handleCreateTask = async () => {
    if (!newTask.title) return
    
    await createTask.mutateAsync({
      orgId,
      title: newTask.title,
      description: newTask.description,
      agentId: agent.agentId,
      priority: newTask.priority as any,
    })
    
    setNewTask({ title: '', description: '', priority: 'medium' })
    setNewTaskOpen(false)
    refetch()
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
                <Badge variant="secondary" className="text-xs">
                  {getTasksByColumn(status).length}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {getTasksByColumn(status).map((task: any) => (
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
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  )
}
