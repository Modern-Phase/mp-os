// src/components/crm/LeadDetailDialog.tsx

import { useState, useEffect } from 'react'
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
import { Badge } from '@/ui/badge'
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
} from 'lucide-react'

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
  { value: 'proposal_sent', label: 'Proposal Sent', icon: Send },
  { value: 'contract_sent', label: 'Contract Sent', icon: FileText },
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
  const [tags, setTags] = useState('')
  const [lostReason, setLostReason] = useState('')

  // Activity form
  const [activityType, setActivityType] = useState<CrmActivityType>('note')
  const [activityTitle, setActivityTitle] = useState('')
  const [activityDesc, setActivityDesc] = useState('')

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
      setTags((lead.tags || []).join(', '))
      setLostReason(lead.lostReason || '')
      setActivityTitle('')
      setActivityDesc('')
    }
  }, [lead?._id])

  if (!lead) return null

  const handleStageChange = async (newStage: string) => {
    setStage(newStage as PipelineStage)
    await updateLeadStage({ leadId: lead._id, stage: newStage as PipelineStage })
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

    if (assignedAgent !== (lead.assignedAgent || '')) {
      changes.assignedAgent = assignedAgent || undefined
    }

    const newTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    if (JSON.stringify(newTags) !== JSON.stringify(lead.tags || [])) changes.tags = newTags

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
      description: activityDesc.trim() || undefined,
    })
    setActivityTitle('')
    setActivityDesc('')
  }

  const getAgentInfo = (agentId: string) => {
    return agents.find((a: any) => a.agentId === agentId) || { name: agentId, emoji: '👤', color: '#6B7280' }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Lead Details</DialogTitle>
          <div className="space-y-3">
            {/* Company + Stage */}
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="text-lg font-semibold border-none px-0 focus-visible:ring-0 shadow-none flex-1"
                placeholder="Company name"
              />
              <Select value={stage} onValueChange={handleStageChange}>
                <SelectTrigger className="w-auto h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Deal value"
                type="number"
                className="w-32 h-8"
              />
              {assignedAgent && (
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${getAgentInfo(assignedAgent).color}15`,
                    color: getAgentInfo(assignedAgent).color,
                  }}
                >
                  {getAgentInfo(assignedAgent).emoji} {getAgentInfo(assignedAgent).name}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" />
              <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="Title / Role" />
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" type="email" />
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" />
              <Input value={contactLinkedin} onChange={(e) => setContactLinkedin(e.target.value)} placeholder="LinkedIn URL" className="col-span-2" />
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Source</label>
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned Agent</label>
              <Select value={assignedAgent} onValueChange={setAssignedAgent}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.agentId} value={agent.agentId}>
                      {agent.emoji} {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About this lead..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Step</label>
              <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Schedule discovery call" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Follow Up Date</label>
              <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tags</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma-separated tags..." />
            {tags && (
              <div className="flex gap-1 flex-wrap">
                {tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Lost Reason */}
          {stage === 'lost' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Lost Reason</label>
              <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this lead lost?" />
            </div>
          )}

          {/* Activity Timeline */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activity Timeline</h3>

            {/* Add activity form */}
            <div className="flex gap-2 items-start">
              <Select value={activityType} onValueChange={(v) => setActivityType(v as CrmActivityType)}>
                <SelectTrigger className="w-36 h-8 text-xs">
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

            {/* Timeline */}
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {activities?.map((activity: any) => {
                  const Icon = ACTIVITY_ICONS[activity.type] || MessageSquare
                  const actAgent = activity.agentId ? getAgentInfo(activity.agentId) : null
                  return (
                    <div key={activity._id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">
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
                  <p className="text-xs italic text-muted-foreground text-center py-4">No activities yet</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Created: {new Date(lead._creationTime).toLocaleString()}
            {lead.closedAt && ` | Closed: ${new Date(lead.closedAt).toLocaleString()}`}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between mt-4">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
