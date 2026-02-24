import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import { useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { PIPELINE_STAGES, LEAD_SOURCES, AGENT_IDS } from '~/convex/schema'
import type { PipelineStage, LeadSource, AgentId } from '~/convex/schema'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select'
import { Input } from '@/ui/input'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'

// ── Types ──

type LeadField =
  | 'company'
  | 'contactName'
  | 'contactEmail'
  | 'contactPhone'
  | 'contactLinkedin'
  | 'contactTitle'
  | 'website'
  | 'address'
  | 'stage'
  | 'source'
  | 'value'
  | 'description'
  | 'assignedAgent'
  | 'tags'
  | '__skip__'

interface ColumnMapping {
  csvHeader: string
  field: LeadField
}

interface RowError {
  row: number
  field: string
  message: string
}

interface ParsedLead {
  company: string
  contactName: string
  contactEmail?: string
  contactPhone?: string
  contactLinkedin?: string
  contactTitle?: string
  website?: string
  address?: string
  stage?: PipelineStage
  source: LeadSource
  value?: number
  description?: string
  assignedAgent?: AgentId
  tags?: string[]
}

// ── Constants ──

const FIELD_OPTIONS: { value: LeadField; label: string }[] = [
  { value: '__skip__', label: '(Skip column)' },
  { value: 'company', label: 'Company' },
  { value: 'contactName', label: 'Contact Name' },
  { value: 'contactEmail', label: 'Email' },
  { value: 'contactPhone', label: 'Phone' },
  { value: 'contactLinkedin', label: 'LinkedIn' },
  { value: 'contactTitle', label: 'Title' },
  { value: 'website', label: 'Website' },
  { value: 'address', label: 'Address' },
  { value: 'stage', label: 'Stage' },
  { value: 'source', label: 'Source' },
  { value: 'value', label: 'Deal Value' },
  { value: 'description', label: 'Description' },
  { value: 'assignedAgent', label: 'Assigned Agent' },
  { value: 'tags', label: 'Tags' },
]

const HEADER_ALIASES: Record<string, LeadField> = {
  company: 'company',
  'company name': 'company',
  'business name': 'company',
  business: 'company',
  contact: 'contactName',
  'contact name': 'contactName',
  name: 'contactName',
  email: 'contactEmail',
  'contact email': 'contactEmail',
  phone: 'contactPhone',
  'contact phone': 'contactPhone',
  'phone number': 'contactPhone',
  linkedin: 'contactLinkedin',
  'linkedin url': 'contactLinkedin',
  title: 'contactTitle',
  'job title': 'contactTitle',
  'contact title': 'contactTitle',
  website: 'website',
  url: 'website',
  'website url': 'website',
  address: 'address',
  location: 'address',
  'street address': 'address',
  city: 'address',
  stage: 'stage',
  'pipeline stage': 'stage',
  source: 'source',
  'lead source': 'source',
  value: 'value',
  'deal value': 'value',
  amount: 'value',
  description: 'description',
  notes: 'description',
  agent: 'assignedAgent',
  'assigned agent': 'assignedAgent',
  tags: 'tags',
}

const VALID_STAGES = new Set(Object.values(PIPELINE_STAGES))
const VALID_SOURCES = new Set(Object.values(LEAD_SOURCES))
const VALID_AGENTS = new Set(Object.values(AGENT_IDS))

// ── Helpers ──

function autoDetectField(header: string): LeadField {
  const normalized = header.toLowerCase().trim()
  return HEADER_ALIASES[normalized] ?? '__skip__'
}

function validateRow(
  row: Record<string, string>,
  mappings: ColumnMapping[],
  rowIndex: number,
  defaults: Record<string, string> = {},
): { lead: ParsedLead | null; errors: RowError[] } {
  const errors: RowError[] = []
  const mapped: Record<string, any> = {}

  // Apply defaults first, then override with CSV values
  for (const [key, val] of Object.entries(defaults)) {
    if (val.trim()) mapped[key] = val.trim()
  }

  for (const mapping of mappings) {
    if (mapping.field === '__skip__') continue
    const rawValue = row[mapping.csvHeader]?.trim() ?? ''
    if (!rawValue) continue
    mapped[mapping.field] = rawValue
  }

  // Smart fallbacks for missing required fields
  if (!mapped.contactName && mapped.company) {
    mapped.contactName = mapped.company
  }
  if (!mapped.source) {
    mapped.source = 'other'
  }

  // Required fields
  if (!mapped.company) {
    errors.push({ row: rowIndex, field: 'company', message: 'Company is required' })
  }
  if (!mapped.contactName) {
    errors.push({ row: rowIndex, field: 'contactName', message: 'Contact name is required' })
  }
  if (!VALID_SOURCES.has(mapped.source as LeadSource)) {
    errors.push({
      row: rowIndex,
      field: 'source',
      message: `Invalid source: "${mapped.source}". Valid: ${[...VALID_SOURCES].join(', ')}`,
    })
  }

  // Optional enum validations
  if (mapped.stage && !VALID_STAGES.has(mapped.stage as PipelineStage)) {
    errors.push({
      row: rowIndex,
      field: 'stage',
      message: `Invalid stage: "${mapped.stage}". Valid: ${[...VALID_STAGES].join(', ')}`,
    })
  }
  if (mapped.assignedAgent && !VALID_AGENTS.has(mapped.assignedAgent as AgentId)) {
    errors.push({
      row: rowIndex,
      field: 'assignedAgent',
      message: `Invalid agent: "${mapped.assignedAgent}". Valid: ${[...VALID_AGENTS].join(', ')}`,
    })
  }
  if (mapped.value && isNaN(Number(mapped.value))) {
    errors.push({
      row: rowIndex,
      field: 'value',
      message: `Invalid value: "${mapped.value}" (must be a number)`,
    })
  }

  if (errors.length > 0) return { lead: null, errors }

  const lead: ParsedLead = {
    company: mapped.company,
    contactName: mapped.contactName,
    source: mapped.source as LeadSource,
  }
  if (mapped.contactEmail) lead.contactEmail = mapped.contactEmail
  if (mapped.contactPhone) lead.contactPhone = mapped.contactPhone
  if (mapped.contactLinkedin) lead.contactLinkedin = mapped.contactLinkedin
  if (mapped.contactTitle) lead.contactTitle = mapped.contactTitle
  if (mapped.website) lead.website = mapped.website
  if (mapped.address) lead.address = mapped.address
  if (mapped.stage) lead.stage = mapped.stage as PipelineStage
  if (mapped.value) lead.value = Math.round(Number(mapped.value) * 100) // dollars → cents
  if (mapped.description) lead.description = mapped.description
  if (mapped.assignedAgent) lead.assignedAgent = mapped.assignedAgent as AgentId
  if (mapped.tags) lead.tags = mapped.tags.split(',').map((t: string) => t.trim()).filter(Boolean)

  return { lead, errors: [] }
}

// ── Component ──

type Step = 'upload' | 'preview' | 'result'

export function CsvImportDialog({
  orgId,
  agents,
}: {
  orgId: Id<'organizations'>
  agents: any[]
}) {
  const importLeads = useMutation(api.crm.importLeads)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [validLeads, setValidLeads] = useState<ParsedLead[]>([])
  const [allErrors, setAllErrors] = useState<RowError[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [defaults, setDefaults] = useState<Record<string, string>>({})

  const reset = useCallback(() => {
    setStep('upload')
    setFileName('')
    setCsvHeaders([])
    setCsvRows([])
    setMappings([])
    setValidLeads([])
    setAllErrors([])
    setImporting(false)
    setImportResult(null)
    setDragOver(false)
    setDefaults({})
  }, [])

  const handleOpenChange = useCallback((val: boolean) => {
    setOpen(val)
    if (!val) reset()
  }, [reset])

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (!text) return

      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      })

      if (!result.meta.fields || result.meta.fields.length === 0) return

      const headers = result.meta.fields
      const rows = result.data
      const autoMappings: ColumnMapping[] = headers.map((h) => ({
        csvHeader: h,
        field: autoDetectField(h),
      }))

      setCsvHeaders(headers)
      setCsvRows(rows)
      setMappings(autoMappings)
      setDefaults({})

      // Run initial validation
      runValidation(rows, autoMappings, {})
      setStep('preview')
    }
    reader.readAsText(file)
  }, [])

  const runValidation = useCallback(
    (rows: Record<string, string>[], currentMappings: ColumnMapping[], currentDefaults: Record<string, string>) => {
      const leads: ParsedLead[] = []
      const errors: RowError[] = []

      for (let i = 0; i < rows.length; i++) {
        const { lead, errors: rowErrors } = validateRow(rows[i], currentMappings, i + 1, currentDefaults)
        if (lead) {
          leads.push(lead)
        }
        errors.push(...rowErrors)
      }

      setValidLeads(leads)
      setAllErrors(errors)
    },
    [],
  )

  const updateMapping = useCallback(
    (csvHeader: string, field: LeadField) => {
      const updated = mappings.map((m) =>
        m.csvHeader === csvHeader ? { ...m, field } : m,
      )
      setMappings(updated)
      runValidation(csvRows, updated, defaults)
    },
    [mappings, csvRows, defaults, runValidation],
  )

  const updateDefault = useCallback(
    (field: string, value: string) => {
      const updated = { ...defaults, [field]: value }
      setDefaults(updated)
      runValidation(csvRows, mappings, updated)
    },
    [defaults, csvRows, mappings, runValidation],
  )

  const handleImport = useCallback(async () => {
    if (validLeads.length === 0) return
    setImporting(true)
    try {
      const result = await importLeads({ orgId, leads: validLeads })
      setImportResult({
        imported: result.imported,
        updated: result.updated,
        skipped: csvRows.length - validLeads.length,
      })
      setStep('result')
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setImporting(false)
    }
  }, [validLeads, csvRows.length, orgId, importLeads])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
    },
    [processFile],
  )

  const previewRows = csvRows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Leads from CSV'}
            {step === 'preview' && 'Map Columns & Preview'}
            {step === 'result' && 'Import Complete'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drag and drop a CSV file, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Required columns: Company, Contact Name, Source
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}

        {/* Step 2: Preview & Map */}
        {step === 'preview' && (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            {/* File info */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">
                  ({csvRows.length} row{csvRows.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="default" className="bg-green-600">
                  {validLeads.length} valid
                </Badge>
                {allErrors.length > 0 && (
                  <Badge variant="destructive">
                    {csvRows.length - validLeads.length} with errors
                  </Badge>
                )}
              </div>
            </div>

            {/* Column mappings */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Column Mapping
              </p>
              <div className="grid grid-cols-2 gap-2">
                {mappings.map((m) => (
                  <div
                    key={m.csvHeader}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="truncate w-28 text-muted-foreground" title={m.csvHeader}>
                      {m.csvHeader}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={m.field}
                      onValueChange={(v) => updateMapping(m.csvHeader, v as LeadField)}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Default values for unmapped required fields */}
            {(() => {
              const mappedFields = new Set(mappings.filter(m => m.field !== '__skip__').map(m => m.field))
              const missingRequired: { field: string; label: string; type: 'text' | 'select' }[] = []
              if (!mappedFields.has('company')) missingRequired.push({ field: 'company', label: 'Company', type: 'text' })
              if (!mappedFields.has('contactName')) missingRequired.push({ field: 'contactName', label: 'Contact Name', type: 'text' })
              if (!mappedFields.has('source')) missingRequired.push({ field: 'source', label: 'Source', type: 'select' })
              if (missingRequired.length === 0) return null
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Default Values <span className="normal-case font-normal">(for unmapped required fields)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {missingRequired.map(({ field, label, type }) => (
                      <div key={field} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-28 truncate">{label}</span>
                        {type === 'select' ? (
                          <Select
                            value={defaults[field] || ''}
                            onValueChange={(v) => updateDefault(field, v)}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Select default..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(LEAD_SOURCES).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="h-8 text-xs flex-1"
                            placeholder={`Default ${label.toLowerCase()}...`}
                            value={defaults[field] || ''}
                            onChange={(e) => updateDefault(field, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Preview table */}
            <div className="min-h-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Preview (first {previewRows.length} rows)
              </p>
              <ScrollArea className="border rounded-md max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">
                        #
                      </th>
                      {mappings
                        .filter((m) => m.field !== '__skip__')
                        .map((m) => (
                          <th
                            key={m.csvHeader}
                            className="px-2 py-1.5 text-left font-medium text-muted-foreground"
                          >
                            {FIELD_OPTIONS.find((f) => f.value === m.field)?.label ?? m.field}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const rowErrors = allErrors.filter((e) => e.row === i + 1)
                      const errorFields = new Set(rowErrors.map((e) => e.field))
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                          {mappings
                            .filter((m) => m.field !== '__skip__')
                            .map((m) => {
                              const hasError = errorFields.has(m.field)
                              const val = row[m.csvHeader] ?? ''
                              return (
                                <td
                                  key={m.csvHeader}
                                  className={`px-2 py-1.5 max-w-[120px] truncate ${
                                    hasError ? 'text-red-600 dark:text-red-400' : ''
                                  }`}
                                  title={
                                    hasError
                                      ? rowErrors.find((e) => e.field === m.field)?.message
                                      : val
                                  }
                                >
                                  {val}
                                  {hasError && (
                                    <AlertCircle className="inline w-3 h-3 ml-1" />
                                  )}
                                </td>
                              )
                            })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </div>

            {/* Errors summary */}
            {allErrors.length > 0 && (
              <ScrollArea className="max-h-24 border border-red-200 dark:border-red-900 rounded-md bg-red-50 dark:bg-red-950/30 p-2">
                <div className="space-y-1">
                  {allErrors.slice(0, 20).map((err, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">
                      Row {err.row}: {err.message}
                    </p>
                  ))}
                  {allErrors.length > 20 && (
                    <p className="text-xs text-red-500">
                      ...and {allErrors.length - 20} more errors
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="w-4 h-4 mr-1" />
                Start Over
              </Button>
              <Button
                size="sm"
                disabled={validLeads.length === 0 || importing}
                onClick={handleImport}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validLeads.length} Lead{validLeads.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && importResult && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
            <div>
              <p className="text-lg font-semibold">
                {importResult.imported > 0 && (
                  <>Imported {importResult.imported} new lead{importResult.imported !== 1 ? 's' : ''}</>
                )}
                {importResult.imported > 0 && importResult.updated > 0 && ', '}
                {importResult.updated > 0 && (
                  <>updated {importResult.updated} existing</>
                )}
                {importResult.imported === 0 && importResult.updated === 0 && 'No changes'}
              </p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {importResult.skipped} row{importResult.skipped !== 1 ? 's' : ''} skipped due to
                  errors
                </p>
              )}
            </div>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
