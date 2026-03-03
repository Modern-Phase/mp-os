// src/components/agents/TaskAttachments.tsx

import { useState, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '~/convex/_generated/api'
import { Id } from '~/convex/_generated/dataModel'
import { Button } from '@/ui/button'
import { Upload, FileText, Image, FileSpreadsheet, Film, Music, Trash2, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/utils/misc'

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  pdf: FileText,
  csv: FileSpreadsheet,
  image: Image,
  audio: Music,
  video: Film,
}

const STATUS_INDICATORS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
  processing: { icon: Loader2, color: 'text-amber-500', label: 'Processing' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Indexed' },
  failed: { icon: AlertCircle, color: 'text-red-500', label: 'Failed' },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getMimeType(file: File): string {
  return file.type || 'application/octet-stream'
}

function getDocType(mimeType: string): 'text' | 'pdf' | 'csv' | 'image' | 'audio' | 'video' {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'text/csv') return 'csv'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return 'text'
}

interface TaskAttachmentsProps {
  taskId: Id<'agentTasks'>
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const attachments = useQuery(api.agents.getTaskAttachments, { taskId })
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl)
  const uploadAttachment = useMutation(api.agents.uploadTaskAttachment)
  const removeAttachment = useMutation(api.agents.removeDocumentFromTask)

  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // 1. Get upload URL
      const uploadUrl = await generateUploadUrl()

      // 2. Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const { storageId } = await result.json()

      // 3. Create document + link to task
      const mimeType = getMimeType(file)
      await uploadAttachment({
        taskId,
        name: file.name,
        type: getDocType(mimeType),
        storageId,
        fileSize: file.size,
        mimeType,
      })
    } catch (err) {
      console.error('Failed to upload attachment:', err)
    }
    setUploading(false)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemove = async (documentId: Id<'documents'>) => {
    await removeAttachment({ taskId, documentId })
  }

  return (
    <div className="space-y-3">
      {/* Upload button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
          accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp3,.wav,.mp4,.webm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {uploading ? 'Uploading...' : 'Attach File'}
        </Button>
      </div>

      {/* Attachments list */}
      {!attachments ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 py-4 text-center">
          No attachments yet
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((doc: any) => {
            const TypeIcon = TYPE_ICONS[doc.type] || FileText
            const statusInfo = STATUS_INDICATORS[doc.processingStatus] || STATUS_INDICATORS.pending
            const StatusIcon = statusInfo.icon

            return (
              <div
                key={doc._id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <TypeIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                    </span>
                    <span className={cn('flex items-center gap-1 text-[11px]', statusInfo.color)}>
                      <StatusIcon className={cn('w-3 h-3', doc.processingStatus === 'processing' && 'animate-spin')} />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(doc._id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
