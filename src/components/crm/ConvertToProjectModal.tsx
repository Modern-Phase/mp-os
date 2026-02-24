// src/components/crm/ConvertToProjectModal.tsx

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { QUICK_WIN_TEMPLATES } from '~/convex/quickWinTemplates'
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
import { Loader2, FolderPlus, Check, Zap } from 'lucide-react'
import { cn } from '@/utils/misc'

// Agent emoji lookup (matches AGENT_DEFINITIONS in convex/agents.ts)
const AGENT_EMOJI: Record<string, string> = {
  larry: '🤖', lexi: '📧', maya: '📊', oliver: '📋',
  sam: '📅', fiona: '💵', carl: '🤝', taylor: '⚡', dana: '🎨',
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-blue-500',
  low: 'text-muted-foreground',
}

interface ConvertToProjectModalProps {
  lead: any
  orgId: Id<'organizations'>
  open: boolean
  onOpenChange: (open: boolean) => void
  onConverted?: (projectId: string) => void
}

export function ConvertToProjectModal({
  lead,
  orgId,
  open,
  onOpenChange,
  onConverted,
}: ConvertToProjectModalProps) {
  const templates = useQuery(api.projectTemplates.getProjectTemplates, orgId ? { orgId } : 'skip')
  const convertMutation = useMutation(api.crm.convertLeadToProject)

  const [projectName, setProjectName] = useState('')
  const [client, setClient] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedQuickWin, setSelectedQuickWin] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  // Pre-fill from lead when modal opens
  useEffect(() => {
    if (lead && open) {
      setProjectName(lead.company || '')
      setClient(lead.company || '')
      setDescription(lead.description || '')
      setTargetDate('')
      setSelectedTemplateId(null)
      setSelectedQuickWin(null)
      setIsConverting(false)
    }
  }, [lead?._id, open])

  const selectedTemplate = selectedTemplateId
    ? templates?.find((t: any) => t._id === selectedTemplateId)
    : null

  const taskCount = selectedTemplate?.taskTemplates?.length ?? 0

  const formatValue = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100)

  const handleConvert = async () => {
    if (!lead || !projectName.trim() || !client.trim()) return
    setIsConverting(true)
    try {
      const projectId = await convertMutation({
        leadId: lead._id,
        projectName: projectName.trim(),
        client: client.trim(),
        description: description.trim(),
        targetDate: targetDate ? new Date(targetDate).getTime() : Date.now() + 90 * 86400000,
        templateId: selectedTemplateId ? (selectedTemplateId as Id<'projectTemplates'>) : undefined,
        quickWinTemplateId: selectedQuickWin || undefined,
      })
      onOpenChange(false)
      onConverted?.(projectId)
    } catch (err) {
      console.error('Failed to convert lead:', err)
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="w-5 h-5" />
            Convert to Project
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1fr,240px] gap-6">
            {/* LEFT: Project form */}
            <div className="space-y-4">
              {/* Deal value pill */}
              {lead?.value && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  {formatValue(lead.value)}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Project Name
                </label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Acme Corp Website"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Client
                </label>
                <Input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Client company name"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Description
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Project scope and goals..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Target Date
                </label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* RIGHT: Template sidebar */}
            <div className="space-y-3 border-l pl-5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Start from template
              </label>

              {/* Template pills */}
              <div className="space-y-1.5">
                {/* Blank project option */}
                <button
                  onClick={() => setSelectedTemplateId(null)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-all border',
                    !selectedTemplateId
                      ? 'bg-foreground text-background border-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted',
                  )}
                >
                  <div className="font-medium">Blank Project</div>
                  <div className="text-[10px] opacity-70">No tasks</div>
                </button>

                {templates?.map((template: any) => (
                  <button
                    key={template._id}
                    onClick={() => setSelectedTemplateId(template._id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-all border',
                      selectedTemplateId === template._id
                        ? 'bg-foreground text-background border-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      {template.icon && <span>{template.icon}</span>}
                      {template.name}
                    </div>
                    <div className="text-[10px] opacity-70">
                      {template.taskTemplates.length} tasks
                    </div>
                  </button>
                ))}
              </div>

              {/* Task preview when template selected */}
              {selectedTemplate && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Tasks Preview
                  </label>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {selectedTemplate.taskTemplates.map((task: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-muted/30 text-xs"
                        >
                          <span className="shrink-0 mt-px">
                            {AGENT_EMOJI[task.agentId] || '👤'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium leading-tight truncate">
                              {task.title}
                            </p>
                            <span className={cn('text-[10px]', PRIORITY_COLORS[task.priority])}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {/* Quick Win Picker */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Quick Win (optional)
              </label>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {QUICK_WIN_TEMPLATES.map((qw) => (
                <button
                  key={qw.id}
                  onClick={() => setSelectedQuickWin(selectedQuickWin === qw.id ? null : qw.id)}
                  className={cn(
                    'shrink-0 text-left px-3 py-2.5 rounded-lg text-xs transition-all border w-[160px]',
                    selectedQuickWin === qw.id
                      ? 'bg-amber-500/10 border-amber-500 text-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-muted-foreground/20',
                  )}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>{qw.icon}</span>
                    {qw.name}
                  </div>
                  <div className="mt-1 text-[10px] opacity-70 flex items-center gap-1.5">
                    <span>{qw.agentEmoji} {qw.agentId}</span>
                    <span>·</span>
                    <span>{qw.estimatedHours}h</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t mt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConvert}
            disabled={isConverting || !projectName.trim() || !client.trim()}
          >
            {isConverting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Create Project{taskCount > 0 ? ` & ${taskCount} Tasks` : ''}{selectedQuickWin ? ' + Quick Win' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
