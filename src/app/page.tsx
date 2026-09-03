"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Wallet,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import {
  RevenueExpenseLineChart,
  ProfitBarChart,
  BreakdownDonut,
  HorizontalBar,
} from "@/components/charts";
import { listPayments, type PaymentWithClient } from "@/lib/payments";
import { listExpenses, type Expense } from "@/lib/expenses";
import { listSalaryPayments, netSalary, type SalaryPayment, listEmployees, type Employee } from "@/lib/salaries";
import { listClients, type ClientSummary } from "@/lib/clients";
import { listRecurring, daysUntil, type Recurring } from "@/lib/recurring";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const ym = (date: string) => date.slice(0, 7);

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency } = useSettings();

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

  const d = useMemo(() => {
    // Per-month aggregates from actual records. Missing months resolve to 0
    // because the reducers run over an (often empty) filtered slice.
    const revenueIn = (key: string) =>
      payments.filter((p) => ym(p.payment_date) === key).reduce((s, p) => s + p.amount, 0);
    const expensesIn = (key: string) =>
      expenses.filter((e) => ym(e.expense_date) === key).reduce((s, e) => s + e.amount, 0);
    const salariesIn = (key: string) =>
      salaries.filter((p) => ym(p.payment_date) === key).reduce((s, p) => s + netSalary(p), 0);

    // Last 12 months ending at the selected month.
    const months = monthsRange(month, 12).map(({ key, label }) => {
      const revenue = revenueIn(key);
      const exp = expensesIn(key);
      const sal = salariesIn(key);
      const totalExpenses = exp + sal;
      return { key, month: label, revenue, expenses: exp, salaries: sal, totalExpenses, profit: revenue - totalExpenses };
    });

    const selected = months[months.length - 1];

    // Outstanding = each client's monthly billing − payments received this month.
    const receivedByClient = new Map<string, number>();
    for (const p of payments) {
      if (ym(p.payment_date) === month) {
        receivedByClient.set(p.client_id, (receivedByClient.get(p.client_id) ?? 0) + p.amount);
      }
    }
    const outstanding = clients.reduce(
      (s, c) => s + Math.max(c.monthly_value - (receivedByClient.get(c.id) ?? 0), 0),
      0,
    );

    const clientsWithOutstanding = clients.map(c => {
      const remaining = Math.max(c.monthly_value - (receivedByClient.get(c.id) ?? 0), 0);
      return { name: c.name, remaining };
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
      if (ym(p.payment_date) !== month) continue;
      clientMap.set(p.clients?.name ?? "Unknown", (clientMap.get(p.clients?.name ?? "Unknown") ?? 0) + p.amount);
    }
    const topClients = [...clientMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const upcoming = recurring.filter((r) => r.active && daysUntil(r.next_payment_date) <= 30).sort((a,b) => new Date(a.next_payment_date).getTime() - new Date(b.next_payment_date).getTime()).slice(0, 5);

    // Pending salaries
    const paidByEmployee = new Map<string, number>();
    for (const p of salaries) {
      if (ym(p.payment_date) === month) {
        paidByEmployee.set(p.employee_id, (paidByEmployee.get(p.employee_id) ?? 0) + netSalary(p));
      }
    }
    const pendingSalaries = employees.filter(e => e.status === "active").map(e => {
      const remaining = Math.max(e.salary - (paidByEmployee.get(e.id) ?? 0), 0);
      return { name: e.name, remaining };
    }).filter(e => e.remaining > 0).sort((a, b) => b.remaining - a.remaining);

    return {
      selected,
      outstanding,
      totalRecurring,
      months,
      categories,
      topClients,
      clientsWithOutstanding,
      upcoming,
      pendingSalaries,
      recentPayments: payments.slice(0, 5),
      recentExpenses: expenses.slice(0, 5),
    };
  }, [payments, expenses, salaries, employees, clients, recurring, month]);

  const monthLabel = new Date(`${month}-01`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

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
            <StatCard title="Revenue" value={d.selected.revenue} icon={TrendingUp} accent="positive" hint="Payments received" />
            <StatCard title="Expenses" value={d.selected.expenses} icon={TrendingDown} accent="negative" hint="Business expenses" />
            <StatCard title="Salaries" value={d.selected.salaries} icon={Users} accent="negative" hint="Net salary paid" />
            <StatCard title="Net Profit" value={d.selected.profit} icon={Wallet} accent={d.selected.profit >= 0 ? "positive" : "negative"} hint="Revenue − expenses − salaries" />
            <StatCard title="Outstanding" value={d.outstanding} icon={Clock} accent="warning" hint="Billing − received" />
            <StatCard title="Recurring Expenses" value={d.totalRecurring} icon={RefreshCw} accent="default" hint="Monthly active recurring" />
          </div>

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
                  {d.clientsWithOutstanding.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
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
                  {d.pendingSalaries.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <span className="text-sm font-semibold tabular-nums text-amber-600">{formatCurrency(e.remaining)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

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
