import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ProposalSection {
  title: string;
  description: string;
  items: InvoiceItem[];
}

interface TemplateEditorProps {
  type: "invoice" | "proposal" | "contract";
  content: string;
  onChange: (content: string) => void;
}

export function TemplateEditor({ type, content, onChange }: TemplateEditorProps) {
  if (type === "contract") {
    return <ContractEditor content={content} onChange={onChange} />;
  }
  if (type === "invoice") {
    return <InvoiceEditor content={content} onChange={onChange} />;
  }
  return <ProposalEditor content={content} onChange={onChange} />;
}

// ========== CONTRACT (markdown) ==========

function ContractEditor({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Contract Content (Markdown)</Label>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        rows={16}
        className="font-mono text-sm"
        placeholder={"# Contract Title\n\nUse {{clientName}}, {{startDate}}, {{projectName}}, {{deliverables}}, {{totalValue}} as placeholders..."}
      />
      <p className="text-xs text-muted-foreground">
        Supports markdown and template variables: {"{{clientName}}"}, {"{{startDate}}"}, {"{{projectName}}"}, {"{{deliverables}}"}, {"{{totalValue}}"}
      </p>
    </div>
  );
}

// ========== INVOICE (structured items) ==========

function InvoiceEditor({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  let parsed: { items: InvoiceItem[]; notes?: string; dueDays: number };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }], dueDays: 30 };
  }

  const [items, setItems] = useState<InvoiceItem[]>(parsed.items);
  const [notes, setNotes] = useState(parsed.notes || "");
  const [dueDays, setDueDays] = useState(parsed.dueDays);

  const emit = (newItems: InvoiceItem[], newNotes: string, newDueDays: number) => {
    onChange(JSON.stringify({ items: newItems, notes: newNotes, dueDays: newDueDays }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    if (field === "description") item.description = value as string;
    else item[field] = Number(value);
    if (field === "quantity" || field === "unitPrice") item.total = item.quantity * item.unitPrice;
    updated[index] = item;
    setItems(updated);
    emit(updated, notes, dueDays);
  };

  const addItem = () => {
    const updated = [...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }];
    setItems(updated);
    emit(updated, notes, dueDays);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    emit(updated, notes, dueDays);
  };

  return (
    <div className="space-y-4">
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
              <Input className="col-span-5" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Due Days</Label>
          <Input
            type="number"
            min={1}
            value={dueDays}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDueDays(d);
              emit(items, notes, d);
            }}
          />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            emit(items, e.target.value, dueDays);
          }}
          rows={2}
          placeholder="Payment terms, additional details..."
        />
      </div>
    </div>
  );
}

// ========== PROPOSAL (sections + items) ==========

function ProposalEditor({ content, onChange }: { content: string; onChange: (c: string) => void }) {
  let parsed: { sections: ProposalSection[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { sections: [{ title: "Services", description: "", items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }] }] };
  }

  const [sections, setSections] = useState<ProposalSection[]>(parsed.sections);

  const emit = (newSections: ProposalSection[]) => {
    onChange(JSON.stringify({ sections: newSections }));
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
    emit(updated);
  };

  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={si} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Section title"
              value={section.title}
              onChange={(e) => {
                const updated = [...sections];
                updated[si] = { ...updated[si], title: e.target.value };
                setSections(updated);
                emit(updated);
              }}
              className="flex-1"
            />
            {sections.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => {
                const updated = sections.filter((_, i) => i !== si);
                setSections(updated);
                emit(updated);
              }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <Input
            placeholder="Section description"
            value={section.description}
            onChange={(e) => {
              const updated = [...sections];
              updated[si] = { ...updated[si], description: e.target.value };
              setSections(updated);
              emit(updated);
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
                emit(updated);
              }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => {
            const updated = [...sections];
            updated[si] = { ...updated[si], items: [...updated[si].items, { description: "", quantity: 1, unitPrice: 0, total: 0 }] };
            setSections(updated);
            emit(updated);
          }}>
            <Plus className="h-3 w-3 mr-1" /> Add Item
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => {
        const updated = [...sections, { title: "", description: "", items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }] }];
        setSections(updated);
        emit(updated);
      }}>
        <Plus className="h-3 w-3 mr-1" /> Add Section
      </Button>
    </div>
  );
}
