// src/routes/_app/_auth/dashboard/_layout.tickets.tsx
// All Tickets — manual tickets + live GitHub issues grouped by project

import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useMutation, useAction } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TicketStatus } from '~/convex/schema'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Card, CardContent } from '@/ui/card'
import { Input } from '@/ui/input'
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
  Ticket,
  ExternalLink,
  CircleDot,
  GitBranch,
  FolderKanban,
  MessageSquare,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/utils/misc'
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog'
import { TicketDetailDialog } from '@/components/tickets/TicketDetailDialog'
import { AssignToAgentButton } from '@/components/agents/AssignToAgentButton'
import siteConfig from '~/site.config'

export const Route = createFileRoute('/_app/_auth/dashboard/_layout/tickets')({
  component: TicketsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Tickets`,
  }),
})

const STATUS_OPTIONS: { value: TicketStatus | 'all'; label: string; color?: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open', color: 'bg-blue-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500' },
  { value: 'waiting', label: 'Waiting', color: 'bg-purple-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  loom: 'Loom',
  github: 'GitHub',
}

function TicketsPage() {
  const currentUser = useConvexQuery(api.app.getCurrentUser)
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<'organizations'> | undefined

  const ensurePersonalOrg = useMutation(api.organizations.ensurePersonalOrg)
  const getAllOpenIssues = useAction(api.github.getAllOpenIssues)
  const [orgEnsured, setOrgEnsured] = useState(false)
  useEffect(() => {
    if (currentUser && !orgId && !orgEnsured) {
      setOrgEnsured(true)
      ensurePersonalOrg().catch(console.error)
    }
  }, [currentUser, orgId, orgEnsured, ensurePersonalOrg])

  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<Id<'tickets'> | null>(null)

  // GitHub issues state
  const [ghIssues, setGhIssues] = useState<any[] | null>(null)
  const [ghLoading, setGhLoading] = useState(false)
  const [ghError, setGhError] = useState<string | null>(null)

  const tickets = useConvexQuery(
    api.tickets.getTickets,
    orgId
      ? {
          orgId,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }
      : 'skip',
  )

  const stats = useConvexQuery(
    api.tickets.getTicketStats,
    orgId ? { orgId } : 'skip',
  )

  const connection = useConvexQuery(
    api.github.getConnection,
    orgId ? { orgId } : 'skip',
  )
  const isGitHubConnected = connection?.status === 'active'

  // Fetch GitHub issues on mount / when org changes
  const fetchGitHubIssues = async () => {
    if (!orgId || !isGitHubConnected) return
    setGhLoading(true)
    setGhError(null)
    try {
      const data = await getAllOpenIssues({ orgId })
      setGhIssues(data)
    } catch (err: any) {
      setGhError(err.message || 'Failed to fetch GitHub issues')
      setGhIssues([])
    }
    setGhLoading(false)
  }

  useEffect(() => {
    if (orgId && isGitHubConnected) {
      fetchGitHubIssues()
    }
  }, [orgId, isGitHubConnected])

  if (!currentUser || !orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Filter manual tickets
  const filteredTickets = (tickets || []).filter((t: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.leadName?.toLowerCase().includes(q) ||
      t.projectName?.toLowerCase().includes(q)
    )
  })

  // Filter GitHub issues by search
  const filteredGhIssues = (ghIssues || [])
    .map((group: any) => ({
      ...group,
      repos: group.repos
        .map((repo: any) => ({
          ...repo,
          issues: search
            ? repo.issues.filter((i: any) =>
                i.title.toLowerCase().includes(search.toLowerCase()) ||
                i.authorLogin?.toLowerCase().includes(search.toLowerCase()),
              )
            : repo.issues,
        }))
        .filter((repo: any) => repo.issues.length > 0),
    }))
    .filter((group: any) => group.repos.length > 0)

  // Total GH issue count
  const totalGhIssues = (ghIssues || []).reduce(
    (sum: number, g: any) =>
      sum + g.repos.reduce((rs: number, r: any) => rs + r.issues.length, 0),
    0,
  )

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Track client change requests and issues
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATUS_OPTIONS.filter((s) => s.value !== 'all').map((s) => (
            <Card
              key={s.value}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/50',
                statusFilter === s.value && 'ring-1 ring-primary',
              )}
              onClick={() =>
                setStatusFilter(statusFilter === s.value ? 'all' : (s.value as TicketStatus))
              }
            >
              <CardContent className="p-3 flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', s.color)} />
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {stats[s.value as keyof typeof stats] || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets & issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <div className="flex items-center gap-2">
                  {s.color && <div className={cn('h-2 w-2 rounded-full', s.color)} />}
                  {s.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isGitHubConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGitHubIssues}
            disabled={ghLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', ghLoading && 'animate-spin')} />
            Refresh
          </Button>
        )}
      </div>

      {/* ── GitHub Issues Section ────────────────────────── */}
      {isGitHubConnected && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Open GitHub Issues
            </h2>
            {totalGhIssues > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalGhIssues}
              </Badge>
            )}
            {ghLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          {ghError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">
              {ghError}
            </div>
          )}

          {ghLoading && !ghIssues ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredGhIssues.length === 0 && !ghLoading ? (
            <div className="text-center py-6 text-sm text-muted-foreground border border-border rounded-lg">
              No open GitHub issues found across tracked repos
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGhIssues.map((group: any) => (
                <div key={group.projectId || '__unlinked__'} className="border border-border rounded-lg overflow-hidden">
                  {/* Project header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                    <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {group.projectName}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.repos.reduce((s: number, r: any) => s + r.issues.length, 0)} issues
                    </Badge>
                  </div>

                  {/* Issues per repo */}
                  {group.repos.map((repo: any) => (
                    <div key={repo.repoFullName}>
                      {/* Repo sub-header */}
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20 border-b border-border text-xs text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span className="font-medium">{repo.repoFullName}</span>
                      </div>

                      {/* Issue rows */}
                      {repo.issues.map((issue: any) => (
                        <div
                          key={`${repo.repoFullName}-${issue.number}`}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                        >
                          <CircleDot className="h-4 w-4 text-green-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <a
                                href={issue.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-foreground truncate hover:underline"
                              >
                                {issue.title}
                              </a>
                              <span className="text-xs text-muted-foreground shrink-0">
                                #{issue.number}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {issue.labels?.map((l: any) => (
                                <Badge
                                  key={l.name}
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                  style={{
                                    borderColor: `#${l.color}`,
                                    color: `#${l.color}`,
                                  }}
                                >
                                  {l.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {/* Assign to Agent */}
                          {orgId && (
                            <AssignToAgentButton
                              orgId={orgId}
                              issue={{
                                number: issue.number,
                                title: issue.title,
                                url: issue.url,
                                body: issue.body,
                              }}
                              repoFullName={repo.repoFullName}
                              defaultBranch={repo.defaultBranch || 'main'}
                            />
                          )}
                          {/* Source tag */}
                          <Badge variant="outline" className="text-[10px] shrink-0 gap-1 border-green-600/30 text-green-700 dark:text-green-400">
                            <GitBranch className="h-2.5 w-2.5" />
                            GitHub
                          </Badge>
                          {/* Meta */}
                          <div className="flex items-center gap-2 shrink-0">
                            {issue.assignees?.length > 0 && (
                              <div className="flex -space-x-1">
                                {issue.assignees.slice(0, 3).map((a: any) => (
                                  <img
                                    key={a.login}
                                    src={a.avatar}
                                    alt={a.login}
                                    title={a.login}
                                    className="h-5 w-5 rounded-full border border-background"
                                  />
                                ))}
                              </div>
                            )}
                            {issue.comments > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <MessageSquare className="h-3 w-3" /> {issue.comments}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {relativeTime(issue.createdAt)}
                            </span>
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Manual Tickets Section ───────────────────────── */}
      <div className="space-y-3">
        {isGitHubConnected && (
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Manual Tickets
            </h2>
            {filteredTickets.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredTickets.length}
              </Badge>
            )}
          </div>
        )}

        {!tickets ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== 'all'
                ? 'No tickets match your filters'
                : 'No manual tickets yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_100px_100px_120px_80px] gap-3 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Title</span>
              <span>Client</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Source</span>
              <span>Created</span>
            </div>
            {/* Rows */}
            {filteredTickets.map((ticket: any) => {
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === ticket.status)
              return (
                <button
                  key={ticket._id}
                  onClick={() => setSelectedTicketId(ticket._id)}
                  className="w-full grid grid-cols-1 sm:grid-cols-[1fr_120px_100px_100px_120px_80px] gap-1 sm:gap-3 items-center px-4 py-3 border-t border-border hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ticket.title}
                    </p>
                    {ticket.projectName && (
                      <p className="text-xs text-muted-foreground truncate">
                        {ticket.projectName}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {ticket.leadName || '\u2014'}
                  </span>
                  <div>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs text-white', statusOpt?.color)}
                    >
                      {statusOpt?.label}
                    </Badge>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium capitalize',
                      PRIORITY_COLORS[ticket.priority],
                    )}
                  >
                    {ticket.priority}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {SOURCE_LABELS[ticket.source] || ticket.source}
                    </Badge>
                    {ticket.githubIssueUrl && (
                      <a
                        href={ticket.githubIssueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ticket._creationTime).toLocaleDateString()}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <CreateTicketDialog
        orgId={orgId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <TicketDetailDialog
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      />
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────

function relativeTime(dateStr: string) {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}
