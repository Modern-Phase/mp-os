// src/components/crm/CrmAnalytics.tsx — CRM Analytics dashboard with recharts

import { useQuery as useConvexQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Loader2, DollarSign, TrendingUp, Clock, Target } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const STAGE_COLORS: Record<string, string> = {
  new_lead: '#3B82F6',
  qualified: '#8B5CF6',
  discovery: '#EC4899',
  proposal: '#F59E0B',
  negotiation: '#10B981',
  won: '#059669',
  lost: '#EF4444',
}

const SOURCE_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1']

const ACTIVITY_COLORS: Record<string, string> = {
  call: '#3B82F6',
  email: '#8B5CF6',
  meeting: '#EC4899',
  note: '#F59E0B',
  proposal_sent: '#10B981',
  contract_sent: '#059669',
  status_change: '#6366F1',
}

interface CrmAnalyticsProps {
  orgId: Id<'organizations'>
  agents: any[]
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatSourceLabel(source: string): string {
  return source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function CrmAnalytics({ orgId, agents }: CrmAnalyticsProps) {
  const analytics = useConvexQuery(api.crm.getCrmAnalytics, { orgId })

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const { kpis, pipelineFunnel, sourceBreakdown, agentPerformance, activityDistribution } = analytics

  const agentLookup = new Map(agents.map((a: any) => [a.agentId, a]))

  return (
    <div className="space-y-6 pb-8">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Pipeline Value</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.totalPipelineValue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kpis.totalLeads} lead{kpis.totalLeads !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium">Win Rate</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{kpis.winRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kpis.wonCount} won / {kpis.lostCount} lost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Deal Size</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(kpis.avgDealSize)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Won deals only</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Cycle Time</span>
            </div>
            <p className="text-2xl font-bold">{kpis.avgCycleTimeDays}d</p>
            <p className="text-xs text-muted-foreground mt-0.5">Lead to close</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Pipeline Funnel + Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pipelineFunnel} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value: number, _name: string, props: any) => [
                    `${value} leads (${formatCurrency(props.payload.value)})`,
                    'Count',
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {pipelineFunnel.map((entry: any) => (
                    <Cell
                      key={entry.stage}
                      fill={STAGE_COLORS[entry.stage] || '#94A3B8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie
                    data={sourceBreakdown}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {sourceBreakdown.map((_: any, i: number) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value,
                      formatSourceLabel(name),
                    ]}
                    contentStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {sourceBreakdown.map((s: any, i: number) => (
                  <div key={s.source} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">
                      {formatSourceLabel(s.source)}
                    </span>
                    <span className="font-medium tabular-nums">{s.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({s.conversionRate}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Agent Leaderboard + Activity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Agent Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {agentPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No agent-assigned deals yet
              </p>
            ) : (
              <div className="space-y-3">
                {agentPerformance
                  .sort((a: any, b: any) => b.totalValue - a.totalValue)
                  .map((perf: any) => {
                    const agent = agentLookup.get(perf.agentId)
                    return (
                      <div
                        key={perf.agentId}
                        className="flex items-center gap-3 py-2 border-b last:border-0"
                      >
                        <span className="text-lg">{agent?.emoji || '?'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {agent?.name || perf.agentId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {perf.dealsWon} deal{perf.dealsWon !== 1 ? 's' : ''} won
                            {perf.avgCycleTime > 0 && ` · ${perf.avgCycleTime}d avg cycle`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(perf.totalValue)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {activityDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No activities recorded yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={activityDistribution.sort((a: any, b: any) => b.count - a.count)}
                  margin={{ left: 0, right: 16 }}
                >
                  <XAxis
                    dataKey="type"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) =>
                      v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    }
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    labelFormatter={(label: string) =>
                      label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    }
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {activityDistribution.map((entry: any) => (
                      <Cell
                        key={entry.type}
                        fill={ACTIVITY_COLORS[entry.type] || '#94A3B8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
