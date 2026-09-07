"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, Printer, Download, TrendingUp, TrendingDown, Users, Wallet, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AiPanel } from "@/components/ai-panel";
import { BreakdownDonut, HorizontalBar } from "@/components/charts";
import { listPayments, type PaymentWithClient } from "@/lib/payments";
import { listExpenses, type Expense } from "@/lib/expenses";
import { listSalaryPayments, netSalary, type SalaryPayment } from "@/lib/salaries";
import { listInvoices, type InvoiceSummary } from "@/lib/invoices";
import { financialYear } from "@/lib/format";
import { downloadCSV } from "@/lib/statements";
import { useSettings } from "@/components/settings-provider";

const today = () => new Date().toISOString().slice(0, 10);

// Inclusive list of YYYY-MM between two ISO dates.
function monthsBetween(from: string, to: string) {
  const out: { key: string; label: string }[] = [];
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ key, label: new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" }) });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export default function ReportsPage() {
  const { formatCurrency, settings } = useSettings();
  const fy = useMemo(() => financialYear(settings?.financial_year_start || "04-01"), [settings]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState("fy");
  const [monthValue, setMonthValue] = useState("");
  const [payments, setPayments] = useState<PaymentWithClient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default the range to the current financial year once settings load.
  useEffect(() => {
    if (!from) setFrom(fy.start);
  }, [fy, from]);

  useEffect(() => {
    (async () => {
      try {
        const [p, e, s, inv] = await Promise.all([listPayments(), listExpenses(), listSalaryPayments(), listInvoices()]);
        setPayments(p);
        setExpenses(e);
        setSalaries(s);
        setInvoices(inv);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const r = useMemo(() => {
    const f = from || fy.start;
    const inRange = (d: string) => d >= f && d <= to;
    const fromM = f.slice(0, 7), toM = to.slice(0, 7);
    const monthInRange = (m: string) => m >= fromM && m <= toM; // period key is YYYY-MM

    // Revenue by billing period, salaries by salary period; expenses by date.
    const pInRange = payments.filter((p) => monthInRange(p.billing_month));
    const eInRange = expenses.filter((e) => inRange(e.expense_date));
    const sInRange = salaries.filter((s) => monthInRange(s.salary_month));

    const revenue = pInRange.reduce((s, p) => s + p.amount, 0);
    const expenseTotal = eInRange.reduce((s, e) => s + e.amount, 0);
    const salaryTotal = sInRange.reduce((s, p) => s + netSalary(p), 0);
    const profit = revenue - expenseTotal - salaryTotal;
    const margin = revenue ? Math.round((profit / revenue) * 100) : 0;

    const group = <T,>(items: T[], key: (i: T) => string, val: (i: T) => number) => {
      const map = new Map<string, number>();
      for (const i of items) map.set(key(i), (map.get(key(i)) ?? 0) + val(i));
      return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    };

    const byClient = group(pInRange, (p) => p.clients?.name ?? "Unknown", (p) => p.amount);
    const byCategory = group(eInRange, (e) => e.category, (e) => e.amount);
    const byEmployee = group(sInRange, (s) => s.employees?.name ?? "Unknown", (s) => netSalary(s));
    const byMethod = group(pInRange, (p) => p.payment_method || "Other", (p) => p.amount);

    const monthly = monthsBetween(f, to).map(({ key, label }) => {
      const rev = payments.filter((p) => p.billing_month === key).reduce((s, p) => s + p.amount, 0);
      const exp = expenses.filter((e) => e.expense_date.slice(0, 7) === key).reduce((s, e) => s + e.amount, 0);
      const sal = salaries.filter((s) => s.salary_month === key).reduce((s2, p) => s2 + netSalary(p), 0);
      return { key, label, revenue: rev, expenses: exp, salaries: sal, profit: rev - exp - sal };
    });

    // Derived analytics.
    const n = monthly.length || 1;
    const totalCost = expenseTotal + salaryTotal;
    const best = monthly.reduce((a, b) => (b.profit > a.profit ? b : a), monthly[0]);
    const worst = monthly.reduce((a, b) => (b.profit < a.profit ? b : a), monthly[0]);
    const analytics = {
      avgRevenue: revenue / n,
      avgProfit: profit / n,
      expenseRatio: revenue ? Math.round((totalCost / revenue) * 100) : 0,
      salaryShare: totalCost ? Math.round((salaryTotal / totalCost) * 100) : 0,
      paymentsCount: pInRange.length,
      expensesCount: eInRange.length,
      best,
      worst,
    };

    // Client profitability: overhead (all expenses + salaries) has no per-client
    // tag, so allocate it by each client's share of revenue. Estimate, labelled.
    const clientProfit = byClient.map((c) => {
      const cost = revenue ? totalCost * (c.value / revenue) : 0;
      const p = c.value - cost;
      return { name: c.name, revenue: c.value, cost, profit: p, margin: c.value ? Math.round((p / c.value) * 100) : 0 };
    });

    return { revenue, expenseTotal, salaryTotal, profit, margin, byClient, byCategory, byEmployee, byMethod, monthly, analytics, clientProfit };
  }, [payments, expenses, salaries, from, to, fy]);

  // Quick period presets. Custom leaves the date inputs for manual editing.
  function applyPreset(p: string) {
    setPreset(p);
    setMonthValue("");
    const now = new Date();
    const ty = now.getFullYear(), tm = now.getMonth() + 1, td = now.getDate();
    const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
    if (p === "this_month") { setFrom(fmt(ty, tm, 1)); setTo(fmt(ty, tm, td)); }
    else if (p === "last_month") { let lm = tm - 1, ly = ty; if (lm === 0) { lm = 12; ly--; } setFrom(fmt(ly, lm, 1)); setTo(fmt(ly, lm, lastDay(ly, lm))); }
    else if (p === "this_quarter") { const sm = Math.floor((tm - 1) / 3) * 3 + 1; setFrom(fmt(ty, sm, 1)); setTo(fmt(ty, tm, td)); }
    else if (p === "this_year") { setFrom(fmt(ty, 1, 1)); setTo(fmt(ty, tm, td)); }
    else if (p === "fy") { setFrom(fy.start); setTo(fmt(ty, tm, td)); }
    // "custom": keep current from/to
  }

  // Single-month check: set the range to exactly that calendar month.
  function pickMonth(m: string) {
    setMonthValue(m);
    setPreset("custom");
    if (!m) return;
    const [y, mm] = m.split("-").map(Number);
    const lastDay = new Date(y, mm, 0).getDate();
    setFrom(`${m}-01`);
    setTo(`${m}-${String(lastDay).padStart(2, "0")}`);
  }

  // Accounts-receivable aging as of today (not period-bound): outstanding,
  // non-cancelled/non-draft invoices bucketed by how overdue they are.
  const aging = useMemo(() => {
    const today = new Date();
    const buckets = [
      { label: "Not due yet", count: 0, amount: 0 },
      { label: "1–30 days", count: 0, amount: 0 },
      { label: "31–60 days", count: 0, amount: 0 },
      { label: "61–90 days", count: 0, amount: 0 },
      { label: "90+ days", count: 0, amount: 0 },
    ];
    for (const i of invoices) {
      if (i.balance <= 0 || i.display_status === "cancelled" || i.display_status === "draft") continue;
      const days = Math.floor((today.getTime() - new Date(`${i.due_date}T00:00:00`).getTime()) / 86400000);
      const b = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
      buckets[b].count++;
      buckets[b].amount += i.balance;
    }
    const totalOutstanding = buckets.reduce((s, b) => s + b.amount, 0);
    const overdue = buckets.slice(1).reduce((s, b) => s + b.amount, 0);
    return { buckets, totalOutstanding, overdue };
  }, [invoices]);

  function exportCsv() {
    downloadCSV(
      `report_${from || fy.start}_to_${to}.csv`,
      ["Month", "Revenue", "Expenses", "Salaries", "Net Profit"],
      r.monthly.map((m) => [m.label, m.revenue, m.expenses, m.salaries, m.profit]),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Everything for a period in one place"
        action={
          <div className="flex flex-wrap items-center gap-2 print-hide">
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="fy">{fy.label}</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="month"
              value={monthValue}
              onChange={(e) => pickMonth(e.target.value)}
              className="w-40"
              aria-label="Check a specific month"
            />
            {preset === "custom" && (
              <>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
                <span className="text-muted-foreground">→</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
              </>
            )}
            <Button variant="outline" size="icon" onClick={exportCsv} aria-label="Export CSV"><Download className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => window.print()} aria-label="Print"><Printer className="h-4 w-4" /></Button>
          </div>
        }
      />

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load report</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Period: <span className="font-medium text-foreground">{from || fy.start}</span> to{" "}
            <span className="font-medium text-foreground">{to}</span>
          </p>

          <AiPanel
            currency={settings?.default_currency || "INR"}
            context={{
              period: { from: from || fy.start, to },
              totals: { revenue: r.revenue, expenses: r.expenseTotal, salaries: r.salaryTotal, netProfit: r.profit, netMarginPct: r.margin },
              analytics: r.analytics,
              monthly: r.monthly,
              revenueByClient: r.byClient,
              clientProfitability: r.clientProfit,
              accountsReceivableAging: { asOfToday: true, totalOutstanding: aging.totalOutstanding, overdue: aging.overdue, buckets: aging.buckets },
              expensesByCategory: r.byCategory,
              salariesByEmployee: r.byEmployee,
              paymentMethods: r.byMethod,
            }}
          />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard title="Revenue" value={r.revenue} icon={TrendingUp} accent="positive" hint="Payments received" />
            <StatCard title="Expenses" value={r.expenseTotal} icon={TrendingDown} accent="negative" hint="Business expenses" />
            <StatCard title="Salaries" value={r.salaryTotal} icon={Users} accent="negative" hint="Net salary (by month)" />
            <StatCard title="Net Profit" value={r.profit} icon={Wallet} accent={r.profit >= 0 ? "positive" : "negative"} hint="Revenue − expenses − salaries" />
            <StatCard title="Net Margin" value={r.margin} icon={Percent} accent={r.profit >= 0 ? "positive" : "negative"} hint="Profit ÷ revenue" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
              <CardDescription>Revenue, expenses and salaries per month in the period</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Salaries</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.monthly.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(m.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(m.expenses)}</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(m.salaries)}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${m.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {formatCurrency(m.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
              <CardDescription>Averages and highlights for the period</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Metric label="Avg Monthly Revenue" value={formatCurrency(r.analytics.avgRevenue)} />
              <Metric label="Avg Monthly Profit" value={formatCurrency(r.analytics.avgProfit)} tone={r.analytics.avgProfit >= 0 ? "pos" : "neg"} />
              <Metric label="Expense Ratio" value={`${r.analytics.expenseRatio}%`} sub="cost ÷ revenue" tone={r.analytics.expenseRatio > 100 ? "neg" : undefined} />
              <Metric label="Salary Share" value={`${r.analytics.salaryShare}%`} sub="of total cost" />
              <Metric label="Payments" value={String(r.analytics.paymentsCount)} />
              <Metric label="Expenses" value={String(r.analytics.expensesCount)} />
              <Metric label="Best Month" value={r.analytics.best?.label ?? "—"} sub={r.analytics.best ? formatCurrency(r.analytics.best.profit) : ""} tone="pos" />
              <Metric label="Weakest Month" value={r.analytics.worst?.label ?? "—"} sub={r.analytics.worst ? formatCurrency(r.analytics.worst.profit) : ""} tone="neg" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Client</CardTitle>
                <CardDescription>Top clients in the period</CardDescription>
              </CardHeader>
              <CardContent>
                <HorizontalBar data={r.byClient.slice(0, 8).map((c) => ({ name: c.name, amount: c.value }))} nameKey="name" color="var(--chart-1)" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
                <CardDescription>Where money went</CardDescription>
              </CardHeader>
              <CardContent>
                <BreakdownDonut data={r.byCategory} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Salaries by Employee</CardTitle>
              <CardDescription>Net salary paid per employee in the period</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {r.byEmployee.length === 0 ? (
                <p className="text-sm text-muted-foreground">No salary payments in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Net Salary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.byEmployee.map((e) => (
                      <TableRow key={e.name}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(e.value)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.salaryTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receivables Aging</CardTitle>
              <CardDescription>
                Outstanding invoices as of today ·{" "}
                <span className="font-medium text-foreground">{formatCurrency(aging.totalOutstanding)}</span> total
                {aging.overdue > 0 && <span className="ml-1 font-medium text-amber-600">· {formatCurrency(aging.overdue)} overdue</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Age</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aging.buckets.map((b, i) => (
                    <TableRow key={b.label}>
                      <TableCell className={i === 0 ? "font-medium" : "font-medium text-amber-700"}>{b.label}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{b.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(b.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">Total Outstanding</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(aging.totalOutstanding)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Client Profitability</CardTitle>
              <CardDescription>Revenue minus overhead (expenses + salaries) allocated by revenue share — an estimate</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {r.clientProfit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revenue in this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Allocated Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.clientProfit.map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(c.revenue)}</TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(c.cost)}</TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${c.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(c.profit)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${c.margin >= 0 ? "text-muted-foreground" : "text-red-600"}`}>{c.margin}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ShareTable
              title="Revenue by Client"
              description="Full list with share of revenue"
              rows={r.byClient}
              total={r.revenue}
              fmt={formatCurrency}
            />
            <ShareTable
              title="Expenses by Category"
              description="Full list with share of spend"
              rows={r.byCategory}
              total={r.expenseTotal}
              fmt={formatCurrency}
            />
          </div>

          <ShareTable
            title="Payment Methods"
            description="How revenue was received"
            rows={r.byMethod}
            total={r.revenue}
            fmt={formatCurrency}
          />
        </>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "neg" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ShareTable({
  title,
  description,
  rows,
  total,
  fmt,
}: {
  title: string;
  description: string;
  rows: { name: string; value: number }[];
  total: number;
  fmt: (n: number) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data in this period.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{title.split(" by ")[1] ?? "Name"}</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.value)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {total ? Math.round((row.value / total) * 100) : 0}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
