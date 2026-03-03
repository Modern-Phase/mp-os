// src/routes/_app/_auth/dashboard/_layout.crm.tsx
// CRM — Lead Pipeline & Deal Tracking

import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery as useConvexQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { LeadSource } from '~/convex/schema'
import { Button } from '@/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Input } from '@/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Loader2, Plus, Kanban, Table2, BarChart3 } from 'lucide-react'
import { PipelineBoard } from '@/components/crm/PipelineBoard'
import { LeadsTable } from '@/components/crm/LeadsTable'
import { LeadDetailDialog } from '@/components/crm/LeadDetailDialog'
import { CrmAnalytics } from '@/components/crm/CrmAnalytics'
import { CsvImportDialog } from '@/components/crm/CsvImportDialog'
import siteConfig from '~/site.config'

type CrmSearch = {
  leadId?: string
}

export const Route = createFileRoute('/_app/_auth/dashboard/_layout/crm')({
  component: CrmPage,
  validateSearch: (search: Record<string, unknown>): CrmSearch => ({
    leadId: typeof search.leadId === 'string' ? search.leadId : undefined,
  }),
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - CRM`,
  }),
})

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'referral', label: 'Referral' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
]

function CrmPage() {
  const { leadId: searchLeadId } = Route.useSearch()
  const navigate = useNavigate()
  const currentUser = useConvexQuery(api.app.getCurrentUser)
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<'organizations'> | undefined

  // Auto-create personal org if user has no memberships
  const ensurePersonalOrg = useMutation(api.organizations.ensurePersonalOrg)
  const [orgEnsured, setOrgEnsured] = useState(false)
  useEffect(() => {
    if (currentUser && !orgId && !orgEnsured) {
      setOrgEnsured(true)
      ensurePersonalOrg().catch(console.error)
    }
  }, [currentUser, orgId, orgEnsured, ensurePersonalOrg])

  const agents = useConvexQuery(api.agents.getAgents, orgId ? { orgId } : 'skip')
  const pipelineStats = useConvexQuery(api.crm.getPipelineStats, orgId ? { orgId } : 'skip')

  const createLead = useMutation(api.crm.createLead)

  const [activeView, setActiveView] = useState('pipeline')
  const [addLeadOpen, setAddLeadOpen] = useState(false)
  const [newLead, setNewLead] = useState({
    company: '',
    contactName: '',
    contactEmail: '',
    source: 'other' as LeadSource,
    value: '',
    assignedAgent: '',
  })

  // For table view → detail dialog (or URL-driven via ?leadId=)
  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  // Auto-open lead detail from URL search param (e.g. from notification click)
  const searchLead = useConvexQuery(
    api.crm.getLead,
    searchLeadId ? { leadId: searchLeadId as Id<'crmLeads'> } : 'skip',
  )
  useEffect(() => {
    if (searchLead) {
      setSelectedLead(searchLead)
    }
  }, [searchLead])

  const handleCreateLead = async () => {
    if (!orgId || !newLead.company.trim() || !newLead.contactName.trim()) return
    await createLead({
      orgId,
      company: newLead.company.trim(),
      contactName: newLead.contactName.trim(),
      contactEmail: newLead.contactEmail.trim() || undefined,
      source: newLead.source,
      value: newLead.value ? Math.round(parseFloat(newLead.value) * 100) : undefined,
      assignedAgent: (newLead.assignedAgent || undefined) as any,
    })
    setNewLead({ company: '', contactName: '', contactEmail: '', source: 'other', value: '', assignedAgent: '' })
    setAddLeadOpen(false)
  }

  if (!currentUser) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const formatValue = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  const totalValue = pipelineStats?.totalValue ?? 0
  const totalLeads = pipelineStats?.totalLeads ?? 0

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between bg-white dark:bg-gray-950">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-bold text-lg">CRM</h1>
            <p className="text-xs text-muted-foreground">
              {totalLeads} lead{totalLeads !== 1 ? 's' : ''}
              {totalValue > 0 && ` · ${formatValue(totalValue)} pipeline`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
        {orgId && <CsvImportDialog orgId={orgId} agents={agents || []} />}
        <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Company name"
                value={newLead.company}
                onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
              />
              <Input
                placeholder="Contact name"
                value={newLead.contactName}
                onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })}
              />
              <Input
                placeholder="Email (optional)"
                type="email"
                value={newLead.contactEmail}
                onChange={(e) => setNewLead({ ...newLead, contactEmail: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={newLead.source}
                  onValueChange={(v) => setNewLead({ ...newLead, source: v as LeadSource })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Deal value ($)"
                  type="number"
                  value={newLead.value}
                  onChange={(e) => setNewLead({ ...newLead, value: e.target.value })}
                />
              </div>
              {agents && agents.length > 0 && (
                <Select
                  value={newLead.assignedAgent}
                  onValueChange={(v) => setNewLead({ ...newLead, assignedAgent: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to agent (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.agentId} value={agent.agentId}>
                        <span>{agent.emoji} {agent.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{agent.role}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={handleCreateLead}
                disabled={!newLead.company.trim() || !newLead.contactName.trim()}
                className="w-full"
              >
                Create Lead
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </header>

      {/* View tabs + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList>
              <TabsTrigger value="pipeline" className="gap-1.5">
                <Kanban className="w-4 h-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5">
                <Table2 className="w-4 h-4" />
                Table
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 flex-1 overflow-auto">
              <TabsContent value="pipeline" className="h-[calc(100vh-14rem)]">
                {orgId && <PipelineBoard orgId={orgId} agents={agents || []} />}
              </TabsContent>
              <TabsContent value="table">
                {orgId && (
                  <LeadsTable
                    orgId={orgId}
                    agents={agents || []}
                    onSelectLead={setSelectedLead}
                  />
                )}
              </TabsContent>
              <TabsContent value="analytics">
                {orgId && (
                  <CrmAnalytics orgId={orgId} agents={agents || []} />
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Detail dialog for table view clicks */}
      {orgId && (
        <LeadDetailDialog
          lead={selectedLead}
          agents={agents || []}
          orgId={orgId}
          open={!!selectedLead}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedLead(null)
              if (searchLeadId) {
                navigate({ search: {} as any })
              }
            }
          }}
        />
      )}
    </div>
  )
}
