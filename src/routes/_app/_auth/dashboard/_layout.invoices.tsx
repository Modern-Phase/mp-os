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
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { InvoiceDetailDialog } from "@/components/invoices/InvoiceDetailDialog";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/invoices",
)({
  component: InvoicesPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Invoices`,
  }),
});

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

function InvoicesPage() {
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

  const invoices = useConvexQuery(api.invoices.getInvoices, orgId ? { orgId } : "skip");
  const invoiceTemplates = useConvexQuery(api.invoices.getInvoiceTemplates);
  const customTemplates = useConvexQuery(api.templates.getCustomTemplates, orgId ? { orgId, type: "invoice" as const } : "skip");
  const createInvoice = useMutation(api.invoices.createInvoice);
  const createFromTemplate = useMutation(api.invoices.createInvoiceFromTemplate);

  const [activeTab, setActiveTab] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Create form state
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredInvoices = invoices?.filter((inv: any) =>
    activeTab === "all" ? true : inv.status === activeTab,
  );

  const resetForm = () => {
    setSelectedTemplate("");
    setClientName("");
    setClientEmail("");
    setItems([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
    setTaxRate(0);
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
    setNotes("");
  };

  const handleCreate = async () => {
    if (!orgId || !clientName || !clientEmail) return;
    setCreating(true);
    try {
      if (selectedTemplate && selectedTemplate !== "custom") {
        await createFromTemplate({
          orgId,
          templateKey: selectedTemplate,
          clientName,
          clientEmail,
          taxRate: taxRate || undefined,
          notes: notes || undefined,
        });
      } else {
        await createInvoice({
          orgId,
          clientName,
          clientEmail,
          items: items.filter((i) => i.description),
          taxRate: taxRate || undefined,
          currency: "usd",
          dueDate: new Date(dueDate).getTime(),
          notes: notes || undefined,
        });
      }
      setCreateOpen(false);
      resetForm();
    } catch (err) {
      console.error("Failed to create invoice:", err);
    }
    setCreating(false);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    if (field === "description") {
      item.description = value as string;
    } else {
      item[field] = Number(value);
    }
    if (field === "quantity" || field === "unitPrice") {
      item.total = item.quantity * item.unitPrice;
    }
    updated[index] = item;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
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
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage and send invoices to clients</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Invoice</DialogTitle>
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
                    {invoiceTemplates?.map((t: any) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.name} {t.totalValue > 0 ? `— $${t.totalValue.toLocaleString()}` : ""} ({t.dueDays}d)
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Client Name</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div>
                  <Label>Client Email</Label>
                  <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="billing@acme.com" />
                </div>
              </div>

              {selectedTemplate && selectedTemplate !== "custom" ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Template will pre-fill line items, due date, and notes. You can edit after creation.
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Line Items</Label>
                      <Button variant="ghost" size="sm" onClick={addItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
                        <span className="col-span-5">Description</span>
                        <span className="col-span-2">Qty</span>
                        <span className="col-span-2">Price</span>
                        <span className="col-span-2 text-right">Total</span>
                        <span className="col-span-1" />
                      </div>
                      {items.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <Input className="col-span-5" placeholder="Service description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                          <Input className="col-span-2" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                          <Input className="col-span-2" type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", e.target.value)} />
                          <span className="col-span-2 text-sm text-right font-medium">${item.total.toFixed(2)}</span>
                          {items.length > 1 && (
                            <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input type="number" min={0} step="0.1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, additional details..." rows={2} />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating || !clientName || !clientEmail}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Invoice
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {!invoices ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No invoices found</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium">Invoice #</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices?.map((inv: any) => (
                    <tr
                      key={inv._id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setDetailOpen(true);
                      }}
                    >
                      <td className="px-4 py-3 font-mono">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">
                        <div>{inv.clientName}</div>
                        <div className="text-xs text-muted-foreground">{inv.clientEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">${inv.total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={STATUS_COLORS[inv.status]}>{inv.status}</Badge>
                      </td>
                      <td className="px-4 py-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
