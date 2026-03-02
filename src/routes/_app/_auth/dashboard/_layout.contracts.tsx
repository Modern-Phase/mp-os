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
import { Loader2, Plus, ScrollText, Send, Trash2, Shield } from "lucide-react";
import { Switch } from "@/ui/switch";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/contracts",
)({
  component: ContractsPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Contracts`,
  }),
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  signed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function ContractsPage() {
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

  const contracts = useConvexQuery(api.contracts.getContracts, orgId ? { orgId } : "skip");
  const templates = useConvexQuery(api.contracts.getContractTemplates);
  const customTemplates = useConvexQuery(api.templates.getCustomTemplates, orgId ? { orgId, type: "contract" as const } : "skip");
  const createContract = useMutation(api.contracts.createContract);
  const createFromTemplate = useMutation(api.contracts.createContractFromTemplate);
  const deleteContract = useMutation(api.contracts.deleteContract);
  const sendContract = useMutation(api.contracts.sendContract as any);
  const isDocuSealConfigured = useConvexQuery(api.docuseal.isDocuSealConfigured);

  const [activeTab, setActiveTab] = useState("all");
  const [useDocuSeal, setUseDocuSeal] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [sending, setSending] = useState(false);

  // Create form
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredContracts = contracts?.filter((c: any) =>
    activeTab === "all" ? true : c.status === activeTab,
  );

  const resetForm = () => {
    setTitle("");
    setClientName("");
    setClientEmail("");
    setTemplateKey("");
    setContent("");
  };

  const handleCreate = async () => {
    if (!orgId || !clientName || !clientEmail) return;
    setCreating(true);
    try {
      if (templateKey && templateKey.startsWith("custom:")) {
        // Custom template — find it and use content directly
        const customId = templateKey.replace("custom:", "");
        const ct = customTemplates?.find((t: any) => t._id === customId);
        if (ct) {
          const startDate = new Date().toLocaleDateString();
          const customContent = ct.content
            .replace(/\{\{clientName\}\}/g, clientName)
            .replace(/\{\{startDate\}\}/g, startDate);
          await createContract({
            orgId,
            title: `${ct.name} — ${clientName}`,
            clientName,
            clientEmail,
            content: customContent,
          });
        }
      } else if (templateKey) {
        await createFromTemplate({
          orgId,
          templateKey,
          clientName,
          clientEmail,
        });
      } else {
        if (!title || !content) return;
        await createContract({
          orgId,
          title,
          clientName,
          clientEmail,
          content,
        });
      }
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create contract:", err);
    }
    setCreating(false);
  };

  const handleSend = async (contractId: Id<"contracts">) => {
    setSending(true);
    try {
      await sendContract({ contractId, useDocuSeal: useDocuSeal && isDocuSealConfigured });
    } catch (err) {
      console.error("Failed to send contract:", err);
    }
    setSending(false);
  };

  const handleDelete = async (contractId: Id<"contracts">) => {
    try {
      await deleteContract({ contractId });
      setDetailOpen(false);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
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
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-muted-foreground">Create, send, and track contract signatures</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Contract</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template</Label>
                <Select value={templateKey} onValueChange={setTemplateKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Start from template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((t: any) => (
                      <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Client Name</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div>
                  <Label>Client Email</Label>
                  <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="legal@acme.com" />
                </div>
              </div>
              {templateKey ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Template will auto-generate the contract with client details filled in. You can edit after creation.
                </div>
              ) : (
                <>
                  <div>
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="MSA — Acme Corp" />
                  </div>
                  <div>
                    <Label>Contract Content (Markdown)</Label>
                    <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} className="font-mono text-sm" placeholder="# Contract Title&#10;&#10;Terms and conditions..." />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || (!templateKey && !templateKey?.startsWith("custom:") && (!title || !content)) || !clientName || !clientEmail}>
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
          <TabsTrigger value="all">All ({contracts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="viewed">Viewed</TabsTrigger>
          <TabsTrigger value="signed">Signed</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {!contracts ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContracts?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No contracts found</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Template</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts?.map((c: any) => (
                    <tr key={c._id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium" onClick={() => { setSelectedContract(c); setDetailOpen(true); }}>{c.title}</td>
                      <td className="px-4 py-3">
                        <div>{c.clientName}</div>
                        <div className="text-xs text-muted-foreground">{c.clientEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={STATUS_COLORS[c.status]}>{c.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.signingMethod === "docuseal" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                            <Shield className="h-3 w-3 mr-1" /> DocuSeal
                          </Badge>
                        ) : c.templateKey || "Custom"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status === "draft" && (
                          <div className="flex gap-1 justify-end items-center">
                            {isDocuSealConfigured && (
                              <label className="flex items-center gap-1 text-xs text-muted-foreground mr-1 cursor-pointer" title="Send with DocuSeal e-signature">
                                <Switch checked={useDocuSeal} onCheckedChange={setUseDocuSeal} className="scale-75" />
                                <Shield className="h-3 w-3" />
                              </label>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleSend(c._id)} disabled={sending}>
                              <Send className="h-3 w-3 mr-1" /> Send
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(c._id)}>
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
          {selectedContract && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedContract.title}
                  <Badge className={STATUS_COLORS[selectedContract.status]}>{selectedContract.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  For {selectedContract.clientName} ({selectedContract.clientEmail})
                </div>
                <div className="rounded-lg border p-4 bg-card max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{selectedContract.content}</pre>
                </div>
                {selectedContract.signatureData && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Signed by {selectedContract.signatureData.name} on{" "}
                    {new Date(selectedContract.signatureData.agreedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <DialogFooter>
                {selectedContract.status === "draft" && (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedContract._id)}>Delete</Button>
                    <div className="flex items-center gap-2">
                      {isDocuSealConfigured && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                          <Switch checked={useDocuSeal} onCheckedChange={setUseDocuSeal} />
                          <Shield className="h-4 w-4" />
                          <span>E-Signature</span>
                        </label>
                      )}
                      <Button onClick={() => handleSend(selectedContract._id)} disabled={sending}>
                        {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        {useDocuSeal && isDocuSealConfigured ? "Send with DocuSeal" : "Send"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
