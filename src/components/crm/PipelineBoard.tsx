// src/components/crm/PipelineBoard.tsx

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { PipelineStage } from '~/convex/schema'
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
import { Filter, Plus, LayoutGrid, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/misc'
import { LeadCard } from '@/components/crm/LeadCard'
import { LeadDetailDialog } from '@/components/crm/LeadDetailDialog'
import { ConvertToProjectModal } from '@/components/crm/ConvertToProjectModal'
import { STATUS_DOT_COLORS, STATUS_ACCENT_COLORS } from '@/components/kanban/kanban-utils'

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

interface PipelineBoardProps {
  orgId: Id<'organizations'>
  agents: any[]
}

export function PipelineBoard({ orgId, agents }: PipelineBoardProps) {
  const leads = useQuery(api.crm.getLeads, { orgId })
  const updateLeadStage = useMutation(api.crm.updateLeadStage)
  const createLead = useMutation(api.crm.createLead)

  const [selectedLead, setSelectedLead] = useState<any | null>(null)

  // Convert to project
  const [convertLead, setConvertLead] = useState<any | null>(null)
  const [convertModalOpen, setConvertModalOpen] = useState(false)

  // Inline quick-add
  const [quickAddStage, setQuickAddStage] = useState<PipelineStage | null>(null)
  const [quickAddCompany, setQuickAddCompany] = useState('')
  const [quickAddContact, setQuickAddContact] = useState('')
  const [quickAddValue, setQuickAddValue] = useState('')

  // Drag state
  const [dragOverColumn, setDragOverColumn] = useState<PipelineStage | null>(null)

  // Collapsible terminal columns
  const [wonCollapsed, setWonCollapsed] = useState(false)
  const [lostCollapsed, setLostCollapsed] = useState(false)

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
    setDragOverColumn(null)
    const leadId = e.dataTransfer.getData('leadId') as Id<'crmLeads'>
    if (!leadId) return

    if (stage === 'won') {
      if (!leads) return // still loading, don't act
      const lead = leads.find((l: any) => l._id === leadId)
      if (lead && !lead.projectId) {
        setConvertLead(lead)
        setConvertModalOpen(true)
        return
      }
    }

    await updateLeadStage({ leadId, stage })
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

  const hasFilters = activeAgentFilters.size > 0 || sourceFilter !== 'all'
  const hasNoLeads = leads !== undefined && filteredLeads.length === 0

  const isCollapsed = (stage: PipelineStage) => {
    if (stage === 'won') return wonCollapsed
    if (stage === 'lost') return lostCollapsed
    return false
  }

  const toggleCollapse = (stage: PipelineStage) => {
    if (stage === 'won') setWonCollapsed(!wonCollapsed)
    if (stage === 'lost') setLostCollapsed(!lostCollapsed)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filter toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {agents
            .filter((a: any) => a.agentId)
            .map((agent: any) => (
              <button
                key={agent.agentId}
                onClick={() => toggleAgentFilter(agent.agentId)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all border',
                  activeAgentFilters.size === 0 || activeAgentFilters.has(agent.agentId)
                    ? 'border-current/30 opacity-100'
                    : 'border-transparent opacity-35 hover:opacity-55',
                )}
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
        {hasFilters && (
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

      {/* Pipeline columns — horizontal scroll */}
      {hasNoLeads ? (
        <div className="flex flex-col items-center justify-center flex-1 animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <h3 className="text-sm font-semibold text-foreground/80 mb-1">
            {hasFilters ? 'No leads match filters' : 'No leads yet'}
          </h3>
          <p className="text-xs text-muted-foreground/60">
            {hasFilters ? 'Try adjusting your filters' : 'Add your first lead to get started'}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto pb-2">
          {STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage)
            const count = stageLeads.length
            const stageValue = getStageValue(stage)
            const collapsed = isCollapsed(stage)
            const isTerminal = stage === 'won' || stage === 'lost'

            return (
              <div
                key={stage}
                className={cn(
                  'flex-shrink-0 flex flex-col rounded-xl border transition-colors duration-200 group/col overflow-hidden',
                  'bg-muted/30 dark:bg-muted/20 border-border/50',
                  collapsed ? 'w-[60px]' : 'w-[240px]',
                  dragOverColumn === stage && 'border-primary/40 bg-primary/5',
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverColumn(stage) }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {/* Column header */}
                <div className={cn('px-3 py-2.5', collapsed && 'px-2')}>
                  <div className="flex items-center justify-between">
                    <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-1')}>
                      <div className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLORS[stage])} />
                      <h3 className={cn(
                        'font-medium text-xs text-foreground/90',
                        collapsed && 'writing-mode-vertical text-[10px]',
                      )}
                        style={collapsed ? { writingMode: 'vertical-rl', textOrientation: 'mixed' } : undefined}
                      >
                        {STAGE_LABELS[stage]}
                      </h3>
                      <span className={cn('text-[10px] text-muted-foreground/60 tabular-nums', collapsed && 'text-center')}>
                        {count}
                      </span>
                    </div>
                    {!collapsed && (
                      <div className="flex items-center gap-0.5">
                        {isTerminal && count > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover/col:opacity-100 transition-opacity"
                            onClick={() => toggleCollapse(stage)}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover/col:opacity-100 transition-opacity"
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
                    )}
                  </div>
                  {!collapsed && stageValue > 0 && (
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 ml-4">
                      {formatValue(stageValue)}
                    </p>
                  )}
                </div>

                {/* Accent line */}
                <div className={cn('h-px bg-gradient-to-r from-transparent to-transparent', STATUS_ACCENT_COLORS[stage])} />

                {/* Cards area */}
                {!collapsed && (
                  <ScrollArea className="flex-1 p-1.5">
                    <div className="space-y-1.5">
                      {/* Quick-add form */}
                      {quickAddStage === stage && (
                        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-2.5 space-y-1.5 animate-fade-in">
                          <Input
                            variant="minimal"
                            placeholder="Company..."
                            value={quickAddCompany}
                            onChange={(e) => setQuickAddCompany(e.target.value)}
                            className="h-7 text-xs placeholder:text-muted-foreground/40"
                            autoFocus
                          />
                          <Input
                            variant="minimal"
                            placeholder="Contact name..."
                            value={quickAddContact}
                            onChange={(e) => setQuickAddContact(e.target.value)}
                            className="h-7 text-xs placeholder:text-muted-foreground/40"
                          />
                          <Input
                            variant="minimal"
                            placeholder="Value ($)..."
                            value={quickAddValue}
                            onChange={(e) => setQuickAddValue(e.target.value)}
                            className="h-7 text-xs placeholder:text-muted-foreground/40"
                            type="number"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleQuickAdd(stage)
                              if (e.key === 'Escape') setQuickAddStage(null)
                            }}
                          />
                          <p className="text-[10px] text-muted-foreground/50">
                            Enter to add &middot; Esc to cancel
                          </p>
                        </div>
                      )}

                      {/* Lead cards */}
                      {stageLeads.map((lead: any) => (
                        <LeadCard
                          key={lead._id}
                          lead={lead}
                          agents={agents}
                          onClick={() => setSelectedLead(lead)}
                          onDragStart={(e) => handleDragStart(e, lead._id)}
                        />
                      ))}

                      {count === 0 && quickAddStage !== stage && (
                        <button
                          onClick={() => {
                            setQuickAddStage(stage)
                            setQuickAddCompany('')
                            setQuickAddContact('')
                            setQuickAddValue('')
                          }}
                          className="flex flex-col items-center justify-center w-full py-6 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors group/empty"
                        >
                          <Plus className="w-4 h-4 mb-1 opacity-0 group-hover/empty:opacity-100 transition-opacity" />
                          <span className="text-[10px]">No leads</span>
                        </button>
                      )}
                    </div>
                  </ScrollArea>
                )}

                {/* Collapsed: click to expand */}
                {collapsed && (
                  <button
                    onClick={() => toggleCollapse(stage)}
                    className="flex-1 flex items-center justify-center"
                  >
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                  </button>
                )}
              </div>
            )
          })}
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

      {/* Convert to project modal (from drag-to-Won) */}
      <ConvertToProjectModal
        lead={convertLead}
        orgId={orgId}
        open={convertModalOpen}
        onOpenChange={(open) => {
          setConvertModalOpen(open)
          if (!open) setConvertLead(null)
        }}
      />
    </div>
  )
}
