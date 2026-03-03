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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import {
  Loader2,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils/misc";
import siteConfig from "~/site.config";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/finances",
)({
  component: FinancesPage,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Finances`,
  }),
});

const CATEGORY_LABELS: Record<string, string> = {
  labor: "Labor",
  tools: "Tools & Software",
  hosting: "Hosting & Infra",
  services: "Services",
  marketing: "Marketing",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  labor: "bg-blue-500",
  tools: "bg-purple-500",
  hosting: "bg-cyan-500",
  services: "bg-amber-500",
  marketing: "bg-pink-500",
  other: "bg-gray-500",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function FinancesPage() {
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

  const overview = useConvexQuery(api.finances.getFinancialOverview, orgId ? { orgId } : "skip");
  const expenses = useConvexQuery(api.finances.getExpenses, orgId ? { orgId } : "skip");
  const projects = useConvexQuery(api.agents.getProjects, orgId ? { orgId } : "skip");

  const createExpense = useMutation(api.finances.createExpense);
  const updateExpense = useMutation(api.finances.updateExpense);
  const deleteExpense = useMutation(api.finances.deleteExpense);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [vendor, setVendor] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState<string>("");

  const resetForm = () => {
    setCategory("other");
    setDescription("");
    setAmount("");
    setDate(new Date().toISOString().split("T")[0]);
    setVendor("");
    setRecurring(false);
    setNotes("");
    setProjectId("");
    setEditingExpense(null);
  };

  const openEdit = (expense: any) => {
    setEditingExpense(expense);
    setCategory(expense.category);
    setDescription(expense.description);
    setAmount(String(expense.amount));
    setDate(new Date(expense.date).toISOString().split("T")[0]);
    setVendor(expense.vendor || "");
    setRecurring(expense.recurring || false);
    setNotes(expense.notes || "");
    setProjectId(expense.projectId || "");
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!orgId || !description || !amount) return;
    setCreating(true);
    try {
      const expenseData = {
        category: category as any,
        description,
        amount: parseFloat(amount),
        currency: "USD",
        date: new Date(date).getTime(),
        vendor: vendor || undefined,
        recurring: recurring || undefined,
        notes: notes || undefined,
        projectId: projectId ? (projectId as Id<"agentProjects">) : undefined,
      };

      if (editingExpense) {
        await updateExpense({ id: editingExpense._id, ...expenseData });
      } else {
        await createExpense({ orgId, ...expenseData });
      }
      resetForm();
      setCreateOpen(false);
    } catch (err) {
      console.error("Failed to save expense:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: Id<"expenses">) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await deleteExpense({ id });
    } catch (err) {
      console.error("Failed to delete expense:", err);
    }
  };

  if (!currentUser || !orgId) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const maxMonthly = Math.max(
    ...overview.monthlyData.map(m => Math.max(m.revenue, m.expenses)),
    1,
  );

  const maxCategoryAmount = Math.max(
    ...overview.expensesByCategory.map(c => c.amount),
    1,
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Finances</h1>
          <p className="text-sm text-muted-foreground">Revenue, expenses, and profitability tracking</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="What was this expense for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input
                    placeholder="e.g. AWS, Figma"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Project (optional)</Label>
                <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(projects ?? []).map((p: any) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="recurring" className="text-sm cursor-pointer">Recurring expense</Label>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <Button onClick={handleSubmit} disabled={creating || !description || !amount} className="w-full">
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingExpense ? "Update Expense" : "Add Expense"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(overview.totalRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
          accent="text-green-600 dark:text-green-400"
          bgAccent="bg-green-50 dark:bg-green-950/30"
        />
        <KpiCard
          title="Total Expenses"
          value={formatCurrency(overview.totalExpenses)}
          icon={<TrendingDown className="h-4 w-4" />}
          accent="text-red-600 dark:text-red-400"
          bgAccent="bg-red-50 dark:bg-red-950/30"
        />
        <KpiCard
          title="Net Profit"
          value={formatCurrency(overview.netProfit)}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={overview.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
          bgAccent={overview.netProfit >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}
        />
        <KpiCard
          title="Profit Margin"
          value={`${overview.profitMargin.toFixed(1)}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          accent={overview.profitMargin >= 20 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}
          bgAccent={overview.profitMargin >= 20 ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30"}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            Outstanding Invoices
          </div>
          <p className="text-xl font-semibold text-foreground">{formatCurrency(overview.outstandingInvoices)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Overdue Invoices
          </div>
          <p className={cn("text-xl font-semibold", overview.overdueInvoices > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
            {formatCurrency(overview.overdueInvoices)}
          </p>
        </div>
      </div>

      {/* Revenue Trend + Expense Breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Monthly Revenue vs Expenses */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Revenue vs Expenses (12 Months)</h3>
          <div className="flex items-end gap-1 h-40">
            {overview.monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="flex items-end gap-px w-full h-32">
                  <div
                    className="flex-1 bg-green-500/80 rounded-t-sm transition-all"
                    style={{ height: `${(m.revenue / maxMonthly) * 100}%`, minHeight: m.revenue > 0 ? 2 : 0 }}
                    title={`Revenue: ${formatCurrency(m.revenue)}`}
                  />
                  <div
                    className="flex-1 bg-red-400/70 rounded-t-sm transition-all"
                    style={{ height: `${(m.expenses / maxMonthly) * 100}%`, minHeight: m.expenses > 0 ? 2 : 0 }}
                    title={`Expenses: ${formatCurrency(m.expenses)}`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{m.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/80" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400/70" /> Expenses</span>
          </div>
        </div>

        {/* Expense Breakdown by Category */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Expense Breakdown</h3>
          {overview.expensesByCategory.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No expenses recorded yet
            </div>
          ) : (
            <div className="space-y-3">
              {overview.expensesByCategory.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{CATEGORY_LABELS[cat.category] ?? cat.category}</span>
                    <span className="text-muted-foreground font-medium">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", CATEGORY_COLORS[cat.category] ?? "bg-gray-500")}
                      style={{ width: `${(cat.amount / maxCategoryAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Profitability Table */}
      {overview.projectProfitability.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Project Profitability</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Project</th>
                  <th className="text-left py-2 pr-4 font-medium">Client</th>
                  <th className="text-right py-2 pr-4 font-medium">Revenue</th>
                  <th className="text-right py-2 pr-4 font-medium">Expenses</th>
                  <th className="text-right py-2 pr-4 font-medium">Profit</th>
                  <th className="text-right py-2 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {overview.projectProfitability.map((p) => (
                  <tr key={p.projectId} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-foreground">{p.projectName}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{p.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{p.client}</td>
                    <td className="py-2.5 pr-4 text-right text-green-600 dark:text-green-400">{formatCurrency(p.revenue)}</td>
                    <td className="py-2.5 pr-4 text-right text-red-500">{formatCurrency(p.expenses)}</td>
                    <td className={cn("py-2.5 pr-4 text-right font-medium", p.profit >= 0 ? "text-foreground" : "text-red-500")}>
                      {formatCurrency(p.profit)}
                    </td>
                    <td className={cn("py-2.5 text-right font-medium", p.margin >= 20 ? "text-green-600 dark:text-green-400" : p.margin >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500")}>
                      {p.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Clients */}
      {overview.topClients.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Top Clients by Revenue</h3>
          <div className="space-y-2">
            {overview.topClients.map((c, i) => (
              <div key={c.client} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                <span className="flex-1 text-sm text-foreground">{c.client}</span>
                <span className="text-sm font-medium text-foreground">{formatCurrency(c.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense List */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Expenses</h3>
          <span className="text-xs text-muted-foreground">{(expenses ?? []).length} entries</span>
        </div>
        {!expenses || expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <DollarSign className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No expenses yet. Add your first expense to start tracking profitability.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Date</th>
                  <th className="text-left py-2 pr-4 font-medium">Category</th>
                  <th className="text-left py-2 pr-4 font-medium">Description</th>
                  <th className="text-left py-2 pr-4 font-medium">Vendor</th>
                  <th className="text-left py-2 pr-4 font-medium">Project</th>
                  <th className="text-right py-2 pr-4 font-medium">Amount</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp: any) => (
                  <tr key={exp._id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", CATEGORY_COLORS[exp.category])} />
                        {CATEGORY_LABELS[exp.category] ?? exp.category}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-foreground">{exp.description}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{exp.vendor || "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">{exp.projectName || "—"}</td>
                    <td className="py-2.5 pr-4 text-right font-medium text-foreground">{formatCurrency(exp.amount)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(exp._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  accent,
  bgAccent,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  bgAccent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("flex items-center justify-center w-7 h-7 rounded-lg", bgAccent, accent)}>
          {icon}
        </span>
        <span className="text-xs text-muted-foreground">{title}</span>
      </div>
      <p className={cn("text-2xl font-bold", accent)}>{value}</p>
    </div>
  );
}
