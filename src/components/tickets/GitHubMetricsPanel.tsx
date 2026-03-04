// src/components/tickets/GitHubMetricsPanel.tsx
// GitHub metrics charts: commit frequency, PR cycle time, issue burndown

import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Loader2, RefreshCw, GitCommit, GitPullRequest, CircleDot } from 'lucide-react'

interface GitHubMetricsPanelProps {
  orgId: Id<'organizations'>
  repoFullName: string
}

export function GitHubMetricsPanel({ orgId, repoFullName }: GitHubMetricsPanelProps) {
  const getMetrics = useAction(api.github.getRepoMetrics)
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMetrics({ orgId, repoFullName })
      setMetrics(data)
    } catch (e: any) {
      setError(e.message || 'Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on mount
  if (!metrics && !loading && !error) {
    fetchMetrics()
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading GitHub metrics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </div>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <GitCommit className="h-3 w-3" />
          {metrics.summary.totalCommits} commits (30d)
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <GitPullRequest className="h-3 w-3" />
          {metrics.summary.openPRs} open PRs
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <GitPullRequest className="h-3 w-3" />
          {metrics.summary.mergedPRs} merged PRs
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <CircleDot className="h-3 w-3" />
          {metrics.summary.openIssues} open issues
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchMetrics}
          disabled={loading}
          className="ml-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Commit Frequency */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Commit Frequency (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.commitFrequency.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.commitFrequency}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) => d.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No commits in the last 30 days</p>
            )}
          </CardContent>
        </Card>

        {/* PR Cycle Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">PR Cycle Time (hours to merge)</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.prCycleTimes.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metrics.prCycleTimes}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(n) => `#${n}`}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0}h`, 'Time to merge']}
                    labelFormatter={(n) => `PR #${n}`}
                  />
                  <Bar dataKey="hoursToMerge" fill="hsl(var(--chart-2, 220 70% 50%))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No merged PRs found</p>
            )}
          </CardContent>
        </Card>

        {/* Issue Burndown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issue Burndown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8 py-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{metrics.issueBurndown.open}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{metrics.issueBurndown.closed}</p>
                <p className="text-xs text-muted-foreground">Closed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-muted-foreground">{metrics.issueBurndown.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              {metrics.issueBurndown.total > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {Math.round((metrics.issueBurndown.closed / metrics.issueBurndown.total) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Closed Rate</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
