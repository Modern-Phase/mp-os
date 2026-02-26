import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { Id } from "~/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Badge } from "@/ui/badge";
import { Loader2, Plus, Trash2, Send, CheckCircle } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  _id: Id<"invoices">;
  orgId: Id<"organizations">;
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate?: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  dueDate: number;
  paidAt?: number;
  notes?: string;
  projectId?: Id<"agentProjects">;
  leadId?: Id<"crmLeads">;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateInvoice = useMutation(api.invoices.updateInvoice);
  const deleteInvoice = useMutation(api.invoices.deleteInvoice);
  const markAsPaid = useMutation(api.invoices.markAsPaid);
  const sendInvoice = useMutation(api.invoices.sendInvoice as any);

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (invoice) {
      setItems(invoice.items);
      setClientName(invoice.clientName);
      setClientEmail(invoice.clientEmail);
      setTaxRate(invoice.taxRate ?? 0);
      setDueDate(new Date(invoice.dueDate).toISOString().split("T")[0]);
      setNotes(invoice.notes ?? "");
    }
  }, [invoice]);

  if (!invoice) return null;

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + tax;

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

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInvoice({
        invoiceId: invoice._id,
        clientName,
        clientEmail,
        items,
        taxRate,
        dueDate: new Date(dueDate).getTime(),
        notes: notes || undefined,
      });
    } catch (err) {
      console.error("Failed to save invoice:", err);
    }
    setSaving(false);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await handleSave();
      await sendInvoice({ invoiceId: invoice._id });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to send invoice:", err);
    }
    setSending(false);
  };

  const handleMarkPaid = async () => {
    try {
      await markAsPaid({ invoiceId: invoice._id });
    } catch (err) {
      console.error("Failed to mark paid:", err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInvoice({ invoiceId: invoice._id });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const isDraft = invoice.status === "draft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {invoice.invoiceNumber}
            <Badge className={STATUS_COLORS[invoice.status]}>
              {invoice.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Line items */}
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Client Name</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={!isDraft} />
              </div>
              <div>
                <Label>Client Email</Label>
                <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={!isDraft} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items</Label>
                {isDraft && (
                  <Button variant="ghost" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-5"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      disabled={!isDraft}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", e.target.value)}
                      disabled={!isDraft}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                      disabled={!isDraft}
                    />
                    <span className="col-span-2 text-sm text-right font-medium">
                      ${item.total.toFixed(2)}
                    </span>
                    {isDraft && (
                      <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!isDraft} rows={3} />
            </div>
          </div>

          {/* Right sidebar: Status & totals */}
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span className="text-muted-foreground">Tax Rate (%)</span>
                <Input
                  className="w-20 text-right"
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  disabled={!isDraft}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!isDraft} />
              </div>
              {invoice.paidAt && (
                <div>
                  <span className="text-muted-foreground">Paid: </span>
                  <span>{new Date(invoice.paidAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-4">
          {isDraft && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <div className="flex-1" />
          {isDraft && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Draft
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Send Invoice
              </Button>
            </>
          )}
          {invoice.status === "sent" && (
            <Button onClick={handleMarkPaid}>
              <CheckCircle className="h-4 w-4 mr-2" /> Mark Paid
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
