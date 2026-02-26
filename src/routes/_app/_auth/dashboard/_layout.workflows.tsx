import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Badge } from "@/ui/badge";
import { Switch } from "@/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Loader2, Plus, GitBranch, Trash2, Zap } from "lucide-react";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/workflows",
)({
  component: WorkflowsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Workflows`,
  }),
});

const TRIGGER_LABELS: Record<string, string> = {
  stage_change: "Lead Stage Change",
  project_status_change: "Project Status Change",
  invoice_status_change: "Invoice Status Change",
  proposal_status_change: "Proposal Status Change",
  contract_status_change: "Contract Status Change",
  manual: "Manual",
};

const ACTION_LABELS: Record<string, string> = {
  create_invoice: "Create Invoice",
  create_proposal: "Create Proposal",
  create_contract: "Create Contract",
  send_email: "Send Email",
  create_task: "Create Task",
  update_stage: "Update Stage",
};

const TRIGGER_COLORS: Record<string, string> = {
  stage_change: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  project_status_change: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  invoice_status_change: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  proposal_status_change: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  contract_status_change: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  manual: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

function WorkflowsPage() {
  const currentUser = useConvexQuery(api.app.getCurrentUser);
  const orgId = currentUser?.memberships?.[0]?.orgId as Id<"organizations"> | undefined;

  const ensurePersonalOrg = useMutation(api.organizations.ensurePersonalOrg);
  const [orgEnsured, setOrgEnsured] = useState(false);
  useEffect(() => {
    if (currentUser && !orgId && !orgEnsured) {
      setOrgEnsured(true);
      ensurePersonalOrg().catch(console.error);
    }
  }, [currentUser, orgId, orgEnsured, ensurePersonalOrg]);

  const rules = useConvexQuery(api.workflows.getWorkflowRules, orgId ? { orgId } : "skip");
  const createRule = useMutation(api.workflows.createWorkflowRule);
  const deleteRule = useMutation(api.workflows.deleteWorkflowRule);
  const toggleRule = useMutation(api.workflows.toggleWorkflowRule);
  const seedDefaults = useMutation(api.workflows.seedDefaultRules);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [conditionKey, setConditionKey] = useState("");
  const [conditionValue, setConditionValue] = useState("");
  const [actionType, setActionType] = useState("");
  const [actionConfig, setActionConfig] = useState("");

  const resetForm = () => {
    setName("");
    setTrigger("");
    setConditionKey("");
    setConditionValue("");
    setActionType("");
    setActionConfig("");
  };

  const handleCreate = async () => {
    if (!orgId || !name || !trigger || !actionType) return;
    setCreating(true);
    try {
      const conditions: Record<string, string> = {};
      if (conditionKey && conditionValue) {
        conditions[conditionKey] = conditionValue;
      }

      let config: any = {};
      if (actionConfig) {
        try { config = JSON.parse(actionConfig); } catch { config = {}; }
      }

      await createRule({
        orgId,
        name,
        trigger: trigger as any,
        conditions,
        actions: [{ type: actionType as any, config }],
      });
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create rule:", err);
    }
    setCreating(false);
  };

  const handleSeedDefaults = async () => {
    if (!orgId) return;
    try {
      const count = await seedDefaults({ orgId });
      if (count === 0) {
        // Already seeded
      }
    } catch (err) {
      console.error("Failed to seed defaults:", err);
    }
  };

  const getConditionSummary = (conditions: any) => {
    if (!conditions) return "Always";
    const parts: string[] = [];
    if (conditions.toStage) parts.push(`to: ${conditions.toStage}`);
    if (conditions.fromStage) parts.push(`from: ${conditions.fromStage}`);
    if (conditions.projectStatus) parts.push(`status: ${conditions.projectStatus}`);
    if (conditions.invoiceStatus) parts.push(`status: ${conditions.invoiceStatus}`);
    if (conditions.proposalStatus) parts.push(`status: ${conditions.proposalStatus}`);
    if (conditions.contractStatus) parts.push(`status: ${conditions.contractStatus}`);
    return parts.length > 0 ? parts.join(", ") : "Always";
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">Automate actions when events occur in your pipeline</p>
        </div>
        <div className="flex gap-2">
          {rules?.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              <Zap className="h-4 w-4 mr-2" /> Load Defaults
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Workflow Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-create proposal on PROPOSAL stage" />
                </div>
                <div>
                  <Label>Trigger</Label>
                  <Select value={trigger} onValueChange={setTrigger}>
                    <SelectTrigger>
                      <SelectValue placeholder="When..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Condition Field</Label>
                    <Input value={conditionKey} onChange={(e) => setConditionKey(e.target.value)} placeholder="e.g., toStage" />
                  </div>
                  <div>
                    <Label>Condition Value</Label>
                    <Input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} placeholder="e.g., proposal" />
                  </div>
                </div>
                <div>
                  <Label>Action</Label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Then..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Action Config (JSON, optional)</Label>
                  <Input value={actionConfig} onChange={(e) => setActionConfig(e.target.value)} placeholder='{"templateKey": "msa"}' />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating || !name || !trigger || !actionType}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Rule
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!rules ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No workflow rules yet</p>
          <p className="text-sm mt-1">Click "Load Defaults" to get started with common automations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule: any) => (
            <div
              key={rule._id}
              className="rounded-lg border p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{rule.name}</span>
                  <Badge className={TRIGGER_COLORS[rule.trigger] || "bg-gray-100"}>
                    {TRIGGER_LABELS[rule.trigger] || rule.trigger}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>When: {getConditionSummary(rule.conditions)}</span>
                  <span>Then: {rule.actions?.map((a: any) => ACTION_LABELS[a.type] || a.type).join(", ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={(checked) => toggleRule({ ruleId: rule._id, isActive: checked })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRule({ ruleId: rule._id })}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
