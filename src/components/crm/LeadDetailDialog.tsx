// src/components/crm/LeadDetailDialog.tsx

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { PipelineStage, LeadSource, CrmActivityType } from '~/convex/schema'
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
import { ScrollArea } from '@/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import {
  Trash2,
  Save,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  Calendar,
  StickyNote,
  Send,
  PenLine,
  X,
  Check,
} from 'lucide-react'
import { cn } from '@/utils/misc'
import { ConvertToProjectModal } from '@/components/crm/ConvertToProjectModal'

const STAGE_OPTIONS: { value: PipelineStage; label: string }[] = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'referral', label: 'Referral' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
]

const ACTIVITY_TYPE_OPTIONS: { value: CrmActivityType; label: string; icon: any }[] = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'proposal_sent', label: 'Proposal', icon: Send },
  { value: 'contract_sent', label: 'Contract', icon: FileText },
]

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: StickyNote,
  proposal_sent: Send,
  contract_sent: FileText,
  status_change: PenLine,
}

interface LeadDetailDialogProps {
  lead: any
  agents: any[]
  orgId: Id<'organizations'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailDialog({ lead, agents, orgId: _orgId, open, onOpenChange }: LeadDetailDialogProps) {
  const updateLead = useMutation(api.crm.updateLead)
  const updateLeadStage = useMutation(api.crm.updateLeadStage)
  const deleteLeadMut = useMutation(api.crm.deleteLead)
  const addActivityMut = useMutation(api.crm.addActivity)

  const activities = useQuery(
    api.crm.getLeadActivities,
    lead ? { leadId: lead._id } : 'skip',
  )

  // Edit state
  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactLinkedin, setContactLinkedin] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [stage, setStage] = useState<PipelineStage>('new_lead')
  const [source, setSource] = useState<LeadSource>('other')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [nextFollowUp, setNextFollowUp] = useState('')
  const [assignedAgent, setAssignedAgent] = useState('')
  const [tagsList, setTagsList] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [lostReason, setLostReason] = useState('')

  // Convert to project modal
  const [convertModalOpen, setConvertModalOpen] = useState(false)

  // Activity form
  const [activityType, setActivityType] = useState<CrmActivityType>('note')
  const [activityTitle, setActivityTitle] = useState('')

  useEffect(() => {
    if (lead) {
      setCompany(lead.company || '')
      setContactName(lead.contactName || '')
      setContactEmail(lead.contactEmail || '')
      setContactPhone(lead.contactPhone || '')
      setContactLinkedin(lead.contactLinkedin || '')
      setContactTitle(lead.contactTitle || '')
      setStage(lead.stage || 'new_lead')
      setSource(lead.source || 'other')
      setValue(lead.value ? String(lead.value / 100) : '')
      setDescription(lead.description || '')
      setNextStep(lead.nextStep || '')
      setNextFollowUp(lead.nextFollowUp ? new Date(lead.nextFollowUp).toISOString().split('T')[0] : '')
      setAssignedAgent(lead.assignedAgent || '')
      setTagsList(lead.tags || [])
      setNewTag('')
      setLostReason(lead.lostReason || '')
      setActivityTitle('')
    }
  }, [lead?._id])

  const hasUnsavedChanges = useMemo(() => {
    if (!lead) return false
    const tagsChanged = JSON.stringify(tagsList) !== JSON.stringify(lead.tags || [])
    return (
      company !== (lead.company || '') ||
      contactName !== (lead.contactName || '') ||
      contactEmail !== (lead.contactEmail || '') ||
      description !== (lead.description || '') ||
      tagsChanged
    )
  }, [company, contactName, contactEmail, description, tagsList, lead])

  if (!lead) return null

  const handleStageChange = async (newStage: PipelineStage) => {
    if (newStage === 'won' && !lead.projectId) {
      setConvertModalOpen(true)
      return
    }
    setStage(newStage)
    await updateLeadStage({ leadId: lead._id, stage: newStage })
  }

  const handleSave = async () => {
    const changes: Record<string, any> = {}
    if (company !== lead.company) changes.company = company
    if (contactName !== lead.contactName) changes.contactName = contactName
    if (contactEmail !== (lead.contactEmail || '')) changes.contactEmail = contactEmail || undefined
    if (contactPhone !== (lead.contactPhone || '')) changes.contactPhone = contactPhone || undefined
    if (contactLinkedin !== (lead.contactLinkedin || '')) changes.contactLinkedin = contactLinkedin || undefined
    if (contactTitle !== (lead.contactTitle || '')) changes.contactTitle = contactTitle || undefined
    if (source !== lead.source) changes.source = source
    if (description !== (lead.description || '')) changes.description = description || undefined
    if (nextStep !== (lead.nextStep || '')) changes.nextStep = nextStep || undefined
    if (lostReason !== (lead.lostReason || '')) changes.lostReason = lostReason || undefined
    const newValue = value ? Math.round(parseFloat(value) * 100) : undefined
    if (newValue !== lead.value) changes.value = newValue
    const newFollowUp = nextFollowUp ? new Date(nextFollowUp).getTime() : undefined
    if (newFollowUp !== lead.nextFollowUp) changes.nextFollowUp = newFollowUp
    if (assignedAgent !== (lead.assignedAgent || '')) changes.assignedAgent = assignedAgent || undefined
    if (JSON.stringify(tagsList) !== JSON.stringify(lead.tags || [])) changes.tags = tagsList
    if (Object.keys(changes).length > 0) {
      await updateLead({ leadId: lead._id, ...changes })
    }
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this lead and all its activities? This cannot be undone.')) return
    await deleteLeadMut({ leadId: lead._id })
    onOpenChange(false)
  }

  const handleAddActivity = async () => {
    if (!activityTitle.trim()) return
    await addActivityMut({
      leadId: lead._id,
      type: activityType,
      title: activityTitle.trim(),
    })
    setActivityTitle('')
  }

  const getAgentInfo = (agentId: string) => {
    return agents.find((a: any) => a.agentId === agentId) || { name: agentId, emoji: '👤', color: '#6B7280' }
  }

  const removeTag = (index: number) => {
    setTagsList((prev) => prev.filter((_, i) => i !== index))
  }

  const addTag = (tag: string) => {
    const trimmed = tag.trim()
    if (trimmed && !tagsList.includes(trimmed)) {
      setTagsList((prev) => [...prev, trimmed])
    }
    setNewTag('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-0">
          <DialogTitle className="sr-only">Lead Details</DialogTitle>
          {/* Company + Value header */}
          <div className="flex items-center gap-3">
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              variant="minimal"
              className="text-xl font-semibold px-0 focus-visible:ring-0 shadow-none border-b border-transparent focus-visible:border-border/50 transition-colors rounded-none flex-1"
              placeholder="Company name"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Value"
                type="number"
                className="w-24 h-8 text-sm"
              />
            </div>
          </div>
          {assignedAgent && (
            <div
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-2 w-fit"
              style={{
                backgroundColor: `${getAgentInfo(assignedAgent).color}12`,
                color: getAgentInfo(assignedAgent).color,
              }}
            >
              {getAgentInfo(assignedAgent).emoji} {getAgentInfo(assignedAgent).name}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4">
          <div className="grid grid-cols-[1fr,240px] gap-6">
            {/* LEFT: Main content */}
            <div className="space-y-5 min-w-0">
              {/* Contact Info */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Contact</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="h-8 text-sm" />
                  <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="Title / Role" className="h-8 text-sm" />
                  <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" type="email" className="h-8 text-sm" />
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className="h-8 text-sm" />
                  <Input value={contactLinkedin} onChange={(e) => setContactLinkedin(e.target.value)} placeholder="LinkedIn URL" className="col-span-2 h-8 text-sm" />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About this lead..." rows={2} className="resize-none" />
              </div>

              {/* Next Step */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Next Step</label>
                <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Schedule discovery call" className="h-8 text-sm" />
              </div>

              {/* Lost Reason */}
              {stage === 'lost' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Lost Reason</label>
                  <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this lead lost?" className="h-8 text-sm" />
                </div>
              )}

              {/* Activity Timeline */}
              <div className="space-y-3 border-t pt-4">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Activity</label>

                {/* Add activity form */}
                <div className="flex gap-2 items-center">
                  <Select value={activityType} onValueChange={(v) => setActivityType(v as CrmActivityType)}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder="Activity title..."
                    className="h-8 text-xs flex-1"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddActivity() }}
                  />
                  <Button size="sm" className="h-8" onClick={handleAddActivity} disabled={!activityTitle.trim()}>
                    Add
                  </Button>
                </div>

                {/* Timeline with vertical line */}
                <ScrollArea className="max-h-48">
                  <div className="relative pl-5">
                    {/* Vertical line */}
                    {(activities?.length ?? 0) > 0 && (
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    )}
                    <div className="space-y-1">
                      {activities?.map((activity: any) => {
                        const Icon = ACTIVITY_ICONS[activity.type] || MessageSquare
                        const actAgent = activity.agentId ? getAgentInfo(activity.agentId) : null
                        return (
                          <div key={activity._id} className="relative flex items-start gap-3 py-1.5">
                            {/* Timeline dot */}
                            <div className="absolute -left-5 top-2.5 w-[7px] h-[7px] rounded-full bg-border ring-2 ring-background" />
                            <Icon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">{activity.title}</p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground/70 mt-0.5">{activity.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground/60">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </span>
                                {actAgent && (
                                  <span className="text-[10px]" style={{ color: actAgent.color }}>
                                    {actAgent.emoji} {actAgent.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {activities?.length === 0 && (
                        <p className="text-xs italic text-muted-foreground/50 text-center py-4">No activities yet</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Metadata */}
              <div className="text-xs text-muted-foreground/70 pt-3 border-t">
                Created: {new Date(lead._creationTime).toLocaleString()}
                {lead.closedAt && ` | Closed: ${new Date(lead.closedAt).toLocaleString()}`}
              </div>
            </div>

            {/* RIGHT: Metadata sidebar */}
            <div className="space-y-5 border-l pl-6">
              {/* Stage pills (2-col grid) */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Stage</label>
                <div className="grid grid-cols-2 gap-1">
                  {STAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStageChange(opt.value)}
                      className={cn(
                        'px-2 py-1.5 rounded-md text-[11px] font-medium transition-all text-left',
                        stage === opt.value
                          ? 'bg-foreground text-background shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project linked badge */}
              {lead.projectId && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Check className="w-3 h-3" />
                  Project linked
                </div>
              )}

              {/* Source */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Source</label>
                <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agent */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Agent</label>
                <Select value={assignedAgent} onValueChange={setAssignedAgent}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: any) => (
                      <SelectItem key={agent.agentId} value={agent.agentId}>
                        {agent.emoji} {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Follow Up Date */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Follow Up</label>
                <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} className="h-8" />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tags</label>
                {tagsList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tagsList.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(i)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      e.preventDefault()
                      addTag(newTag)
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t mt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-xs text-muted-foreground/60 animate-fade-in">
                Unsaved changes
              </span>
            )}
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Convert to Project modal */}
      <ConvertToProjectModal
        lead={lead}
        orgId={_orgId}
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        onConverted={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
