import { useState, useEffect, useCallback } from "react"
import { useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { ScrollArea } from "@/ui/scroll-area"
import { Loader2, Pencil, Save, X } from "lucide-react"

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">
          SOUL.md — {agentName}
        </CardTitle>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Save className="w-3 h-3 mr-1" />
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
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs rounded">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEditing ? (
          <Textarea
            className="font-mono text-sm min-h-[400px] h-full resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        ) : (
          <ScrollArea className="h-[400px]">
            {content ? (
              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                {content}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No SOUL.md found. Click Edit to create one.
              </p>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
