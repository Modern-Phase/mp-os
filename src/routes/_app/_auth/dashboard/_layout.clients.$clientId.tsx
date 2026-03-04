// src/routes/_app/_auth/dashboard/_layout.clients.$clientId.tsx
// Client Overview — tickets, GitHub metrics, projects, activity

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery as useConvexQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Progress } from '@/ui/progress'
import {
  Loader2,
  Plus,
  Ticket,
  GitBranch,
  FolderKanban,
  Activity,
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/utils/misc'
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog'
import { TicketDetailDialog } from '@/components/tickets/TicketDetailDialog'
import { GitHubMetricsPanel } from '@/components/tickets/GitHubMetricsPanel'
import siteConfig from '~/site.config'

export const Route = createFileRoute(
  '/_app/_auth/dashboard/_layout/clients/$clientId',
)({
  component: ClientOverviewPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Client Overview`,
  }),
})

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  qualified: 'Qualified',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  new_lead: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  qualified: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  discovery: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  proposal: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  negotiation: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  waiting: 'bg-purple-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  proposal_sent: 'Proposal Sent',
  contract_sent: 'Contract Sent',
  status_change: 'Status Change',
}

function ClientOverviewPage() {
  const { clientId } = Route.useParams()
  const leadId = clientId as Id<'crmLeads'>

  const lead = useConvexQuery(api.crm.getLead, { leadId })
  const currentUser = useConvexQuery(api.app.getCurrentUser)
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<'organizations'> | undefined

  const tickets = useConvexQuery(api.tickets.getTicketsByLead, { leadId })
  const activities = useConvexQuery(api.crm.getLeadActivities, { leadId })
  const projects = useConvexQuery(api.agents.getProjects, orgId ? { orgId } : 'skip')
  const repos = useConvexQuery(api.github.getTrackedRepos, orgId ? { orgId } : 'skip')

  const [createTicketOpen, setCreateTicketOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<Id<'tickets'> | null>(null)
  const [activeTab, setActiveTab] = useState('tickets')

  if (!lead || !orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const clientProject = lead.projectId
    ? projects?.find((p: any) => p._id === lead.projectId)
    : null

  // Find repos linked to this client's project
  const linkedRepos = clientProject
    ? (repos || []).filter((r: any) => r.linkedProjectId === clientProject._id)
    : []

  const openTickets = (tickets || []).filter(
    (t: any) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting',
  )

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        to="/dashboard/clients"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        All Clients
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
          {lead.company[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{lead.company}</h1>
            <Badge
              variant="secondary"
              className={cn('text-xs', STAGE_COLORS[lead.stage])}
            >
              {STAGE_LABELS[lead.stage]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span>{lead.contactName}</span>
            {lead.contactEmail && (
              <a
                href={`mailto:${lead.contactEmail}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" />
                {lead.contactEmail}
              </a>
            )}
            {lead.contactPhone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {lead.contactPhone}
              </span>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{openTickets.length}</p>
            <p className="text-xs text-muted-foreground">Open Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{tickets?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {clientProject ? `${clientProject.progress}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Project Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{linkedRepos.length}</p>
            <p className="text-xs text-muted-foreground">GitHub Repos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-3.5 w-3.5" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-3.5 w-3.5" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tickets?.length || 0} ticket{tickets?.length !== 1 ? 's' : ''}
            </p>
            <Button size="sm" onClick={() => setCreateTicketOpen(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              New Ticket
            </Button>
          </div>

          {!tickets || tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No tickets for this client</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tickets.map((ticket: any) => (
                <button
                  key={ticket._id}
                  onClick={() => setSelectedTicketId(ticket._id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      STATUS_COLORS[ticket.status],
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ticket.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.source} &middot;{' '}
                      {new Date(ticket._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      PRIORITY_COLORS[ticket.priority],
                    )}
                  >
                    {ticket.priority}
                  </span>
                  {ticket.githubIssueUrl && (
                    <a
                      href={ticket.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* GitHub Tab */}
        <TabsContent value="github" className="mt-4">
          {linkedRepos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                No GitHub repos linked to this client's project
              </p>
              <p className="text-xs mt-1">
                Link repos in the GitHub integration settings
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {linkedRepos.map((repo: any) => (
                <div key={repo._id}>
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={repo.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground hover:text-primary flex items-center gap-1"
                    >
                      {repo.repoFullName}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {repo.isPrivate && (
                      <Badge variant="outline" className="text-xs">
                        Private
                      </Badge>
                    )}
                  </div>
                  <GitHubMetricsPanel orgId={orgId!} repoFullName={repo.repoFullName} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="mt-4">
          {!clientProject ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No project linked to this client</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{clientProject.name}</CardTitle>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {clientProject.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {clientProject.description}
                  </p>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{clientProject.progress}%</span>
                    </div>
                    <Progress value={clientProject.progress} className="h-2" />
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>
                      Start:{' '}
                      {new Date(clientProject.startDate).toLocaleDateString()}
                    </span>
                    <span>
                      Target:{' '}
                      {new Date(clientProject.targetDate).toLocaleDateString()}
                    </span>
                    {clientProject.budget && (
                      <span>
                        Budget: ${clientProject.budget.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <Link
                    to="/dashboard/projects"
                    search={{ projectId: clientProject._id }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View in Projects
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4">
          {!activities || activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No activity recorded</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity: any) => (
                <div
                  key={activity._id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30"
                >
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {activity.title}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {ACTIVITY_TYPE_LABELS[activity.type] || activity.type}
                      </Badge>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {new Date(activity.timestamp).toLocaleDateString()}{' '}
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateTicketDialog
        orgId={orgId!}
        defaultLeadId={leadId}
        defaultProjectId={lead.projectId}
        linkedRepoIds={linkedRepos.map((r: any) => r._id)}
        open={createTicketOpen}
        onOpenChange={setCreateTicketOpen}
      />

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      />
    </div>
  )
}
