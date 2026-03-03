import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
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
  DialogFooter,
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Loader2, Plus, FileText, Send, Trash2 } from "lucide-react";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/proposals",
)({
  component: ProposalsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Proposals`,
  }),
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface SectionItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Section {
  title: string;
  description: string;
  items: SectionItem[];
}

function ProposalsPage() {
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

  const proposals = useConvexQuery(api.proposals.getProposals, orgId ? { orgId } : "skip");
  const proposalTemplates = useConvexQuery(api.proposals.getProposalTemplates);
  const customTemplates = useConvexQuery(api.templates.getCustomTemplates, orgId ? { orgId, type: "proposal" as const } : "skip");
  const createProposal = useMutation(api.proposals.createProposal);
  const createFromTemplate = useMutation(api.proposals.createProposalFromTemplate);
  const deleteProposal = useMutation(api.proposals.deleteProposal);
  const sendProposal = useMutation(api.proposals.sendProposal as any);

  const [activeTab, setActiveTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  // Create form
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [sections, setSections] = useState<Section[]>([{
    title: "Services",
    description: "",
    items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
  }]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  const filteredProposals = proposals?.filter((p: any) =>
    activeTab === "all" ? true : p.status === activeTab,
  );

  const resetForm = () => {
    setSelectedTemplate("");
    setTitle("");
    setClientName("");
    setClientEmail("");
    setSections([{ title: "Services", description: "", items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }] }]);
    setValidUntil(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
    setNotes("");
  };

  const handleCreate = async () => {
    if (!orgId || !clientName || !clientEmail) return;
    setCreating(true);
    try {
      if (selectedTemplate) {
        await createFromTemplate({
          orgId,
          templateKey: selectedTemplate,
          clientName,
          clientEmail,
          validUntil: new Date(validUntil).getTime(),
          notes: notes || undefined,
        });
      } else {
        if (!title) return;
        await createProposal({
          orgId,
          title,
          clientName,
          clientEmail,
          sections,
          currency: "usd",
          validUntil: new Date(validUntil).getTime(),
          notes: notes || undefined,
        });
      }
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create proposal:", err);
    }
    setCreating(false);
  };

  const handleSend = async (proposalId: Id<"proposals">) => {
    setSending(true);
    try {
      await sendProposal({ proposalId });
    } catch (err) {
      console.error("Failed to send proposal:", err);
    }
    setSending(false);
  };

  const handleDelete = async (proposalId: Id<"proposals">) => {
    try {
      await deleteProposal({ proposalId });
      setDetailOpen(false);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const updateSectionItem = (si: number, ii: number, field: string, value: string | number) => {
    const updated = [...sections];
    const item = { ...updated[si].items[ii] };
    if (field === "description") item.description = value as string;
    else item[field as "quantity" | "unitPrice"] = Number(value);
    if (field === "quantity" || field === "unitPrice") item.total = item.quantity * item.unitPrice;
    updated[si] = { ...updated[si], items: [...updated[si].items] };
    updated[si].items[ii] = item;
    setSections(updated);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground">Create and send proposals to clients</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Proposal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Start from Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Custom (blank) or choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom (blank)</SelectItem>
                    {proposalTemplates?.map((t: any) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name} — ${t.totalValue.toLocaleString()}
                      </SelectItem>
                    ))}
                    {customTemplates && customTemplates.length > 0 && (
                      <>
                        {customTemplates.map((t: any) => (
                          <SelectItem key={t._id} value={`custom:${t._id}`}>
                            {t.name} (Custom)
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {!selectedTemplate || selectedTemplate === "custom" ? (
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Website Redesign Proposal" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Template will auto-generate sections and pricing. You can edit after creation.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Client Name</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div>
                  <Label>Client Email</Label>
                  <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="contact@acme.com" />
                </div>
              </div>

              {(!selectedTemplate || selectedTemplate === "custom") && (
                <>
                  {sections.map((section, si) => (
                    <div key={si} className="border rounded-lg p-3 space-y-2">
                      <Input
                        placeholder="Section title"
                        value={section.title}
                        onChange={(e) => {
                          const updated = [...sections];
                          updated[si] = { ...updated[si], title: e.target.value };
                          setSections(updated);
                        }}
                      />
                      {section.items.map((item, ii) => (
                        <div key={ii} className="grid grid-cols-12 gap-2 items-center">
                          <Input className="col-span-5" placeholder="Description" value={item.description} onChange={(e) => updateSectionItem(si, ii, "description", e.target.value)} />
                          <Input className="col-span-2" type="number" value={item.quantity} onChange={(e) => updateSectionItem(si, ii, "quantity", e.target.value)} />
                          <Input className="col-span-2" type="number" value={item.unitPrice} onChange={(e) => updateSectionItem(si, ii, "unitPrice", e.target.value)} />
                          <span className="col-span-2 text-sm text-right">${item.total.toFixed(2)}</span>
                          <Button variant="ghost" size="icon" className="col-span-1" onClick={() => {
                            const updated = [...sections];
                            updated[si] = { ...updated[si], items: updated[si].items.filter((_, i) => i !== ii) };
                            setSections(updated);
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => {
                        const updated = [...sections];
                        updated[si] = { ...updated[si], items: [...updated[si].items, { description: "", quantity: 1, unitPrice: 0, total: 0 }] };
                        setSections(updated);
                      }}>
                        <Plus className="h-3 w-3 mr-1" /> Add Item
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setSections([...sections, { title: "", description: "", items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }] }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add Section
                  </Button>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valid Until</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || (!selectedTemplate && !title) || !clientName || !clientEmail}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({proposals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="viewed">Viewed</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {!proposals ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProposals?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No proposals found</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-right px-4 py-3 font-medium">Value</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Valid Until</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProposals?.map((p: any) => (
                    <tr key={p._id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium" onClick={() => { setSelectedProposal(p); setDetailOpen(true); }}>{p.title}</td>
                      <td className="px-4 py-3">
                        <div>{p.clientName}</div>
                        <div className="text-xs text-muted-foreground">{p.clientEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-right">${p.totalValue.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3">{new Date(p.validUntil).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status === "draft" && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => handleSend(p._id)} disabled={sending}>
                              <Send className="h-3 w-3 mr-1" /> Send
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(p._id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedProposal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProposal.title}
                  <Badge className={STATUS_COLORS[selectedProposal.status]}>{selectedProposal.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  For {selectedProposal.clientName} ({selectedProposal.clientEmail})
                </div>
                {selectedProposal.sections?.map((s: any, si: number) => (
                  <div key={si} className="border rounded-lg p-3">
                    <h3 className="font-medium mb-2">{s.title}</h3>
                    {s.items?.map((item: any, ii: number) => (
                      <div key={ii} className="flex justify-between text-sm py-1">
                        <span>{item.description}</span>
                        <span>${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex justify-end font-bold text-lg">
                  Total: ${selectedProposal.totalValue?.toFixed(2)}
                </div>
              </div>
              <DialogFooter>
                {selectedProposal.status === "draft" && (
                  <>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedProposal._id)}>Delete</Button>
                    <Button onClick={() => handleSend(selectedProposal._id)} disabled={sending}>
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      Send
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
