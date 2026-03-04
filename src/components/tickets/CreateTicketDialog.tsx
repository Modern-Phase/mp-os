// src/components/tickets/CreateTicketDialog.tsx
// Three-tab ticket creation: Manual | Loom Video | GitHub Issue
// Loom tab has two-step flow: Process Video → Review & Create

import { useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { TicketSource, Priority } from '~/convex/schema'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Textarea } from '@/ui/textarea'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Loader2, PenLine, Video, GitBranch, CheckCircle2 } from 'lucide-react'

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

interface CreateTicketDialogProps {
  orgId: Id<'organizations'>
  defaultLeadId?: Id<'crmLeads'>
  defaultProjectId?: Id<'agentProjects'>
  /** Pre-filtered repos (e.g. only repos linked to a client's project) */
  linkedRepoIds?: Id<'githubRepos'>[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTicketDialog({
  orgId,
  defaultLeadId,
  defaultProjectId,
  linkedRepoIds,
  open,
  onOpenChange,
}: CreateTicketDialogProps) {
  const createTicket = useMutation(api.tickets.createTicket)
  const previewLoom = useAction(api.tickets.previewLoomUrl)
  const leads = useQuery(api.crm.getLeads, orgId ? { orgId } : 'skip')
  const projects = useQuery(api.agents.getProjects, orgId ? { orgId } : 'skip')
  const allRepos = useQuery(api.github.getTrackedRepos, orgId ? { orgId } : 'skip')

  // If linkedRepoIds provided, filter to only those repos; otherwise show all
  const repos = linkedRepoIds && linkedRepoIds.length > 0
    ? (allRepos || []).filter((r: any) => linkedRepoIds.includes(r._id))
    : allRepos

  const [tab, setTab] = useState<'manual' | 'loom' | 'github'>('manual')
  const [loading, setLoading] = useState(false)

  // Shared fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [leadId, setLeadId] = useState<string>(defaultLeadId || '')
  const [projectId, setProjectId] = useState<string>(defaultProjectId || '')
  const [tags, setTags] = useState('')
  const [syncToGitHub, setSyncToGitHub] = useState(false)
  const [githubRepoId, setGithubRepoId] = useState<string>('')

  // Loom fields
  const [loomUrl, setLoomUrl] = useState('')
  const [loomProcessing, setLoomProcessing] = useState(false)
  const [loomProcessed, setLoomProcessed] = useState(false)
  const [loomTranscript, setLoomTranscript] = useState('')

  // GitHub import fields
  const [githubIssueUrl, setGithubIssueUrl] = useState('')
  const [ghParsed, setGhParsed] = useState<{
    owner: string
    repo: string
    number: number
  } | null>(null)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setLeadId(defaultLeadId || '')
    setProjectId(defaultProjectId || '')
    setTags('')
    setSyncToGitHub(false)
    setGithubRepoId('')
    setLoomUrl('')
    setLoomProcessing(false)
    setLoomProcessed(false)
    setLoomTranscript('')
    setGithubIssueUrl('')
    setGhParsed(null)
    setTab('manual')
  }

  const parseGitHubUrl = (url: string) => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
    if (match) {
      setGhParsed({ owner: match[1], repo: match[2], number: parseInt(match[3]) })
    } else {
      setGhParsed(null)
    }
  }

  const handleProcessLoom = async () => {
    if (!loomUrl.trim()) return
    setLoomProcessing(true)
    try {
      const result = await previewLoom({ loomUrl: loomUrl.trim() })
      setTitle(result.title || '')
      setDescription(result.description || '')
      setLoomTranscript(result.transcript || '')
      setLoomProcessed(true)
    } catch (e) {
      console.error('Failed to process Loom URL:', e)
    } finally {
      setLoomProcessing(false)
    }
  }

  const sourceMap: Record<string, TicketSource> = {
    manual: 'manual',
    loom: 'loom',
    github: 'github',
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      await createTicket({
        orgId,
        title: title.trim(),
        description: description.trim(),
        source: sourceMap[tab],
        priority,
        leadId: leadId ? (leadId as Id<'crmLeads'>) : undefined,
        projectId: projectId ? (projectId as Id<'agentProjects'>) : undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        loomUrl: tab === 'loom' ? loomUrl : undefined,
        syncToGitHub: (tab === 'manual' || tab === 'loom') ? syncToGitHub : undefined,
        githubRepoId: syncToGitHub && githubRepoId ? (githubRepoId as Id<'githubRepos'>) : undefined,
        githubIssueNumber: tab === 'github' && ghParsed ? ghParsed.number : undefined,
        githubIssueUrl: tab === 'github' ? githubIssueUrl : undefined,
      })
      resetForm()
      onOpenChange(false)
    } catch (e) {
      console.error('Failed to create ticket:', e)
    } finally {
      setLoading(false)
    }
  }

  const isLoomValid = loomUrl.includes('loom.com/')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="loom" className="gap-1.5">
              <Video className="h-3.5 w-3.5" />
              Loom Video
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              GitHub Issue
            </TabsTrigger>
          </TabsList>

          {/* Loom tab — two-step: paste URL → process → review fields */}
          <TabsContent value="loom" className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium text-foreground">Loom Video URL</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="https://www.loom.com/share/..."
                  value={loomUrl}
                  onChange={(e) => {
                    setLoomUrl(e.target.value)
                    // Reset processed state if URL changes
                    if (loomProcessed) {
                      setLoomProcessed(false)
                      setTitle('')
                      setDescription('')
                      setLoomTranscript('')
                    }
                  }}
                  disabled={loomProcessing}
                />
                <Button
                  size="sm"
                  onClick={handleProcessLoom}
                  disabled={!isLoomValid || loomProcessing || loomProcessed}
                  className="shrink-0"
                >
                  {loomProcessing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {loomProcessed && <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-500" />}
                  {loomProcessing ? 'Processing...' : loomProcessed ? 'Processed' : 'Process Video'}
                </Button>
              </div>
              {loomProcessing && (
                <p className="text-xs text-muted-foreground mt-1">
                  Extracting transcript and generating ticket details...
                </p>
              )}
              {loomProcessed && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Transcript extracted — review the details below and create ticket
                </p>
              )}
            </div>
          </TabsContent>

          {/* GitHub tab - URL input */}
          <TabsContent value="github" className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium text-foreground">GitHub Issue URL</label>
              <Input
                placeholder="https://github.com/owner/repo/issues/123"
                value={githubIssueUrl}
                onChange={(e) => {
                  setGithubIssueUrl(e.target.value)
                  parseGitHubUrl(e.target.value)
                }}
                className="mt-1"
              />
              {ghParsed && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">
                    {ghParsed.owner}/{ghParsed.repo}
                  </Badge>
                  <Badge variant="outline">#{ghParsed.number}</Badge>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Manual tab placeholder (fields shown below for all tabs) */}
          <TabsContent value="manual" className="mt-0" />
        </Tabs>

        {/* Common fields — for Loom tab, only show after processing */}
        {(tab !== 'loom' || loomProcessed) && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="text-sm font-medium text-foreground">Title</label>
              <Input
                placeholder="Brief summary of the request"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                placeholder="Detailed description of what needs to change..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Tags</label>
                <Input
                  placeholder="bug, ui, feature"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Client</label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(leads || []).map((lead: any) => (
                      <SelectItem key={lead._id} value={lead._id}>
                        {lead.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Project</label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects || []).map((p: any) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sync to GitHub option (manual + loom tabs) */}
            {(tab === 'manual' || tab === 'loom') && repos && repos.length > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={syncToGitHub}
                    onChange={(e) => setSyncToGitHub(e.target.checked)}
                    className="rounded border-border"
                  />
                  Create GitHub issue
                </label>
                {syncToGitHub && (
                  <Select value={githubRepoId} onValueChange={setGithubRepoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select repo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {repos.map((repo: any) => (
                        <SelectItem key={repo._id} value={repo._id}>
                          {repo.repoFullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/* For Loom tab: disable until processed; for other tabs: require title */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || (tab === 'loom' && !loomProcessed)}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tab === 'loom' && syncToGitHub ? 'Create Ticket & Issue' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
