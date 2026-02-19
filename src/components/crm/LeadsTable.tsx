// src/components/crm/LeadsTable.tsx

import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { PipelineStage } from '~/convex/schema'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Filter, ArrowUpDown, LayoutGrid } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  qualified: 'Qualified',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

const SOURCE_LABELS: Record<string, string> = {
  cold_outreach: 'Cold Outreach',
  inbound: 'Inbound',
  referral: 'Referral',
  linkedin: 'LinkedIn',
  website: 'Website',
  other: 'Other',
}

const STAGE_BADGE_COLORS: Record<string, string> = {
  new_lead: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  qualified: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  discovery: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  proposal: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  negotiation: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  won: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

type SortKey = 'company' | 'contactName' | 'stage' | 'value' | 'source' | '_creationTime'
type SortDir = 'asc' | 'desc'

interface LeadsTableProps {
  orgId: Id<'organizations'>
  agents: any[]
  onSelectLead: (lead: any) => void
}

export function LeadsTable({ orgId, agents, onSelectLead }: LeadsTableProps) {
  const leads = useQuery(api.crm.getLeads, { orgId })

  // Filters
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('_creationTime')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...(leads || [])]

    if (stageFilter !== 'all') result = result.filter((l: any) => l.stage === stageFilter)
    if (sourceFilter !== 'all') result = result.filter((l: any) => l.source === sourceFilter)
    if (agentFilter !== 'all') result = result.filter((l: any) => l.assignedAgent === agentFilter)

    result.sort((a: any, b: any) => {
      let aVal = a[sortKey] ?? ''
      let bVal = b[sortKey] ?? ''
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [leads, stageFilter, sourceFilter, agentFilter, sortKey, sortDir])

  const formatValue = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)
  }

  const getAgentInfo = (agentId: string) => {
    return agents.find((a: any) => a.agentId === agentId) || { name: agentId, emoji: '👤', color: '#6B7280' }
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? 'opacity-100' : 'opacity-30'}`} />
      </span>
    </th>
  )

  if (leads !== undefined && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <LayoutGrid className="h-12 w-12 opacity-10 mb-4" />
        <p className="text-sm font-medium mb-2">No leads yet</p>
        <p className="text-xs">Add your first lead to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents
              .filter((a: any) => a.agentId)
              .map((agent: any) => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.emoji} {agent.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {(stageFilter !== 'all' || sourceFilter !== 'all' || agentFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setStageFilter('all')
              setSourceFilter('all')
              setAgentFilter('all')
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredAndSorted.length} lead{filteredAndSorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <SortHeader label="Company" field="company" />
              <SortHeader label="Contact" field="contactName" />
              <SortHeader label="Stage" field="stage" />
              <SortHeader label="Value" field="value" />
              <SortHeader label="Source" field="source" />
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Agent
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Follow-Up
              </th>
              <SortHeader label="Created" field="_creationTime" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredAndSorted.map((lead: any) => {
              const isOverdue = lead.nextFollowUp && lead.nextFollowUp < Date.now()
              const agent = lead.assignedAgent ? getAgentInfo(lead.assignedAgent) : null
              return (
                <tr
                  key={lead._id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onSelectLead(lead)}
                >
                  <td className="px-3 py-2.5 text-sm font-medium">{lead.company}</td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground">
                    {lead.contactName}
                    {lead.contactTitle && (
                      <span className="text-xs ml-1">({lead.contactTitle})</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_BADGE_COLORS[lead.stage] || ''}`}>
                      {STAGE_LABELS[lead.stage] || lead.stage}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-green-600 dark:text-green-400 font-medium">
                    {lead.value ? formatValue(lead.value) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary" className="text-xs">
                      {SOURCE_LABELS[lead.source] || lead.source}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    {agent ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${agent.color}15`,
                          color: agent.color,
                        }}
                      >
                        {agent.emoji} {agent.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                    {lead.nextFollowUp
                      ? `${isOverdue ? 'Overdue: ' : ''}${new Date(lead.nextFollowUp).toLocaleDateString()}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(lead._creationTime).toLocaleDateString()}
                  </td>
                </tr>
              )
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground italic">
                  No leads match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
