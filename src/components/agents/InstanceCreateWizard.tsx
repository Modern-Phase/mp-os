import { useState } from "react"
import { useAction } from "convex/react"
import { api } from "~/convex/_generated/api"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Loader2, Plus, X } from "lucide-react"

const DEFAULT_SOUL = `# Core Truths

You are a helpful AI assistant. You demonstrate helpfulness through action, not performative politeness.

## Boundaries

- Keep private information confidential
- Request permission before external communications
- Maintain appropriate professional distance

## Vibe

Pragmatic, competent, and genuine. You're the assistant people actually want to work with.
`

interface InstanceCreateWizardProps {
  onClose: () => void
  onCreated: () => void
}

export function InstanceCreateWizard({
  onClose,
  onCreated,
}: InstanceCreateWizardProps) {
  const createInstance = useAction(api.vpsOrchestrator.createInstance)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [id, setId] = useState("")
  const [name, setName] = useState("")
  const [gatewayPort, setGatewayPort] = useState("18789")
  const [soulContent, setSoulContent] = useState(DEFAULT_SOUL)

  const handleCreate = async () => {
    if (!id || !name || !gatewayPort) {
      setError("All fields are required")
      return
    }

    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
      setError("ID must be lowercase, start with a letter, and contain only letters, numbers, and hyphens")
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      await createInstance({
        id,
        name,
        gatewayPort: parseInt(gatewayPort),
        soulContent: soulContent || undefined,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create instance")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-950 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Create New OpenClaw Instance</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 text-sm rounded">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">
              Instance ID
            </label>
            <Input
              placeholder="e.g., larry, support-bot"
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lowercase, letters/numbers/hyphens. Used as systemd service name.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Display Name
            </label>
            <Input
              placeholder="e.g., Larry, Support Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Gateway Port
            </label>
            <Input
              type="number"
              placeholder="18789"
              value={gatewayPort}
              onChange={(e) => setGatewayPort(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Each instance needs a unique port. Default is 18789.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              SOUL.md (optional)
            </label>
            <Textarea
              className="font-mono text-xs min-h-[150px]"
              placeholder="Agent personality and behavior definition..."
              value={soulContent}
              onChange={(e) => setSoulContent(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Create Instance
          </Button>
        </div>
      </div>
    </div>
  )
}
