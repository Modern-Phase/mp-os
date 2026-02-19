// src/components/crm/PipelineBoard.tsx

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { PipelineStage } from '~/convex/schema'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Filter, Plus, LayoutGrid } from 'lucide-react'
import { LeadCard } from '@/components/crm/LeadCard'
import { LeadDetailDialog } from '@/components/crm/LeadDetailDialog'

const STAGES: PipelineStage[] = [
  'new_lead',
  'qualified',
  'discovery',
  'proposal',
  'negotiation',
  'won',
  'lost',
]

const STAGE_LABELS: Record<PipelineStage, string> = {
  new_lead: 'New Lead',
  qualified: 'Qualified',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  new_lead: 'bg-gray-50 dark:bg-gray-900 border-gray-200',
  qualified: 'bg-blue-50 dark:bg-blue-950 border-blue-200',
  discovery: 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200',
  proposal: 'bg-purple-50 dark:bg-purple-950 border-purple-200',
  negotiation: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200',
  won: 'bg-green-50 dark:bg-green-950 border-green-200',
  lost: 'bg-red-50 dark:bg-red-950 border-red-200',
}

interface PipelineBoardProps {
  orgId: Id<'organizations'>
  agents: any[]
}

export function PipelineBoard({ orgId, agents }: PipelineBoardProps) {
  const leads = useQuery(api.crm.getLeads, { orgId })
  const updateLeadStage = useMutation(api.crm.updateLeadStage)
  const createLead = useMutation(api.crm.createLead)

  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  // Inline quick-add
  const [quickAddStage, setQuickAddStage] = useState<PipelineStage | null>(null)
  const [quickAddCompany, setQuickAddCompany] = useState('')
  const [quickAddContact, setQuickAddContact] = useState('')
  const [quickAddValue, setQuickAddValue] = useState('')

  // Filters
  const [activeAgentFilters, setActiveAgentFilters] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const toggleAgentFilter = (agentId: string) => {
    setActiveAgentFilters((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) next.delete(agentId)
      else next.add(agentId)
      return next
    })
  }

  const filteredLeads = (leads || []).filter((lead: any) => {
    if (activeAgentFilters.size > 0 && !activeAgentFilters.has(lead.assignedAgent)) return false
    if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false
    return true
  })

  const getLeadsByStage = (stage: PipelineStage) => {
    return filteredLeads.filter((l: any) => l.stage === stage)
  }

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId)
  }

  const handleDrop = async (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('leadId') as Id<'crmLeads'>
    if (leadId) {
      await updateLeadStage({ leadId, stage })
    }
  }

  const handleQuickAdd = async (stage: PipelineStage) => {
    if (!quickAddCompany.trim() || !quickAddContact.trim()) return
    await createLead({
      orgId,
      company: quickAddCompany.trim(),
      contactName: quickAddContact.trim(),
      source: 'other' as const,
      stage,
      value: quickAddValue ? Math.round(parseFloat(quickAddValue) * 100) : undefined,
    })
    setQuickAddCompany('')
    setQuickAddContact('')
    setQuickAddValue('')
    setQuickAddStage(null)
  }

  const formatValue = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  const getStageValue = (stage: PipelineStage) => {
    return getLeadsByStage(stage).reduce((sum: number, l: any) => sum + (l.value || 0), 0)
  }

  const hasNoLeads = leads !== undefined && filteredLeads.length === 0

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filter toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {agents
            .filter((a: any) => a.agentId)
            .map((agent: any) => (
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
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {(activeAgentFilters.size > 0 || sourceFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setActiveAgentFilters(new Set())
              setSourceFilter('all')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Pipeline columns */}
      {hasNoLeads ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <LayoutGrid className="h-12 w-12 opacity-10 mb-4" />
          <p className="text-sm font-medium mb-2">No leads yet</p>
          <p className="text-xs">Add your first lead to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 flex-1 min-h-0">
          {STAGES.map((stage) => (
            <div
              key={stage}
              className={`flex flex-col rounded-lg border-2 ${STAGE_COLORS[stage]}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="p-2.5 border-b border-opacity-20">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-xs">{STAGE_LABELS[stage]}</h3>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {getLeadsByStage(stage).length}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => {
                        setQuickAddStage(quickAddStage === stage ? null : stage)
                        setQuickAddCompany('')
                        setQuickAddContact('')
                        setQuickAddValue('')
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {getStageValue(stage) > 0 && (
                  <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                    {formatValue(getStageValue(stage))}
                  </p>
                )}
              </div>

              <ScrollArea className="flex-1 p-1.5">
                <div className="space-y-1.5">
                  {/* Quick-add form */}
                  {quickAddStage === stage && (
                    <div className="p-2 border rounded-lg bg-background space-y-1.5">
                      <Input
                        placeholder="Company..."
                        value={quickAddCompany}
                        onChange={(e) => setQuickAddCompany(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Input
                        placeholder="Contact name..."
                        value={quickAddContact}
                        onChange={(e) => setQuickAddContact(e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Input
                        placeholder="Value ($)..."
                        value={quickAddValue}
                        onChange={(e) => setQuickAddValue(e.target.value)}
                        className="h-7 text-xs"
                        type="number"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickAdd(stage)
                          if (e.key === 'Escape') setQuickAddStage(null)
                        }}
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setQuickAddStage(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 text-xs px-2"
                          disabled={!quickAddCompany.trim() || !quickAddContact.trim()}
                          onClick={() => handleQuickAdd(stage)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lead cards */}
                  {getLeadsByStage(stage).map((lead: any) => (
                    <LeadCard
                      key={lead._id}
                      lead={lead}
                      agents={agents}
                      onClick={() => setSelectedLead(lead)}
                      onDragStart={(e) => handleDragStart(e, lead._id)}
                    />
                  ))}

                  {getLeadsByStage(stage).length === 0 && quickAddStage !== stage && (
                    <p className="text-[10px] italic text-muted-foreground text-center py-6">
                      No leads
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Lead detail dialog */}
      <LeadDetailDialog
        lead={selectedLead}
        agents={agents}
        orgId={orgId}
        open={!!selectedLead}
        onOpenChange={(open) => { if (!open) setSelectedLead(null) }}
      />
    </div>
  )
}
