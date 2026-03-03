import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import { Button } from "@/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
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
import { Loader2, Plus, LayoutTemplate, Lock, Copy, Pencil, Trash2, Receipt, FileText, ScrollText } from "lucide-react";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/templates",
)({
  component: TemplatesPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Templates`,
  }),
});

const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  proposal: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  contract: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: Receipt,
  proposal: FileText,
  contract: ScrollText,
};

function TemplatesPage() {
  const navigate = useNavigate();
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

  const builtInTemplates = useConvexQuery(api.templates.getAllBuiltInTemplates);
  const customTemplates = useConvexQuery(api.templates.getCustomTemplates, orgId ? { orgId } : "skip");
  const createCustomTemplate = useMutation(api.templates.createCustomTemplate);
  const updateCustomTemplate = useMutation(api.templates.updateCustomTemplate);
  const deleteCustomTemplate = useMutation(api.templates.deleteCustomTemplate);
  const duplicateBuiltIn = useMutation(api.templates.duplicateBuiltInTemplate);

  const [activeTab, setActiveTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  // Create form
  const [newType, setNewType] = useState<"invoice" | "proposal" | "contract">("invoice");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");

  // Combine all templates
  const allTemplates = [
    ...(builtInTemplates || []),
    ...(customTemplates || []).map((t: any) => ({
      ...t,
      key: t._id,
      builtIn: false,
      preview: t.description || (t.type === "contract" ? t.content.slice(0, 120) + "..." : "Custom template"),
    })),
  ];

  const filteredTemplates = allTemplates.filter((t) =>
    activeTab === "all" ? true : t.type === activeTab,
  );

  const resetCreateForm = () => {
    setNewType("invoice");
    setNewName("");
    setNewDescription("");
    setNewContent("");
  };

  const handleCreate = async () => {
    if (!orgId || !newName || !newContent) return;
    setCreating(true);
    try {
      await createCustomTemplate({
        orgId,
        type: newType,
        name: newName,
        description: newDescription || undefined,
        content: newContent,
      });
      setCreateOpen(false);
      resetCreateForm();
    } catch (err) {
      console.error("Failed to create template:", err);
    }
    setCreating(false);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || "");
    setEditContent(template.content || "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    try {
      await updateCustomTemplate({
        templateId: editingTemplate._id,
        name: editName,
        description: editDescription || undefined,
        content: editContent,
      });
      setEditOpen(false);
    } catch (err) {
      console.error("Failed to update template:", err);
    }
  };

  const handleDelete = async (templateId: Id<"customTemplates">) => {
    try {
      await deleteCustomTemplate({ templateId });
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const handleDuplicate = async (builtInKey: string, type: "invoice" | "proposal" | "contract") => {
    if (!orgId) return;
    try {
      await duplicateBuiltIn({ orgId, type, builtInKey });
    } catch (err) {
      console.error("Failed to duplicate template:", err);
    }
  };

  const handleUseTemplate = (template: any) => {
    if (template.type === "invoice") navigate({ to: "/dashboard/invoices" });
    else if (template.type === "proposal") navigate({ to: "/dashboard/proposals" });
    else if (template.type === "contract") navigate({ to: "/dashboard/contracts" });
  };

  // Default content when switching types in create dialog
  const getDefaultContent = (type: string) => {
    if (type === "invoice") return JSON.stringify({ items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }], notes: "", dueDays: 30 });
    if (type === "proposal") return JSON.stringify({ sections: [{ title: "Services", description: "", items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }] }] });
    return "";
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
          <h1 className="text-2xl font-semibold text-foreground">Templates</h1>
          <p className="text-sm text-muted-foreground">Browse built-in templates or create your own</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Custom Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={newType}
                  onValueChange={(v) => {
                    const t = v as "invoice" | "proposal" | "contract";
                    setNewType(t);
                    setNewContent(getDefaultContent(t));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Custom Template" />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description of this template" />
              </div>

              <TemplateEditor type={newType} content={newContent} onChange={setNewContent} />

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !newName || !newContent}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({allTemplates.length})</TabsTrigger>
          <TabsTrigger value="invoice">Invoices</TabsTrigger>
          <TabsTrigger value="proposal">Proposals</TabsTrigger>
          <TabsTrigger value="contract">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {!builtInTemplates ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutTemplate className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No templates found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((t: any) => {
                const TypeIcon = TYPE_ICONS[t.type] || LayoutTemplate;
                return (
                  <div
                    key={t.key || t._id}
                    className="border rounded-lg p-4 hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <Badge className={TYPE_COLORS[t.type]} variant="secondary">
                          {t.type}
                        </Badge>
                        {t.builtIn && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <h3 className="font-medium mb-1">{t.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {t.preview || t.description || "Custom template"}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUseTemplate(t)}
                      >
                        Use Template
                      </Button>
                      {t.builtIn ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(t.key, t.type)}
                          title="Duplicate as custom"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(t._id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <TemplateEditor type={editingTemplate.type} content={editContent} onChange={setEditContent} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
