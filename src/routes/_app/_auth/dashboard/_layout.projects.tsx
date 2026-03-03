// src/routes/_app/_auth/dashboard/_layout.projects.tsx
// Projects — Client Overview & Project Dashboard

import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { AgentId, TaskStatus } from '~/convex/schema'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import { ScrollArea } from '@/ui/scroll-area'
import { Progress } from '@/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import {
  Loader2,
  Plus,
  Search,
  FolderKanban,
  CheckCircle2,
  Users,
  Activity,
  CalendarDays,
  Bot,
  ExternalLink,
  Trash2,
  GitBranch,
  FileBarChart,
  Package,
  Presentation,
} from 'lucide-react'
import { cn } from '@/utils/misc'
import siteConfig from '~/site.config'

// ──────────────────────────────────────────────
// Route definition with URL search params
// ──────────────────────────────────────────────

type ProjectsSearch = {
  projectId?: string
}

export const Route = createFileRoute('/_app/_auth/dashboard/_layout/projects')({
  component: ProjectsPage,
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined,
  }),
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Projects`,
  }),
})

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  planning: { label: 'Planning', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  in_progress: { label: 'In Progress', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  review: { label: 'Review', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  delivered: { label: 'Delivered', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
}

const STATUS_ORDER = ['in_progress', 'planning', 'review', 'delivered']

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const TASK_STATUS_STYLES: Record<string, string> = {
  backlog: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  todo: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  review: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  blocked: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  done: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function computeProgress(tasks: any[]): number {
  if (tasks.length === 0) return 0
  const done = tasks.filter((t: any) => t.status === 'done').length
  return Math.round((done / tasks.length) * 100)
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ')
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ──────────────────────────────────────────────
// Page component
// ──────────────────────────────────────────────

function ProjectsPage() {
  const { projectId: searchProjectId } = Route.useSearch()
  const navigate = useNavigate()

  const currentUser = useConvexQuery(api.app.getCurrentUser)
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<'organizations'> | undefined

  const ensurePersonalOrg = useMutation(api.organizations.ensurePersonalOrg)
  const [orgEnsured, setOrgEnsured] = useState(false)
  useEffect(() => {
    if (currentUser && !orgId && !orgEnsured) {
      setOrgEnsured(true)
      ensurePersonalOrg().catch(console.error)
    }
  }, [currentUser, orgId, orgEnsured, ensurePersonalOrg])

  const projects = useConvexQuery(api.agents.getProjects, orgId ? { orgId } : 'skip')
  const agents = useConvexQuery(api.agents.getAgents, orgId ? { orgId } : 'skip')
  const allTasks = useConvexQuery(api.agents.getAllTasks, orgId ? { orgId } : 'skip')
  const recentActivity = useConvexQuery(api.agents.getRecentActivity, orgId ? { orgId, limit: 10 } : 'skip')

  const [searchQuery, setSearchQuery] = useState('')
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  // Derive selected project ID from URL search param
  const selectedProjectId = searchProjectId
    ? (searchProjectId as Id<'agentProjects'>)
    : null

  // Auto-select first project when projects load and nothing is selected in URL
  useEffect(() => {
    if (projects && projects.length > 0 && !searchProjectId) {
      navigate({
        search: { projectId: projects[0]._id as string } as any,
        replace: true,
      })
    }
  }, [projects, searchProjectId, navigate])

  const setSelectedProjectId = (id: Id<'agentProjects'> | null) => {
    navigate({
      search: (id ? { projectId: id as string } : {}) as any,
      replace: true,
    })
  }

  const filteredProjects = useMemo(() => {
    if (!projects) return []
    let filtered = projects
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p: any) =>
          p.name.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a: any, b: any) => {
      const aIdx = STATUS_ORDER.indexOf(a.status)
      const bIdx = STATUS_ORDER.indexOf(b.status)
      return aIdx - bIdx
    })
  }, [projects, searchQuery])

  const groupedProjects = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const status of STATUS_ORDER) {
      const items = filteredProjects.filter((p: any) => p.status === status)
      if (items.length > 0) groups[status] = items
    }
    return groups
  }, [filteredProjects])

  if (!currentUser) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 border-r flex flex-col bg-white dark:bg-gray-950 shrink-0">
        <div className="p-4 border-b space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Projects</h2>
            <NewProjectDialog
              open={newProjectOpen}
              onOpenChange={setNewProjectOpen}
              orgId={orgId}
              agents={agents || []}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-4">
            {Object.entries(groupedProjects).map(([status, items]) => (
              <div key={status}>
                <div className="px-2 py-1.5 flex items-center gap-2">
                  <span className={cn('text-xs font-semibold uppercase tracking-wider', STATUS_CONFIG[status]?.color)}>
                    {STATUS_CONFIG[status]?.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-1">
                  {items.map((project: any) => (
                    <ProjectSidebarCard
                      key={project._id}
                      project={project}
                      agents={agents || []}
                      allTasks={allTasks || []}
                      isSelected={selectedProjectId === project._id}
                      onClick={() => setSelectedProjectId(project._id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {filteredProjects.length === 0 && projects !== undefined && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <FolderKanban className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground/70 mb-1">
                  {searchQuery ? 'No matches' : 'No projects yet'}
                </p>
                <p className="text-xs text-muted-foreground/50 mb-3">
                  {searchQuery ? 'Try a different search' : 'Create your first project to get started'}
                </p>
                {!searchQuery && (
                  <Button size="sm" variant="outline" onClick={() => setNewProjectOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    New Project
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Detail Panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {selectedProjectId ? (
          <ProjectDetail
            projectId={selectedProjectId}
            agents={agents || []}
            orgId={orgId}
            onDeleted={() => navigate({ search: {} as any, replace: true })}
          />
        ) : (
          <EmptyState
            projects={projects || []}
            allTasks={allTasks || []}
            recentActivity={recentActivity || []}
            onCreateProject={() => setNewProjectOpen(true)}
          />
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Sidebar project card
// ──────────────────────────────────────────────

function ProjectSidebarCard({
  project,
  agents,
  allTasks,
  isSelected,
  onClick,
}: {
  project: any
  agents: any[]
  allTasks: any[]
  isSelected: boolean
  onClick: () => void
}) {
  const projectTasks = allTasks.filter((t: any) => t.projectId === project._id)
  const taskCount = projectTasks.length
  const progress = computeProgress(projectTasks)
  const statusConf = STATUS_CONFIG[project.status]

  const assignedAgents = (project.agents || [])
    .map((id: string) => agents.find((a: any) => a.agentId === id))
    .filter(Boolean)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg p-3 transition-all duration-150',
        isSelected
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted/50 border border-transparent',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium truncate">{project.name}</p>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 shrink-0', statusConf?.bgColor, statusConf?.color)}>
          {statusConf?.label}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate mb-2">{project.client}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {assignedAgents.slice(0, 3).map((agent: any) => (
              <span
                key={agent.agentId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-background"
                style={{ backgroundColor: `${agent.color}20` }}
                title={agent.name}
              >
                {agent.emoji}
              </span>
            ))}
            {assignedAgents.length > 3 && (
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground border border-background">
                +{assignedAgents.length - 3}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {taskCount} task{taskCount !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {progress}%
        </span>
      </div>

      {taskCount > 0 && (
        <Progress value={progress} className="h-1 mt-2" />
      )}
    </button>
  )
}

// ──────────────────────────────────────────────
// Project Detail Panel
// ──────────────────────────────────────────────

function ProjectDetail({
  projectId,
  agents,
  orgId,
  onDeleted,
}: {
  projectId: Id<'agentProjects'>
  agents: any[]
  orgId: Id<'organizations'> | undefined
  onDeleted?: () => void
}) {
  const overview = useConvexQuery(api.agents.getProjectOverview, { projectId })
  const deleteProjectMut = useMutation(api.agents.deleteProject)
  const [activeTab, setActiveTab] = useState('tasks')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteProject = async () => {
    setDeleting(true)
    try {
      await deleteProjectMut({ projectId })
      setShowDeleteConfirm(false)
      onDeleted?.()
    } catch (err) {
      console.error('Failed to delete project:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (!overview) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { project, tasks, tasksByStatus, activity, linkedLead } = overview
  const statusConf = STATUS_CONFIG[project.status]
  const assignedAgents = (project.agents || [])
    .map((id: string) => agents.find((a: any) => a.agentId === id))
    .filter(Boolean)

  const progress = computeProgress(tasks)
  const now = Date.now()
  const daysUntilTarget = Math.ceil((project.targetDate - now) / (1000 * 60 * 60 * 24))
  const totalDuration = project.targetDate - project.startDate
  const elapsed = now - project.startDate
  const timelineProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Project Header */}
      <div className="border-b px-6 py-4 bg-white dark:bg-gray-950 shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-bold text-lg">{project.name}</h1>
              <Badge variant="secondary" className={cn('text-xs', statusConf?.bgColor, statusConf?.color)}>
                {statusConf?.label}
              </Badge>
              {linkedLead && (
                <Badge variant="outline" className="text-xs gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {linkedLead.company}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{project.client}</p>
            {project.description && (
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-xl">{project.description}</p>
            )}
          </div>
          <div className="flex items-start gap-3 shrink-0">
            <div className="text-right text-xs text-muted-foreground">
              <p>{new Date(project.startDate).toLocaleDateString()} — {new Date(project.targetDate).toLocaleDateString()}</p>
              <p className={cn(
                'font-medium mt-0.5',
                daysUntilTarget < 0 ? 'text-red-500' : daysUntilTarget <= 7 ? 'text-amber-500' : 'text-muted-foreground',
              )}>
                {daysUntilTarget < 0 ? `${Math.abs(daysUntilTarget)}d overdue` : `${daysUntilTarget}d remaining`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete project"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Timeline bar */}
        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              daysUntilTarget < 0 ? 'bg-red-500' : 'bg-primary',
            )}
            style={{ width: `${timelineProgress}%` }}
          />
        </div>

        {/* Delete confirmation */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete "{project.name}"?</DialogTitle>
              <DialogDescription>
                This will permanently delete the project. Tasks will be unlinked but not deleted. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b bg-white dark:bg-gray-950 shrink-0">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          label="Progress"
          value={`${progress}%`}
          sub={`${tasksByStatus.done}/${tasksByStatus.total} tasks done`}
        />
        <StatCard
          icon={<Bot className="w-4 h-4 text-blue-500" />}
          label="Agents"
          value={String(assignedAgents.length)}
          sub="assigned"
        />
        <StatCard
          icon={<Activity className="w-4 h-4 text-amber-500" />}
          label="In Progress"
          value={String(tasksByStatus.in_progress)}
          sub={tasksByStatus.blocked > 0 ? `${tasksByStatus.blocked} blocked` : 'tasks'}
        />
        <StatCard
          icon={<CalendarDays className="w-4 h-4 text-purple-500" />}
          label="Deadline"
          value={daysUntilTarget < 0 ? `${Math.abs(daysUntilTarget)}d` : `${daysUntilTarget}d`}
          sub={daysUntilTarget < 0 ? 'overdue' : 'remaining'}
        />
      </div>

      {/* Client Portal cards */}
      <div className="grid grid-cols-4 gap-3 px-6 py-3 border-b bg-white dark:bg-gray-950 shrink-0">
        <Link
          to="/dashboard/github"
          className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors group"
        >
          <GitBranch className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">GitHub</p>
            <p className="text-[10px] text-muted-foreground">Repos & activity</p>
          </div>
        </Link>
        <button
          onClick={() => setActiveTab('activity')}
          className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors group text-left"
        >
          <FileBarChart className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">Progress Report</p>
            <p className="text-[10px] text-muted-foreground">{progress}% complete</p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className="flex items-center gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors group text-left"
        >
          <Package className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">Deliverables</p>
            <p className="text-[10px] text-muted-foreground">{tasksByStatus.done}/{tasksByStatus.total} delivered</p>
          </div>
        </button>
        <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 group">
          <Presentation className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">Demo Day</p>
            <p className="text-[10px] text-muted-foreground">
              {daysUntilTarget <= 7 && daysUntilTarget > 0
                ? `In ${daysUntilTarget}d`
                : daysUntilTarget <= 0
                  ? 'Schedule now'
                  : new Date(project.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed content — min-h-0 on each flex layer so ScrollArea can constrain */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-3 shrink-0">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5">
              <Users className="w-4 h-4" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Activity className="w-4 h-4" />
              Activity
            </TabsTrigger>
            {linkedLead && (
              <TabsTrigger value="crm" className="gap-1.5">
                <ExternalLink className="w-4 h-4" />
                CRM Lead
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <TabsContent value="tasks" className="px-6 py-4">
            <ProjectTasksTab
              tasks={tasks}
              agents={agents}
              orgId={orgId}
              projectId={projectId}
            />
          </TabsContent>

          <TabsContent value="agents" className="px-6 py-4">
            <AgentsTab agents={assignedAgents} tasks={tasks} />
          </TabsContent>

          <TabsContent value="activity" className="px-6 py-4">
            <ActivityTab activity={activity} agents={agents} />
          </TabsContent>

          {linkedLead && (
            <TabsContent value="crm" className="px-6 py-4">
              <CrmLeadTab lead={linkedLead} />
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  )
}

// ──────────────────────────────────────────────
// Stat card
// ──────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// Tasks Tab — table with clickable rows + inline status change
// ──────────────────────────────────────────────

function ProjectTasksTab({
  tasks,
  agents,
  orgId,
  projectId,
}: {
  tasks: any[]
  agents: any[]
  orgId: Id<'organizations'> | undefined
  projectId: Id<'agentProjects'>
}) {
  const createTask = useMutation(api.agents.createTask)
  const updateStatus = useMutation(api.agents.updateTaskStatus)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', agentId: '', priority: 'medium' })
  const navigate = useNavigate()

  const handleCreateTask = async () => {
    if (!orgId || !newTask.title.trim()) return
    const agentId = newTask.agentId && newTask.agentId !== "none" ? newTask.agentId as AgentId : undefined
    await createTask({
      orgId,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      ...(agentId ? { agentId } : {}),
      priority: newTask.priority as any,
      projectId,
    })
    setNewTask({ title: '', description: '', agentId: '', priority: 'medium' })
    setNewTaskOpen(false)
  }

  const handleStatusChange = async (taskId: Id<'agentTasks'>, status: TaskStatus) => {
    await updateStatus({ taskId, status })
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground/70 mb-1">No tasks yet</p>
        <p className="text-xs text-muted-foreground/50 mb-3">Create a task or assign one from Mission Control</p>
        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Task to Project</DialogTitle></DialogHeader>
            <NewTaskForm form={newTask} setForm={setNewTask} agents={agents} onSubmit={handleCreateTask} />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Task to Project</DialogTitle></DialogHeader>
            <NewTaskForm form={newTask} setForm={setNewTask} agents={agents} onSubmit={handleCreateTask} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Task table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left font-medium px-4 py-2">Task</th>
              <th className="text-left font-medium px-4 py-2">Agent</th>
              <th className="text-left font-medium px-4 py-2">Status</th>
              <th className="text-left font-medium px-4 py-2">Priority</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task: any) => {
              const agent = agents.find((a: any) => a.agentId === task.agentId)
              return (
                <tr
                  key={task._id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate({ to: '/dashboard/task/$taskId', params: { taskId: task._id } })}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium truncate max-w-[300px]">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]">{task.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {agent ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span>{agent.emoji}</span>
                        {agent.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{task.agentId}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={task.status}
                      onValueChange={(v) => handleStatusChange(task._id, v as TaskStatus)}
                    >
                      <SelectTrigger className="h-7 w-[130px] border-none shadow-none px-2 py-0 text-[11px] font-medium">
                        <span className={cn(
                          'inline-flex items-center rounded-md px-1.5 py-0.5',
                          TASK_STATUS_STYLES[task.status] || 'bg-muted text-muted-foreground',
                        )}>
                          {TASK_STATUS_OPTIONS.find((o) => o.value === task.status)?.label || task.status}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className={cn(
                              'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px]',
                              TASK_STATUS_STYLES[opt.value],
                            )}>
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <PriorityBadge priority={task.priority} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Use{' '}
        <Link to="/dashboard" className="text-primary hover:underline">Mission Control</Link>
        {' '}for the full Kanban board view.
      </p>

    </div>
  )
}

function NewTaskForm({
  form,
  setForm,
  agents,
  onSubmit,
}: {
  form: { title: string; description: string; agentId: string; priority: string }
  setForm: (f: any) => void
  agents: any[]
  onSubmit: () => void
}) {
  return (
    <div className="space-y-4">
      <Input
        placeholder="Task title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        autoFocus
      />
      <Textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={2}
      />
      <Select value={form.agentId} onValueChange={(v) => setForm({ ...form, agentId: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Assign to agent (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No agent</SelectItem>
          {agents.map((agent: any) => (
            <SelectItem key={agent.agentId} value={agent.agentId}>
              <span>{agent.emoji} {agent.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{agent.role}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
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
      <Button onClick={onSubmit} disabled={!form.title.trim()} className="w-full">
        Create Task
      </Button>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: 'Low', className: 'text-gray-500' },
    medium: { label: 'Med', className: 'text-blue-500' },
    high: { label: 'High', className: 'text-amber-500' },
    urgent: { label: 'Urgent', className: 'text-red-500' },
  }
  const c = config[priority] || { label: priority, className: '' }
  return <span className={cn('text-xs font-medium', c.className)}>{c.label}</span>
}

// ──────────────────────────────────────────────
// Agents Tab
// ──────────────────────────────────────────────

function AgentsTab({ agents, tasks }: { agents: any[]; tasks: any[] }) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground/70">No agents assigned</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent: any) => {
        const agentTasks = tasks.filter((t: any) => t.agentId === agent.agentId)
        const activeTasks = agentTasks.filter((t: any) => t.status === 'in_progress')
        const doneTasks = agentTasks.filter((t: any) => t.status === 'done')

        return (
          <Card key={agent.agentId} className="shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: `${agent.color}15` }}
                >
                  {agent.emoji}
                </span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: agent.color }}>{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.role}</p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total tasks</span>
                  <span className="font-medium">{agentTasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-medium text-amber-500">{activeTasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium text-green-500">{doneTasks.length}</span>
                </div>
              </div>

              {activeTasks.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Current Task</p>
                  <p className="text-xs font-medium truncate">{activeTasks[0].title}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// Activity Tab
// ──────────────────────────────────────────────

function ActivityTab({ activity, agents }: { activity: any[]; agents: any[] }) {
  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Activity className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground/70">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activity.map((item: any) => {
        const agent = agents.find((a: any) => a.agentId === item.agentId)
        return (
          <div key={item._id} className="flex items-start gap-3 py-2.5 border-b last:border-0">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
              style={{ backgroundColor: agent ? `${agent.color}15` : undefined }}
            >
              {agent?.emoji || '?'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{agent?.name || item.agentId}</span>
                {' '}
                <span className="text-muted-foreground">{formatAction(item.action)}</span>
                {' '}
                <span className="font-medium">{item.target}</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatRelativeTime(item.timestamp)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// CRM Lead Tab
// ──────────────────────────────────────────────

function CrmLeadTab({ lead }: { lead: any }) {
  const stageLabels: Record<string, string> = {
    new_lead: 'New Lead',
    qualified: 'Qualified',
    discovery: 'Discovery',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    won: 'Won',
    lost: 'Lost',
  }

  return (
    <div className="max-w-lg space-y-4">
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{lead.company}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Contact</p>
              <p className="font-medium">{lead.contactName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Stage</p>
              <Badge variant="outline">{stageLabels[lead.stage] || lead.stage}</Badge>
            </div>
            {lead.contactEmail && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                <p>{lead.contactEmail}</p>
              </div>
            )}
            {lead.value != null && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Deal Value</p>
                <p className="font-medium">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(lead.value / 100)}
                </p>
              </div>
            )}
            {lead.source && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Source</p>
                <p>{lead.source.replace(/_/g, ' ')}</p>
              </div>
            )}
            {lead.nextStep && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">Next Step</p>
                <p>{lead.nextStep}</p>
              </div>
            )}
          </div>
          {lead.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Description</p>
              <p className="text-muted-foreground">{lead.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────
// Empty State (no project selected)
// ──────────────────────────────────────────────

function EmptyState({
  projects,
  allTasks,
  recentActivity: _recentActivity,
  onCreateProject,
}: {
  projects: any[]
  allTasks: any[]
  recentActivity: any[]
  onCreateProject: () => void
}) {
  const totalProjects = projects.length
  const activeTasks = allTasks.filter((t: any) => t.status === 'in_progress').length
  const completedTasks = allTasks.filter((t: any) => t.status === 'done').length

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FolderKanban className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-bold mb-2">Projects Dashboard</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Select a project from the sidebar to view its details, or create a new one to get started.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{totalProjects}</p>
            <p className="text-xs text-muted-foreground">Projects</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{activeTasks}</p>
            <p className="text-xs text-muted-foreground">Active Tasks</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{completedTasks}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>

        {totalProjects === 0 && (
          <Button onClick={onCreateProject}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Project
          </Button>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// New Project Dialog
// ──────────────────────────────────────────────

function NewProjectDialog({
  open,
  onOpenChange,
  orgId,
  agents,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: Id<'organizations'> | undefined
  agents: any[]
}) {
  const createProject = useMutation(api.agents.createProject)
  const [form, setForm] = useState({
    name: '',
    client: '',
    description: '',
    targetDate: '',
    agents: [] as string[],
  })

  const handleCreate = async () => {
    if (!orgId || !form.name.trim() || !form.client.trim() || !form.targetDate) return
    await createProject({
      orgId,
      name: form.name.trim(),
      client: form.client.trim(),
      description: form.description.trim(),
      targetDate: new Date(form.targetDate).getTime(),
      agents: form.agents as AgentId[],
    })
    setForm({ name: '', client: '', description: '', targetDate: '', agents: [] })
    onOpenChange(false)
  }

  const toggleAgent = (agentId: string) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.includes(agentId)
        ? f.agents.filter((id) => id !== agentId)
        : [...f.agents, agentId],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Project name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
          <Input
            placeholder="Client name"
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
          />
          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
          <div>
            <label className="text-sm font-medium mb-1.5 block">Target Date</label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Assign Agents</label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent: any) => (
                <button
                  key={agent.agentId}
                  type="button"
                  onClick={() => toggleAgent(agent.agentId)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    form.agents.includes(agent.agentId)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted/50 text-muted-foreground',
                  )}
                >
                  <span>{agent.emoji}</span>
                  {agent.name}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleCreate}
            disabled={!form.name.trim() || !form.client.trim() || !form.targetDate}
            className="w-full"
          >
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
