"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { listBudgets, setBudget } from "@/lib/budgets";
import { listExpenses, type Expense } from "@/lib/expenses";
import { useSettings } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const ym = (date: string) => date.slice(0, 7);

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency, settings } = useSettings();
  const categories = useMemo(() => settings?.expense_categories ?? [], [settings]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [b, e] = await Promise.all([listBudgets(month), listExpenses()]);
        setBudgets(Object.fromEntries(b.map((row) => [row.category, String(row.amount)])));
        setExpenses(e);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load budgets");
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  // Actual spend per category for the selected month.
  const actualByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      if (ym(e.expense_date) === month) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    }
    return m;
  }, [expenses, month]);

  const rows = categories.map((cat) => {
    const budget = Number(budgets[cat]) || 0;
    const actual = actualByCategory.get(cat) ?? 0;
    return { cat, budget, actual, variance: budget - actual };
  });

  const totals = rows.reduce(
    (acc, r) => ({ budget: acc.budget + r.budget, actual: acc.actual + r.actual }),
    { budget: 0, actual: 0 },
  );

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all(
        categories.map((cat) => setBudget(month, cat, Number(budgets[cat]) || 0)),
      );
      toast.success("Budgets saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save budgets");
    } finally {
      setSaving(false);
    }
  }

  const monthLabel = new Date(`${month}-01`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description={`Budget vs actual — ${monthLabel}`}
        action={
          <div className="flex items-center gap-3">
            <Input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="w-44"
            />
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total Budget" value={formatCurrency(totals.budget)} />
        <MetricCard label="Total Actual" value={formatCurrency(totals.actual)} tone="negative" />
        <MetricCard
          label="Remaining"
          value={formatCurrency(totals.budget - totals.actual)}
          tone={totals.budget - totals.actual >= 0 ? "positive" : "negative"}
        />
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load budgets</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  Add expense categories in Settings first.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.cat}>
                  <TableCell className="font-medium">{r.cat}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="any"
                      value={budgets[r.cat] ?? ""}
                      onChange={(e) =>
                        setBudgets((prev) => ({ ...prev, [r.cat]: e.target.value }))
                      }
                      placeholder="0"
                      className="ml-auto h-8 w-32 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.actual)}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      r.budget === 0
                        ? "text-muted-foreground"
                        : r.variance < 0
                          ? "text-red-600"
                          : "text-emerald-600",
                    )}
                  >
                    {r.budget === 0 ? "—" : formatCurrency(r.variance)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Variance = budget − actual. Negative (red) means you’re over budget for that category.
      </p>
    </div>
  );
}
