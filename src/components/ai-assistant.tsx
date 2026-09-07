"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/settings-provider";
import { listPayments } from "@/lib/payments";
import { listExpenses } from "@/lib/expenses";
import { listSalaryPayments, netSalary } from "@/lib/salaries";
import { listClients, monthlyEquivalent } from "@/lib/clients";
import { listEmployees } from "@/lib/salaries";
import { listRecurring } from "@/lib/recurring";
import { financialYear } from "@/lib/format";
import { useExpenseOnly } from "@/components/role";

type Msg = { role: "user" | "assistant"; content: string };

async function askAi(payload: object): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI request failed");
  return data.text as string;
}

// Company-wide finance snapshot the AI reasons over. Attribution matches the app:
// revenue by billing_month, salaries by salary_month.
async function buildSnapshot(fyStart: string) {
  const [payments, expenses, salaries, clients, employees, recurring] = await Promise.all([
    listPayments(),
    listExpenses(),
    listSalaryPayments(),
    listClients(),
    listEmployees(),
    listRecurring().catch(() => []),
  ]);

  const month = new Date().toISOString().slice(0, 7);
  const fy = financialYear(fyStart);
  const inFyMonth = (m: string) => `${m}-01` >= fy.start && `${m}-01` < fy.end;
  const inFy = (d: string) => d >= fy.start && d < fy.end;

  const revenueMonth = payments.filter((p) => p.billing_month === month).reduce((s, p) => s + p.amount, 0);
  const expensesMonth = expenses.filter((e) => e.expense_date.slice(0, 7) === month).reduce((s, e) => s + e.amount, 0);
  const salariesMonth = salaries.filter((p) => p.salary_month === month).reduce((s, p) => s + netSalary(p), 0);

  const receivedByClient = new Map<string, number>();
  for (const p of payments) if (p.billing_month === month) receivedByClient.set(p.client_id, (receivedByClient.get(p.client_id) ?? 0) + p.amount);
  const outstanding = clients.reduce((s, c) => s + Math.max(monthlyEquivalent(c) - (receivedByClient.get(c.id) ?? 0), 0), 0);

  const paidByEmp = new Map<string, number>();
  for (const p of salaries) if (p.salary_month === month) paidByEmp.set(p.employee_id, (paidByEmp.get(p.employee_id) ?? 0) + netSalary(p));
  const pendingSalaries = employees
    .filter((e) => e.status === "active")
    .map((e) => ({ name: e.name, remaining: Math.max(e.salary - (paidByEmp.get(e.id) ?? 0), 0) }))
    .filter((e) => e.remaining > 0);

  const group = (m: Map<string, number>) => [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const catMap = new Map<string, number>();
  for (const e of expenses) if (e.expense_date.slice(0, 7) === month) catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amount);
  const clientMap = new Map<string, number>();
  for (const p of payments) if (p.billing_month === month) clientMap.set(p.clients?.name ?? "Unknown", (clientMap.get(p.clients?.name ?? "Unknown") ?? 0) + p.amount);

  const fyRevenue = payments.filter((p) => inFyMonth(p.billing_month)).reduce((s, p) => s + p.amount, 0);
  const fyExpenses = expenses.filter((e) => inFy(e.expense_date)).reduce((s, e) => s + e.amount, 0);
  const fySalaries = salaries.filter((p) => inFyMonth(p.salary_month)).reduce((s, p) => s + netSalary(p), 0);

  return {
    month,
    thisMonth: { revenue: revenueMonth, expenses: expensesMonth, salaries: salariesMonth, netProfit: revenueMonth - expensesMonth - salariesMonth },
    financialYearToDate: { label: fy.label, revenue: fyRevenue, expenses: fyExpenses + fySalaries, netProfit: fyRevenue - fyExpenses - fySalaries },
    outstanding,
    pendingSalaries,
    recurringMonthly: recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0),
    topClientsThisMonth: group(clientMap),
    expensesByCategoryThisMonth: group(catMap),
    counts: { clients: clients.length, employees: employees.length },
  };
}

export function AiAssistant() {
  const { settings } = useSettings();
  const expenseOnly = useExpenseOnly();
  const currency = settings?.default_currency || "INR";
  const fyStart = settings?.financial_year_start || "04-01";

  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<unknown>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [ctxErr, setCtxErr] = useState<string | null>(null);

  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load the snapshot the first time the assistant is opened.
  useEffect(() => {
    if (!open || context || loadingCtx) return;
    setLoadingCtx(true);
    setCtxErr(null);
    buildSnapshot(fyStart)
      .then(setContext)
      .catch((e) => setCtxErr(e instanceof Error ? e.message : "Failed to load data"))
      .finally(() => setLoadingCtx(false));
  }, [open, context, loadingCtx, fyStart]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function generate() {
    if (!context) return;
    setLoadingInsights(true);
    try {
      setInsights(await askAi({ mode: "insights", currency, context }));
    } catch (e) {
      setInsights(`⚠️ ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setLoadingInsights(false);
    }
  }

  async function send() {
    const q = input.trim();
    if (!q || busy || !context) return;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await askAi({ mode: "chat", currency, context, messages: next });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Failed"}` }]);
    } finally {
      setBusy(false);
    }
  }

  if (expenseOnly) return null; // data-entry role has no AI access

  return (
    <>
      <Button
        onClick={() => setOpen((o) => !o)}
        size="icon"
        className="print-hide fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-lg"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="print-hide fixed bottom-20 right-5 z-50 flex h-[30rem] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-semibold">AI Assistant</p>
            <span className="ml-auto text-xs text-muted-foreground">whole business</span>
          </div>

          {ctxErr ? (
            <div className="p-4 text-sm text-destructive">{ctxErr}</div>
          ) : loadingCtx || !context ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="insights" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-3 mt-2">
                <TabsTrigger value="insights">Summary</TabsTrigger>
                <TabsTrigger value="chat">Ask</TabsTrigger>
              </TabsList>

              <TabsContent value="insights" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                <Button onClick={generate} disabled={loadingInsights} size="sm">
                  {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {insights ? "Regenerate" : "Summarize business"}
                </Button>
                {insights && (
                  <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{insights}</div>
                )}
              </TabsContent>

              <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col p-0">
                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
                  {messages.length === 0 ? (
                    <p className="text-muted-foreground">Ask anything — “Who owes the most?”, “Is this month profitable?”</p>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                        <span className={cn("inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2", m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-background")}>
                          {m.content}
                        </span>
                      </div>
                    ))
                  )}
                  {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={busy} />
                  <Button type="submit" size="icon" disabled={busy || !input.trim()}><Send className="h-4 w-4" /></Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
    </>
  );
}
