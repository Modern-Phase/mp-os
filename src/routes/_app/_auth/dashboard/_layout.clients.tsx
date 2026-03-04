// src/routes/_app/_auth/dashboard/_layout.clients.tsx
// Clients list — CRM leads that are active clients (won deals / have projects)

import { useState, useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Badge } from '@/ui/badge'
import { Card, CardContent } from '@/ui/card'
import { Input } from '@/ui/input'
import {
  Loader2,
  Search,
  Building2,
  Ticket,
  FolderKanban,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/utils/misc'
import siteConfig from '~/site.config'

export const Route = createFileRoute('/_app/_auth/dashboard/_layout/clients')({
  component: ClientsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Clients`,
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

function ClientsPage() {
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

  const leads = useConvexQuery(api.crm.getLeads, orgId ? { orgId } : 'skip')
  const projects = useConvexQuery(api.agents.getProjects, orgId ? { orgId } : 'skip')
  const allTickets = useConvexQuery(api.tickets.getTickets, orgId ? { orgId } : 'skip')

  const [search, setSearch] = useState('')

  // Build client data: leads with their project + ticket info
  const clients = useMemo(() => {
    if (!leads) return []
    return leads
      .map((lead: any) => {
        const project = projects?.find((p: any) => p._id === lead.projectId)
        const leadTickets = (allTickets || []).filter(
          (t: any) => t.leadId === lead._id,
        )
        const openTickets = leadTickets.filter(
          (t: any) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting',
        )
        return {
          ...lead,
          project,
          totalTickets: leadTickets.length,
          openTickets: openTickets.length,
          lastActivity: lead._creationTime,
        }
      })
      .sort((a: any, b: any) => b.openTickets - a.openTickets || b._creationTime - a._creationTime)
  }, [leads, projects, allTickets])

  if (!currentUser || !orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const filteredClients = clients.filter((c: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.company.toLowerCase().includes(q) ||
      c.contactName.toLowerCase().includes(q) ||
      c.contactEmail?.toLowerCase().includes(q) ||
      c.project?.name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Overview of all clients with tickets and project status
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clients list */}
      {!leads ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No clients match your search' : 'No clients yet. Add leads in the CRM.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredClients.map((client: any) => (
            <Card
              key={client._id}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() =>
                navigate({
                  to: '/dashboard/clients/$clientId',
                  params: { clientId: client._id },
                })
              }
            >
              <CardContent className="p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {client.company[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {client.company}
                    </p>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', STAGE_COLORS[client.stage])}
                    >
                      {STAGE_LABELS[client.stage]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {client.contactName}
                    {client.contactEmail && ` · ${client.contactEmail}`}
                  </p>
                </div>

                {/* Project */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FolderKanban className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[140px]">
                    {client.project?.name || 'No project'}
                  </span>
                </div>

                {/* Ticket counts */}
                <div className="flex items-center gap-3">
                  {client.openTickets > 0 && (
                    <div className="flex items-center gap-1 text-xs">
                      <Ticket className="h-3.5 w-3.5 text-orange-500" />
                      <span className="font-medium text-orange-500">
                        {client.openTickets} open
                      </span>
                    </div>
                  )}
                  {client.totalTickets > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {client.totalTickets} total
                    </span>
                  )}
                </div>

                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
