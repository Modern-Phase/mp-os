import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Badge } from "@/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";
import { Loader2, Plus, Mail, Trash2, Zap, Play, Pause, X } from "lucide-react";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/sequences",
)({
  component: SequencesPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Email Sequences`,
  }),
});

interface Step {
  delayDays: number;
  subject: string;
  body: string;
}

const ENROLLMENT_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

function SequencesPage() {
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

  const sequences = useConvexQuery(api.emailSequences.getSequences, orgId ? { orgId } : "skip");
  const createSequence = useMutation(api.emailSequences.createSequence);
  const deleteSequence = useMutation(api.emailSequences.deleteSequence);
  const seedDefaults = useMutation(api.emailSequences.seedDefaultSequences);
  const pauseEnrollment = useMutation(api.emailSequences.pauseEnrollment);
  const cancelEnrollment = useMutation(api.emailSequences.cancelEnrollment);
  const resumeEnrollment = useMutation(api.emailSequences.resumeEnrollment);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    { delayDays: 1, subject: "", body: "" },
  ]);

  // Enrollments for selected sequence
  const enrollments = useConvexQuery(
    api.emailSequences.getEnrollments,
    selectedSequence ? { sequenceId: selectedSequence._id } : "skip",
  );

  const resetForm = () => {
    setName("");
    setSteps([{ delayDays: 1, subject: "", body: "" }]);
  };

  const handleCreate = async () => {
    if (!orgId || !name || steps.length === 0) return;
    setCreating(true);
    try {
      await createSequence({ orgId, name, steps });
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create sequence:", err);
    }
    setCreating(false);
  };

  const handleSeedDefaults = async () => {
    if (!orgId) return;
    try {
      await seedDefaults({ orgId });
    } catch (err) {
      console.error("Failed to seed defaults:", err);
    }
  };

  const updateStep = (index: number, field: keyof Step, value: string | number) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: field === "delayDays" ? Number(value) : value };
    setSteps(updated);
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
          <h1 className="text-2xl font-bold">Email Sequences</h1>
          <p className="text-muted-foreground">Automated email nurture flows for leads</p>
        </div>
        <div className="flex gap-2">
          {sequences?.length === 0 && (
            <Button variant="outline" onClick={handleSeedDefaults}>
              <Zap className="h-4 w-4 mr-2" /> Load Defaults
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Create Sequence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Email Sequence</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Sequence Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New Lead Nurture" />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Steps</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSteps([...steps, { delayDays: 3, subject: "", body: "" }])}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Step
                    </Button>
                  </div>
                  {steps.map((step, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Step {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Delay (days):</Label>
                          <Input
                            className="w-20"
                            type="number"
                            min={0}
                            value={step.delayDays}
                            onChange={(e) => updateStep(i, "delayDays", e.target.value)}
                          />
                          {steps.length > 1 && (
                            <Button variant="ghost" size="icon" onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Input
                        placeholder="Email subject"
                        value={step.subject}
                        onChange={(e) => updateStep(i, "subject", e.target.value)}
                      />
                      <Textarea
                        placeholder="Email body (use {{name}} and {{company}} for placeholders)"
                        value={step.body}
                        onChange={(e) => updateStep(i, "body", e.target.value)}
                        rows={3}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating || !name || steps.some((s) => !s.subject || !s.body)}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Sequence
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!sequences ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No email sequences yet</p>
          <p className="text-sm mt-1">Click "Load Defaults" to get started with common nurture flows</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map((seq: any) => (
            <div
              key={seq._id}
              className="rounded-lg border p-4 hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => {
                setSelectedSequence(seq);
                setDetailOpen(true);
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{seq.name}</h3>
                <Badge variant={seq.isActive ? "default" : "secondary"}>
                  {seq.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>{seq.steps?.length || 0} steps</div>
                <div>{seq.activeCount || 0} active / {seq.enrollmentCount || 0} total enrollments</div>
              </div>
              <div className="flex gap-1 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSequence({ sequenceId: seq._id });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sequence Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedSequence && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedSequence.name}
                  <Badge variant={selectedSequence.isActive ? "default" : "secondary"}>
                    {selectedSequence.isActive ? "Active" : "Inactive"}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Steps</h4>
                  <div className="space-y-2">
                    {selectedSequence.steps?.map((step: any, i: number) => (
                      <div key={i} className="border rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">Step {i + 1}: {step.subject}</span>
                          <span className="text-muted-foreground">after {step.delayDays} day{step.delayDays !== 1 ? "s" : ""}</span>
                        </div>
                        <p className="text-muted-foreground text-xs line-clamp-2">{step.body}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Enrollments ({enrollments?.length ?? 0})</h4>
                  {!enrollments ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : enrollments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leads enrolled yet. Enroll leads from the CRM.</p>
                  ) : (
                    <div className="space-y-2">
                      {enrollments.map((e: any) => (
                        <div key={e._id} className="flex items-center justify-between border rounded-lg p-2 text-sm">
                          <div>
                            <span className="font-medium">{e.leadName}</span>
                            <span className="text-muted-foreground ml-2">{e.leadCompany}</span>
                            <div className="text-xs text-muted-foreground">
                              Step {e.currentStep + 1}/{selectedSequence.steps?.length}
                              {e.nextSendAt && e.status === "active" && (
                                <span> &middot; Next: {new Date(e.nextSendAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={ENROLLMENT_COLORS[e.status]}>{e.status}</Badge>
                            {e.status === "active" && (
                              <Button variant="ghost" size="icon" onClick={() => pauseEnrollment({ enrollmentId: e._id })}>
                                <Pause className="h-3 w-3" />
                              </Button>
                            )}
                            {e.status === "paused" && (
                              <Button variant="ghost" size="icon" onClick={() => resumeEnrollment({ enrollmentId: e._id })}>
                                <Play className="h-3 w-3" />
                              </Button>
                            )}
                            {(e.status === "active" || e.status === "paused") && (
                              <Button variant="ghost" size="icon" onClick={() => cancelEnrollment({ enrollmentId: e._id })}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
