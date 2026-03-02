// src/components/crm/LeadDetailDialog.tsx

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { PipelineStage, LeadSource, CrmActivityType, CompanySize, Priority } from '~/convex/schema'
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
import { Badge } from '@/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
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
  DollarSign,
  Plus,
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

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: 'solo', label: 'Solo / Freelancer' },
  { value: 'startup', label: 'Startup (2-10)' },
  { value: 'small', label: 'Small (11-50)' },
  { value: 'medium', label: 'Medium (51-200)' },
  { value: 'enterprise', label: 'Enterprise (200+)' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  viewed: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  accepted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  signed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  expired: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
  active: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  paused: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  cancelled: 'bg-muted text-muted-foreground',
}

interface LeadDetailDialogProps {
  lead: any
  agents: any[]
  orgId: Id<'organizations'>
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailDialog({ lead, agents, orgId, open, onOpenChange }: LeadDetailDialogProps) {
  const navigate = useNavigate()
  const updateLead = useMutation(api.crm.updateLead)
  const updateLeadStage = useMutation(api.crm.updateLeadStage)
  const deleteLeadMut = useMutation(api.crm.deleteLead)
  const addActivityMut = useMutation(api.crm.addActivity)
  const enrollLeadMut = useMutation(api.emailSequences.enrollLead)

  const activities = useQuery(
    api.crm.getLeadActivities,
    lead ? { leadId: lead._id } : 'skip',
  )

  const proposals = useQuery(
    api.proposals.getProposalsByLead,
    lead ? { leadId: lead._id } : 'skip',
  )

  const contracts = useQuery(
    api.contracts.getContractsByLead,
    lead ? { leadId: lead._id } : 'skip',
  )

  const invoices = useQuery(
    api.invoices.getInvoicesByLead,
    lead ? { leadId: lead._id } : 'skip',
  )

  const enrollments = useQuery(
    api.emailSequences.getEnrollmentsByLead,
    lead ? { leadId: lead._id } : 'skip',
  )

  const sequences = useQuery(
    api.emailSequences.getSequences,
    lead ? { orgId } : 'skip',
  )

  // Edit state
  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactLinkedin, setContactLinkedin] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
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

  // New fields
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [timezone, setTimezone] = useState('')
  const [budget, setBudget] = useState('')
  const [priority, setPriority] = useState('')
  const [lastContactedAt, setLastContactedAt] = useState('')

  // Convert to project modal
  const [convertModalOpen, setConvertModalOpen] = useState(false)

  // Activity form
  const [activityType, setActivityType] = useState<CrmActivityType>('note')
  const [activityTitle, setActivityTitle] = useState('')

  // Enroll in sequence
  const [enrollSequenceId, setEnrollSequenceId] = useState('')

  // Tab state
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    if (lead) {
      setCompany(lead.company || '')
      setContactName(lead.contactName || '')
      setContactEmail(lead.contactEmail || '')
      setContactPhone(lead.contactPhone || '')
      setContactLinkedin(lead.contactLinkedin || '')
      setContactTitle(lead.contactTitle || '')
      setWebsite(lead.website || '')
      setAddress(lead.address || '')
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
      setIndustry(lead.industry || '')
      setCompanySize(lead.companySize || '')
      setTimezone(lead.timezone || '')
      setBudget(lead.budget ? String(lead.budget / 100) : '')
      setPriority(lead.priority || '')
      setLastContactedAt(lead.lastContactedAt ? new Date(lead.lastContactedAt).toISOString().split('T')[0] : '')
      setActivityTitle('')
      setEnrollSequenceId('')
    }
  }, [lead?._id])

  const hasUnsavedChanges = useMemo(() => {
    if (!lead) return false
    const tagsChanged = JSON.stringify(tagsList) !== JSON.stringify(lead.tags || [])
    return (
      company !== (lead.company || '') ||
      contactName !== (lead.contactName || '') ||
      contactEmail !== (lead.contactEmail || '') ||
      website !== (lead.website || '') ||
      address !== (lead.address || '') ||
      description !== (lead.description || '') ||
      industry !== (lead.industry || '') ||
      companySize !== (lead.companySize || '') ||
      timezone !== (lead.timezone || '') ||
      budget !== (lead.budget ? String(lead.budget / 100) : '') ||
      priority !== (lead.priority || '') ||
      lastContactedAt !== (lead.lastContactedAt ? new Date(lead.lastContactedAt).toISOString().split('T')[0] : '') ||
      tagsChanged
    )
  }, [company, contactName, contactEmail, website, address, description, tagsList, lead, industry, companySize, timezone, budget, priority, lastContactedAt])

  // Financial summary
  const financialSummary = useMemo(() => {
    const dealValue = lead?.value ? lead.value / 100 : 0
    const totalInvoiced = invoices?.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) ?? 0
    const totalPaid = invoices?.filter((inv: any) => inv.status === 'paid').reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) ?? 0
    const outstanding = totalInvoiced - totalPaid
    const acceptedProposals = proposals?.filter((p: any) => p.status === 'accepted').reduce((sum: number, p: any) => sum + (p.totalValue || 0), 0) ?? 0
    return { dealValue, totalInvoiced, totalPaid, outstanding, acceptedProposals }
  }, [lead?.value, invoices, proposals])

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
    if (website !== (lead.website || '')) changes.website = website || undefined
    if (address !== (lead.address || '')) changes.address = address || undefined
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
    // New fields
    if (industry !== (lead.industry || '')) changes.industry = industry || undefined
    if (companySize !== (lead.companySize || '')) changes.companySize = companySize || undefined
    if (timezone !== (lead.timezone || '')) changes.timezone = timezone || undefined
    const newBudget = budget ? Math.round(parseFloat(budget) * 100) : undefined
    if (newBudget !== lead.budget) changes.budget = newBudget
    if (priority !== (lead.priority || '')) changes.priority = priority || undefined
    const newLastContacted = lastContactedAt ? new Date(lastContactedAt).getTime() : undefined
    if (newLastContacted !== lead.lastContactedAt) changes.lastContactedAt = newLastContacted
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

  const handleEnrollInSequence = async () => {
    if (!enrollSequenceId) return
    await enrollLeadMut({
      sequenceId: enrollSequenceId as Id<'emailSequences'>,
      leadId: lead._id,
    })
    setEnrollSequenceId('')
  }

  const getAgentInfo = (agentId: string) => {
    return agents.find((a: any) => a.agentId === agentId) || { name: agentId, emoji: '\u{1F464}', color: '#6B7280' }
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

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              onOpenChange(false)
              navigate({ to: '/dashboard/proposals', search: { leadId: lead._id } })
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            New Proposal
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              onOpenChange(false)
              navigate({ to: '/dashboard/invoices', search: { leadId: lead._id } })
            }}
          >
            <Plus className="w-3 h-3 mr-1" />
            New Invoice
          </Button>
          <div className="flex items-center gap-1.5">
            <Select value={enrollSequenceId} onValueChange={setEnrollSequenceId}>
              <SelectTrigger className="h-7 text-xs w-40">
                <SelectValue placeholder="Enroll in sequence..." />
              </SelectTrigger>
              <SelectContent>
                {sequences?.map((seq: any) => (
                  <SelectItem key={seq._id} value={seq._id}>{seq.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {enrollSequenceId && (
              <Button size="sm" className="h-7 text-xs" onClick={handleEnrollInSequence}>
                Enroll
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-3">
          <div className="grid grid-cols-[1fr,240px] gap-6">
            {/* LEFT: Main content with tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
              <TabsList className="h-8 mb-3">
                <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">
                  Documents
                  {((proposals?.length || 0) + (contracts?.length || 0) + (invoices?.length || 0) + (enrollments?.length || 0)) > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                      {(proposals?.length || 0) + (contracts?.length || 0) + (invoices?.length || 0) + (enrollments?.length || 0)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">
                  Activity
                  {(activities?.length || 0) > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                      {activities?.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ====== DETAILS TAB ====== */}
              <TabsContent value="details" className="space-y-5 mt-0">
                {/* Contact Info */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Contact</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="h-8 text-sm text-foreground" />
                    <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="Title / Role" className="h-8 text-sm text-foreground" />
                    <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" type="email" className="h-8 text-sm text-foreground" />
                    <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className="h-8 text-sm text-foreground" />
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website URL" className="h-8 text-sm text-foreground" />
                    <Input value={contactLinkedin} onChange={(e) => setContactLinkedin(e.target.value)} placeholder="LinkedIn URL" className="h-8 text-sm text-foreground" />
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="col-span-2 h-8 text-sm text-foreground" />
                  </div>
                </div>

                {/* Company Info */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Company</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" className="h-8 text-sm text-foreground" />
                    <Select value={companySize} onValueChange={setCompanySize}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Company size" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Timezone (e.g. EST, PST)" className="h-8 text-sm text-foreground" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget" type="number" className="h-8 text-sm text-foreground flex-1" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="About this lead..." rows={2} className="resize-none" />
                </div>

                {/* Next Step */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Next Step</label>
                  <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="e.g. Schedule discovery call" className="h-8 text-sm" />
                </div>

                {/* Lost Reason */}
                {stage === 'lost' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Lost Reason</label>
                    <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this lead lost?" className="h-8 text-sm" />
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-foreground/70 pt-3 border-t">
                  Created: {new Date(lead._creationTime).toLocaleString()}
                  {lead.closedAt && ` | Closed: ${new Date(lead.closedAt).toLocaleString()}`}
                </div>
              </TabsContent>

              {/* ====== DOCUMENTS TAB ====== */}
              <TabsContent value="documents" className="space-y-5 mt-0">
                {/* Proposals */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Proposals</label>
                  {proposals && proposals.length > 0 ? (
                    <div className="space-y-1">
                      {proposals.map((p: any) => (
                        <div key={p._id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                            <span className="truncate">{p.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-foreground/70">{fmt(p.totalValue || 0)}</span>
                            <Badge variant="secondary" className={cn('text-[10px] h-5', STATUS_COLORS[p.status] || '')}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/40 italic">None</p>
                  )}
                </div>

                {/* Contracts */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Contracts</label>
                  {contracts && contracts.length > 0 ? (
                    <div className="space-y-1">
                      {contracts.map((c: any) => (
                        <div key={c._id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                            <span className="truncate">{c.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-foreground/50">{new Date(c._creationTime).toLocaleDateString()}</span>
                            <Badge variant="secondary" className={cn('text-[10px] h-5', STATUS_COLORS[c.status] || '')}>
                              {c.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/40 italic">None</p>
                  )}
                </div>

                {/* Invoices */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Invoices</label>
                  {invoices && invoices.length > 0 ? (
                    <div className="space-y-1">
                      {invoices.map((inv: any) => (
                        <div key={inv._id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <DollarSign className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                            <span className="truncate">{inv.invoiceNumber || 'Invoice'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-foreground/70">{fmt(inv.total || 0)}</span>
                            {inv.dueDate && (
                              <span className="text-[10px] text-foreground/50">Due {new Date(inv.dueDate).toLocaleDateString()}</span>
                            )}
                            <Badge variant="secondary" className={cn('text-[10px] h-5', STATUS_COLORS[inv.status] || '')}>
                              {inv.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/40 italic">None</p>
                  )}
                </div>

                {/* Email Sequences */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Email Sequences</label>
                  {enrollments && enrollments.length > 0 ? (
                    <div className="space-y-1">
                      {enrollments.map((e: any) => (
                        <div key={e._id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
                            <span className="truncate">{e.sequenceName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-foreground/70">
                              Step {e.currentStep + 1}/{e.totalSteps}
                            </span>
                            <Badge variant="secondary" className={cn('text-[10px] h-5', STATUS_COLORS[e.status] || '')}>
                              {e.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/40 italic">None</p>
                  )}
                </div>
              </TabsContent>

              {/* ====== ACTIVITY TAB ====== */}
              <TabsContent value="activity" className="space-y-3 mt-0">
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
                <ScrollArea className="max-h-[340px]">
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
                            <Icon className="w-3.5 h-3.5 mt-0.5 text-foreground/50 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">{activity.title}</p>
                              {activity.description && (
                                <p className="text-xs text-foreground/70 mt-0.5">{activity.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-foreground/50">
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
                        <p className="text-xs italic text-foreground/40 text-center py-4">No activities yet</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* RIGHT: Metadata sidebar */}
            <div className="space-y-5 border-l pl-6">
              {/* Stage pills (2-col grid) */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Stage</label>
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

              {/* Financial Summary */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Financial</label>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Deal Value</span>
                    <span className="font-medium">{fmt(financialSummary.dealValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Invoiced</span>
                    <span className="font-medium">{fmt(financialSummary.totalInvoiced)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground/60">Paid</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmt(financialSummary.totalPaid)}</span>
                  </div>
                  {financialSummary.outstanding > 0 && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Outstanding</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">{fmt(financialSummary.outstanding)}</span>
                    </div>
                  )}
                  {financialSummary.acceptedProposals > 0 && (
                    <div className="flex justify-between">
                      <span className="text-foreground/60">Accepted</span>
                      <span className="font-medium">{fmt(financialSummary.acceptedProposals)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Source */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Source</label>
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
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Agent</label>
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
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Follow Up</label>
                <Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} className="h-8" />
              </div>

              {/* Last Contacted */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Last Contacted</label>
                <Input type="date" value={lastContactedAt} onChange={(e) => setLastContactedAt(e.target.value)} className="h-8" />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-foreground/60 uppercase tracking-wider">Tags</label>
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
                          className="text-foreground/40 hover:text-destructive transition-colors"
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
              <span className="text-xs text-foreground/50 animate-fade-in">
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
        orgId={orgId}
        open={convertModalOpen}
        onOpenChange={setConvertModalOpen}
        onConverted={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
