import { useState, useEffect, useCallback } from "react"
import { useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { ScrollArea } from "@/ui/scroll-area"
import { Loader2, Pencil, Save, X, FileText } from "lucide-react"

interface SoulEditorProps {
  instanceId: string
  agentName: string
}

export function SoulEditor({ instanceId, agentName }: SoulEditorProps) {
  const [content, setContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getSoul = useAction(api.vpsOrchestrator.getSoul)
  const updateSoul = useAction(api.vpsOrchestrator.updateSoul)

  const loadSoul = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getSoul({ instanceId })
      setContent(data.content || "")
      setOriginalContent(data.content || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SOUL.md")
    } finally {
      setIsLoading(false)
    }
  }, [getSoul, instanceId])

  useEffect(() => {
    loadSoul()
  }, [loadSoul])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await updateSoul({ instanceId, content })
      setOriginalContent(content)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setContent(originalContent)
    setIsEditing(false)
  }

  const hasChanges = content !== originalContent

  return (
    <div className="h-full flex flex-col rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-base font-semibold">
            SOUL.md — {agentName}
          </h3>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Content — fills remaining height */}
      <div className="flex-1 min-h-0 p-5">
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEditing ? (
          <Textarea
            className="font-mono text-sm h-full resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <ScrollArea className="h-full">
            {content ? (
              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {content}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <FileText className="h-7 w-7 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-foreground/70 mb-1">
                  No SOUL.md found
                </p>
                <p className="text-xs text-muted-foreground/60 mb-3">
                  Define this agent's personality, goals, and behavior
                </p>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Create SOUL.md
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
