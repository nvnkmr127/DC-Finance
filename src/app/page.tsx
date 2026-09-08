"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  Clock,
  RefreshCw,
  Landmark,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import { AiPanel } from "@/components/ai-panel";
import {
  RevenueExpenseLineChart,
  ProfitBarChart,
  BreakdownDonut,
  HorizontalBar,
} from "@/components/charts";
import { listPayments, type PaymentWithClient } from "@/lib/payments";
import { listExpenses, type Expense } from "@/lib/expenses";
import { listSalaryPayments, netSalary, type SalaryPayment, listEmployees, type Employee } from "@/lib/salaries";
import { listClients, monthlyEquivalent, type ClientSummary } from "@/lib/clients";
import { listRecurring, daysUntil, type Recurring } from "@/lib/recurring";
import { getOpeningBalance } from "@/lib/statements";
import { listBudgets, type Budget } from "@/lib/budgets";
import { formatDate, financialYear } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const ym = (date: string) => date.slice(0, 7);

// Signed % change vs the previous period; undefined when there's no prior base
// to compare against (avoids divide-by-zero and a meaningless "+∞%").
function pctDelta(cur: number, prev: number): number | undefined {
  if (!prev) return undefined;
  return Math.round(((cur - prev) / Math.abs(prev)) * 100);
}

// Trailing `count` months ending at `end` (YYYY-MM) → [{ key, label }].
function monthsRange(end: string, count: number) {
  const [y, m] = end.split("-").map(Number);
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
    });
  }
  return out;
}

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [payments, setPayments] = useState<PaymentWithClient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive forecast adjustment inputs
  const [overrideRevenue, setOverrideRevenue] = useState<string>("");
  const [overrideCost, setOverrideCost] = useState<string>("");
  const [forecastDuration, setForecastDuration] = useState<number>(6);
  const [showForecastInputs, setShowForecastInputs] = useState<boolean>(false);

  const { formatCurrency, settings } = useSettings();
  const fyStart = settings?.financial_year_start || "04-01";

  useEffect(() => {
    (async () => {
      try {
        const [p, e, s, emp, c, r] = await Promise.all([
          listPayments(),
          listExpenses(),
          listSalaryPayments(),
          listEmployees(),
          listClients(),
          listRecurring(),
        ]);
        setPayments(p);
        setExpenses(e);
        setSalaries(s);
        setEmployees(emp);
        setClients(c);
        setRecurring(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Opening balance and budgets are per-month, so refetch when the month changes.
  useEffect(() => {
    (async () => {
      const [ob, b] = await Promise.all([
        getOpeningBalance(month).catch(() => null),
        listBudgets(month).catch(() => []),
      ]);
      setOpeningBalance(ob);
      setBudgets(b);
    })();
  }, [month]);

  const d = useMemo(() => {
    // Per-month aggregates from actual records. Missing months resolve to 0
    // because the reducers run over an (often empty) filtered slice.
    // Revenue is attributed to the period it's FOR (billing_month), so a July
    // payment received in mid-August shows under July, not August.
    const revenueIn = (key: string) =>
      payments.filter((p) => p.billing_month === key).reduce((s, p) => s + p.amount, 0);
    const expensesIn = (key: string) =>
      expenses.filter((e) => ym(e.expense_date) === key).reduce((s, e) => s + e.amount, 0);
    // Salaries are attributed to the period they're FOR (salary_month), so
    // July's salary paid on Aug 1 shows under July, not August.
    const salariesIn = (key: string) =>
      salaries.filter((p) => p.salary_month === key).reduce((s, p) => s + netSalary(p), 0);

    // Last 12 months ending at the selected month.
    const months = monthsRange(month, 12).map(({ key, label }) => {
      const revenue = revenueIn(key);
      const exp = expensesIn(key);
      const sal = salariesIn(key);
      const totalExpenses = exp + sal;
      return { key, month: label, revenue, expenses: exp, salaries: sal, totalExpenses, profit: revenue - totalExpenses };
    });

    const selected = months[months.length - 1];
    const prev = months[months.length - 2];

    // Month-over-month change for the headline stats.
    const deltas = {
      revenue: pctDelta(selected.revenue, prev?.revenue ?? 0),
      expenses: pctDelta(selected.expenses, prev?.expenses ?? 0),
      salaries: pctDelta(selected.salaries, prev?.salaries ?? 0),
      profit: pctDelta(selected.profit, prev?.profit ?? 0),
    };

    // Cash on hand = opening balance + actual cash movement this month. Unlike
    // the accrual "Salaries" stat above, cash uses when salary was actually PAID
    // (payment_date), so an Aug-1 payment of July salary leaves cash in August.
    const cashRevenue = payments
      .filter((p) => ym(p.payment_date) === month)
      .reduce((s, p) => s + p.amount, 0);
    const cashSalaries = salaries
      .filter((p) => ym(p.payment_date) === month)
      .reduce((s, p) => s + netSalary(p), 0);
    const cashBalance = (openingBalance ?? 0) + cashRevenue - selected.expenses - cashSalaries;

    // Outstanding = each client's monthly billing − payments received this month.
    const receivedByClient = new Map<string, number>();
    for (const p of payments) {
      if (p.billing_month === month) {
        receivedByClient.set(p.client_id, (receivedByClient.get(p.client_id) ?? 0) + p.amount);
      }
    }
    const outstanding = clients.reduce(
      (s, c) => s + Math.max(monthlyEquivalent(c) - (receivedByClient.get(c.id) ?? 0), 0),
      0,
    );

    const clientsWithOutstanding = clients.map(c => {
      const remaining = Math.max(monthlyEquivalent(c) - (receivedByClient.get(c.id) ?? 0), 0);
      return { id: c.id, name: c.name, remaining };
    }).filter(c => c.remaining > 0).sort((a, b) => b.remaining - a.remaining).slice(0, 5);

    // Recurring Expenses for the month (total active recurring amounts)
    const totalRecurring = recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0);

    // Expense categories for the selected month.
    const catMap = new Map<string, number>();
    for (const e of expenses)
      if (ym(e.expense_date) === month) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
    const categories = [...catMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top clients by revenue for the selected month.
    const clientMap = new Map<string, number>();
    for (const p of payments) {
      if (p.billing_month !== month) continue;
      clientMap.set(p.clients?.name ?? "Unknown", (clientMap.get(p.clients?.name ?? "Unknown") ?? 0) + p.amount);
    }
    const topClients = [...clientMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Financial-year-to-date totals.
    const fy = financialYear(fyStart);
    const inFy = (dateStr: string) => dateStr >= fy.start && dateStr < fy.end;
    const inFyMonth = (m: string) => `${m}-01` >= fy.start && `${m}-01` < fy.end; // YYYY-MM period
    const fyRevenue = payments.filter((p) => inFyMonth(p.billing_month)).reduce((s, p) => s + p.amount, 0);
    const fyExpenses = expenses.filter((e) => inFy(e.expense_date)).reduce((s, e) => s + e.amount, 0);
    const fySalaries = salaries.filter((p) => inFyMonth(p.salary_month)).reduce((s, p) => s + netSalary(p), 0);
    const fytd = {
      label: fy.label,
      revenue: fyRevenue,
      expenses: fyExpenses + fySalaries,
      profit: fyRevenue - fyExpenses - fySalaries,
    };

    const upcoming = recurring.filter((r) => r.active && daysUntil(r.next_payment_date) <= 30).sort((a,b) => new Date(a.next_payment_date).getTime() - new Date(b.next_payment_date).getTime()).slice(0, 5);

    // Pending salaries
    const paidByEmployee = new Map<string, number>();
    for (const p of salaries) {
      if (p.salary_month === month) {
        paidByEmployee.set(p.employee_id, (paidByEmployee.get(p.employee_id) ?? 0) + netSalary(p));
      }
    }
    const pendingSalaries = employees.filter(e => e.status === "active").map(e => {
      const remaining = Math.max(e.salary - (paidByEmployee.get(e.id) ?? 0), 0);
      return { id: e.id, name: e.name, remaining };
    }).filter(e => e.remaining > 0).sort((a, b) => b.remaining - a.remaining);

    // Forward-looking cash-flow forecast — a run-rate estimate:
    //   expected monthly revenue = active clients' recurring/contract value
    //   expected monthly cost    = active payroll + trailing-3-month expense avg
    // ponytail: run-rate heuristic, not a per-invoice projection; good enough for runway.
    const baseExpectedRevenue = clients.filter((c) => c.status === "active").reduce((s, c) => s + monthlyEquivalent(c), 0);
    const payroll = employees.filter((e) => e.status === "active").reduce((s, e) => s + e.salary, 0);
    const recent3 = months.slice(-3);
    const avgExpenses = recent3.length ? recent3.reduce((s, m) => s + m.expenses, 0) / recent3.length : 0;
    const baseExpectedCost = payroll + avgExpenses;

    const expectedRevenue =
      overrideRevenue !== "" && !isNaN(Number(overrideRevenue))
        ? Math.max(0, Number(overrideRevenue))
        : baseExpectedRevenue;

    const expectedCost =
      overrideCost !== "" && !isNaN(Number(overrideCost))
        ? Math.max(0, Number(overrideCost))
        : baseExpectedCost;

    const netPerMonth = expectedRevenue - expectedCost;
    const [fy0, fm0] = month.split("-").map(Number);
    let running = cashBalance;
    const forecast = Array.from({ length: forecastDuration }, (_, i) => {
      running += netPerMonth;
      const dt = new Date(fy0, fm0 - 1 + i + 1, 1);
      return {
        key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
        label: dt.toLocaleString("en-IN", { month: "short", year: "2-digit" }),
        cash: running,
      };
    });
    const runwayMonths = netPerMonth < 0 && cashBalance > 0 ? cashBalance / -netPerMonth : null;
    const isCustom = overrideRevenue !== "" || overrideCost !== "" || forecastDuration !== 6;
    const fc = {
      baseExpectedRevenue,
      baseExpectedCost,
      expectedRevenue,
      expectedCost,
      netPerMonth,
      runwayMonths,
      forecast,
      isCustom,
      forecastDuration,
    };

    // Budget vs actual for the month — only categories with a budget set.
    const actualByCat = new Map(categories.map((c) => [c.name, c.value]));
    const budgetRows = budgets
      .filter((b) => b.amount > 0)
      .map((b) => ({ category: b.category, budget: b.amount, actual: actualByCat.get(b.category) ?? 0 }))
      .sort((a, b) => b.actual - a.actual);

    return {
      selected,
      deltas,
      cashBalance,
      fc,
      outstanding,
      totalRecurring,
      fytd,
      months,
      categories,
      budgetRows,
      topClients,
      clientsWithOutstanding,
      upcoming,
      pendingSalaries,
      recentPayments: payments.slice(0, 5),
      recentExpenses: expenses.slice(0, 5),
    };
  }, [payments, expenses, salaries, employees, clients, recurring, budgets, openingBalance, month, fyStart, overrideRevenue, overrideCost, forecastDuration]);

  const monthLabel = new Date(`${month}-01`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const currency = settings?.default_currency || "INR";
  // Shared with both the insights card and the floating chat widget.
  const aiContext = {
    month: monthLabel,
    revenue: d.selected.revenue,
    expenses: d.selected.expenses,
    salaries: d.selected.salaries,
    netProfit: d.selected.profit,
    netMarginPct: d.selected.revenue ? Math.round((d.selected.profit / d.selected.revenue) * 100) : null,
    cashBalance: d.cashBalance,
    outstanding: d.outstanding,
    recurringMonthly: d.totalRecurring,
    momChangePct: d.deltas,
    financialYearToDate: d.fytd,
    topClientsThisMonth: d.topClients,
    clientsWithOutstanding: d.clientsWithOutstanding,
    pendingSalaries: d.pendingSalaries,
    budgetVsActual: d.budgetRows,
    expensesByCategory: d.categories,
    monthlyTrend: d.months.map((m) => ({ month: m.month, revenue: m.revenue, expenses: m.totalExpenses, profit: m.profit })),
    cashFlowForecast: { expectedMonthlyRevenue: d.fc.expectedRevenue, expectedMonthlyCost: d.fc.expectedCost, netPerMonth: d.fc.netPerMonth, runwayMonths: d.fc.runwayMonths, projected: d.fc.forecast },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Financial overview — ${monthLabel}`}
        action={
          <Input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="w-44"
            aria-label="Select month"
          />
        }
      />

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load dashboard</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard title="Revenue" value={d.selected.revenue} icon={TrendingUp} accent="positive" hint="Payments received" delta={d.deltas.revenue} />
            <StatCard title="Expenses" value={d.selected.expenses} icon={TrendingDown} accent="negative" hint="Business expenses" delta={d.deltas.expenses} invertDelta />
            <StatCard title="Salaries" value={d.selected.salaries} icon={Users} accent="negative" hint="Net salary paid" delta={d.deltas.salaries} invertDelta />
            <StatCard title="Net Profit" value={d.selected.profit} icon={Wallet} accent={d.selected.profit >= 0 ? "positive" : "negative"} hint="Revenue − expenses − salaries" delta={d.deltas.profit} />
            <StatCard title="Cash Balance" value={d.cashBalance} icon={Landmark} accent={d.cashBalance >= 0 ? "positive" : "negative"} hint="Opening + net cash flow" />
            <StatCard title="Outstanding" value={d.outstanding} icon={Clock} accent="warning" hint="Billing − received" />
            <StatCard title="Recurring Expenses" value={d.totalRecurring} icon={RefreshCw} accent="default" hint="Monthly active recurring" />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Financial Year to Date · {d.fytd.label}</CardTitle>
              <CardDescription>Cumulative since the start of the financial year</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(d.fytd.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses (incl. salaries)</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-red-600">{formatCurrency(d.fytd.expenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Profit</p>
                <p className={cn("mt-1 text-xl font-semibold tabular-nums", d.fytd.profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                  {formatCurrency(d.fytd.profit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Margin</p>
                <p className={cn("mt-1 text-xl font-semibold tabular-nums", d.fytd.profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                  {d.fytd.revenue ? `${Math.round((d.fytd.profit / d.fytd.revenue) * 100)}%` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <AiPanel currency={currency} context={aiContext} autoDaily />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Cash-Flow Forecast</CardTitle>
                    {d.fc.isCustom && (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                        Custom Scenario
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {d.fc.isCustom
                      ? "Scenario projection updated live from your custom inputs"
                      : "Run-rate estimate from active contracts, payroll and recent spend"}
                    {d.fc.runwayMonths != null && (
                      <span className="ml-1 font-medium text-amber-600">· ~{d.fc.runwayMonths.toFixed(1)} months runway</span>
                    )}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setShowForecastInputs((v) => !v)}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                    {showForecastInputs ? "Hide Inputs" : "Adjust Forecast Inputs"}
                  </Button>
                  {d.fc.isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setOverrideRevenue("");
                        setOverrideCost("");
                        setForecastDuration(6);
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset to Auto
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Interactive Inputs Drawer */}
              {showForecastInputs && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Forecast Simulation Inputs</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      Leave empty to use automated run-rate
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-muted-foreground">Expected Monthly Revenue</label>
                      <Input
                        type="number"
                        placeholder={`Auto: ${Math.round(d.fc.baseExpectedRevenue)}`}
                        value={overrideRevenue}
                        onChange={(e) => setOverrideRevenue(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground">Expected Monthly Cost</label>
                      <Input
                        type="number"
                        placeholder={`Auto: ${Math.round(d.fc.baseExpectedCost)}`}
                        value={overrideCost}
                        onChange={(e) => setOverrideCost(e.target.value)}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground">Projection Horizon</label>
                      <div className="flex items-center gap-1 pt-0.5">
                        {[3, 6, 9, 12].map((m) => (
                          <Button
                            key={m}
                            type="button"
                            variant={forecastDuration === m ? "default" : "outline"}
                            size="sm"
                            className="h-8 flex-1 text-xs px-1"
                            onClick={() => setForecastDuration(m)}
                          >
                            {m}m
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Expected Revenue / mo</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">
                    {formatCurrency(d.fc.expectedRevenue)}
                  </p>
                  {d.fc.expectedRevenue !== d.fc.baseExpectedRevenue && (
                    <p className="text-[10px] text-muted-foreground">
                      Auto: {formatCurrency(d.fc.baseExpectedRevenue)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Cost / mo</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-red-600">
                    {formatCurrency(d.fc.expectedCost)}
                  </p>
                  {d.fc.expectedCost !== d.fc.baseExpectedCost && (
                    <p className="text-[10px] text-muted-foreground">
                      Auto: {formatCurrency(d.fc.baseExpectedCost)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net / mo</p>
                  <p className={cn("mt-1 text-lg font-semibold tabular-nums", d.fc.netPerMonth >= 0 ? "text-emerald-700" : "text-red-700")}>
                    {d.fc.netPerMonth >= 0 ? "+" : ""}{formatCurrency(d.fc.netPerMonth)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-3">
                  {d.fc.forecast.map((f) => (
                    <div key={f.key} className="min-w-24 flex-1 rounded-md border bg-muted/30 p-2 text-center">
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className={cn("mt-1 text-sm font-semibold tabular-nums", f.cash >= 0 ? "text-foreground" : "text-red-600")}>
                        {formatCurrency(f.cash)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Projected cash at each month-end, starting from current cash balance ({formatCurrency(d.cashBalance)}).
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue vs Expenses by Month</CardTitle>
                <CardDescription>Last 12 months · expenses include salaries</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueExpenseLineChart
                  data={d.months.map((m) => ({ month: m.month, revenue: m.revenue, expenses: m.totalExpenses }))}
                />
              </CardContent>
            </Card>
            <Panel title="Expenses by Category" description={monthLabel}>
              <BreakdownDonut data={d.categories} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Monthly Profit" description="Last 12 months">
              <ProfitBarChart data={d.months.map((m) => ({ month: m.month, profit: m.profit }))} />
            </Panel>
            <Panel title="Revenue by Client" description={monthLabel}>
              <HorizontalBar data={d.topClients} nameKey="name" color="var(--chart-1)" />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Clients with Outstanding Payments" description={monthLabel}>
               {d.clientsWithOutstanding.length === 0 ? (
                <p className="text-sm text-muted-foreground">All clients are paid up.</p>
              ) : (
                <ul className="divide-y">
                  {d.clientsWithOutstanding.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <span className="text-sm font-semibold tabular-nums text-amber-600">{formatCurrency(c.remaining)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Pending Salaries" description={monthLabel}>
               {d.pendingSalaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">All salaries are paid.</p>
              ) : (
                <ul className="divide-y">
                  {d.pendingSalaries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <span className="text-sm font-semibold tabular-nums text-amber-600">{formatCurrency(e.remaining)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Budget vs Actual" description={monthLabel} className="lg:col-span-2">
            {d.budgetRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No budgets set for {monthLabel}. Add category budgets in the Budgets page.
              </p>
            ) : (
              <ul className="space-y-3">
                {d.budgetRows.map((b) => {
                  const pct = b.budget > 0 ? Math.min((b.actual / b.budget) * 100, 100) : 0;
                  const over = b.actual > b.budget;
                  return (
                    <li key={b.category}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{b.category}</span>
                        <span className={cn("tabular-nums", over ? "text-red-600" : "text-muted-foreground")}>
                          {formatCurrency(b.actual)} / {formatCurrency(b.budget)}
                          {over && ` · over by ${formatCurrency(b.actual - b.budget)}`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", over ? "bg-red-500" : "bg-emerald-500")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Recent Payments">
              <TxList
                items={d.recentPayments.map((p) => ({ id: p.id, primary: p.clients?.name ?? "Unknown", secondary: formatDate(p.payment_date), amount: p.amount, positive: true }))}
                empty="No payments yet"
              />
            </Panel>
            <Panel title="Recent Expenses">
              <TxList
                items={d.recentExpenses.map((e) => ({ id: e.id, primary: e.description, secondary: `${e.category} · ${formatDate(e.expense_date)}`, amount: e.amount, positive: false }))}
                empty="No expenses yet"
              />
            </Panel>
            <Panel title="Upcoming Recurring Payments" description="Next 30 days">
              {d.upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due soon.</p>
              ) : (
                <ul className="divide-y">
                  {d.upcoming.map((r) => {
                    const days = daysUntil(r.next_payment_date);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">{r.frequency} · {formatDate(r.next_payment_date)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={cn("text-xs", days < 0 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-muted-foreground")}>
                            {days < 0 ? `Overdue ${-days}d` : days === 0 ? "Today" : `In ${days}d`}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function TxList({
  items,
  empty,
}: {
  items: { id: string; primary: string; secondary: string; amount: number; positive: boolean }[];
  empty: string;
}) {
  const { formatCurrency } = useSettings();
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {items.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{t.primary}</p>
            <p className="truncate text-xs text-muted-foreground">{t.secondary}</p>
          </div>
          <span className={cn("text-sm font-semibold tabular-nums", t.positive ? "text-emerald-600" : "text-foreground")}>
            {formatCurrency(t.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
