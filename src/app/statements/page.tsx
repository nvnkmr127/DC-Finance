"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Download, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { listPayments, type PaymentWithClient } from "@/lib/payments";
import { listExpenses, type Expense } from "@/lib/expenses";
import { listSalaryPayments, netSalary, type SalaryPayment, listEmployees, type Employee } from "@/lib/salaries";
import { listClients, monthlyEquivalent, type ClientSummary } from "@/lib/clients";
import { getOpeningBalance, setOpeningBalance, downloadCSV } from "@/lib/statements";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

const ym = (date: string) => date.slice(0, 7);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonth = () => `${currentMonth()}-01`;

export default function StatementsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [activeTab, setActiveTab] = useState("income");

  const [payments, setPayments] = useState<PaymentWithClient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [openingBalance, setOpeningBalanceState] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { formatCurrency } = useSettings();

  const [balanceInput, setBalanceInput] = useState("");
  const [savingBalance, setSavingBalance] = useState(false);

  // Transactions Tab Filters
  const [txFrom, setTxFrom] = useState(firstDayOfMonth());
  const [txTo, setTxTo] = useState(today());
  const [txType, setTxType] = useState("all");
  const [txClient, setTxClient] = useState("all");
  const [txCategory, setTxCategory] = useState("all");
  const [txSearch, setTxSearch] = useState("");

  const { settings } = useSettings();
  const expenseCategories = settings?.expense_categories || [];

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, e, s, emp, c, ob] = await Promise.all([
          listPayments(),
          listExpenses(),
          listSalaryPayments(),
          listEmployees(),
          listClients(),
          getOpeningBalance(month),
        ]);
        setPayments(p);
        setExpenses(e);
        setSalaries(s);
        setEmployees(emp);
        setClients(c);
        setOpeningBalanceState(ob);
        setBalanceInput(ob?.toString() ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load statements");
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  async function handleSaveBalance() {
    try {
      setSavingBalance(true);
      const val = parseFloat(balanceInput);
      if (isNaN(val)) throw new Error("Invalid number");
      await setOpeningBalance(month, val);
      setOpeningBalanceState(val);
      toast.success("Opening balance updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save balance");
    } finally {
      setSavingBalance(false);
    }
  }

  // --- Computations ---
  
  // Income Statement
  const incomeData = useMemo(() => {
    const revenue = payments.filter(p => ym(p.payment_date) === month).reduce((s, p) => s + p.amount, 0);
    const exp = expenses.filter(e => ym(e.expense_date) === month).reduce((s, e) => s + e.amount, 0);
    const sal = salaries.filter(s => ym(s.payment_date) === month).reduce((s, p) => s + netSalary(p), 0);
    const profit = revenue - exp - sal;
    return { revenue, expenses: exp, salaries: sal, profit };
  }, [payments, expenses, salaries, month]);

  // Expense Statement
  const expenseData = useMemo(() => {
    const cats = new Map<string, number>();
    let total = 0;
    for (const e of expenses) {
      if (ym(e.expense_date) === month) {
        cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
        total += e.amount;
      }
    }
    const arr = [...cats.entries()].map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percent: total > 0 ? (amt / total) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
    return { list: arr, total };
  }, [expenses, month]);

  // Cash Flow Statement
  const cashFlowData = useMemo(() => {
    const received = incomeData.revenue;
    const spent = incomeData.expenses + incomeData.salaries;
    const opening = openingBalance ?? 0;
    const closing = opening + received - spent;
    return { opening, received, spent, closing };
  }, [incomeData, openingBalance]);

  // Client Outstanding Statement
  const clientData = useMemo(() => {
    const receivedByClient = new Map<string, number>();
    for (const p of payments) {
      if (ym(p.payment_date) === month) {
        receivedByClient.set(p.client_id, (receivedByClient.get(p.client_id) ?? 0) + p.amount);
      }
    }
    return clients.map(c => {
      const received = receivedByClient.get(c.id) ?? 0;
      const billed = monthlyEquivalent(c);
      const outstanding = Math.max(billed - received, 0);
      return { name: c.name, billed, received, outstanding };
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [payments, clients, month]);

  // Salary Statement
  const salaryData = useMemo(() => {
    const paidByEmp = new Map<string, number>();
    for (const s of salaries) {
      if (ym(s.payment_date) === month) {
        paidByEmp.set(s.employee_id, (paidByEmp.get(s.employee_id) ?? 0) + netSalary(s));
      }
    }
    return employees.map(e => {
      const paid = paidByEmp.get(e.id) ?? 0;
      const pending = e.status === "active" ? Math.max(e.salary - paid, 0) : 0;
      return { name: e.name, base: e.salary, paid, pending };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [salaries, employees, month]);

  // Transactions Statement
  const transactionData = useMemo(() => {
    const allTxs = [];

    for (const p of payments) {
      allTxs.push({
        id: p.id,
        date: p.payment_date,
        createdAt: p.created_at,
        clientId: p.client_id,
        type: "Income",
        description: p.notes || "Payment received",
        entity: p.clients?.name || "Unknown",
        category: "Payment",
        income: p.amount,
        expense: 0,
      });
    }
    for (const e of expenses) {
      allTxs.push({
        id: e.id,
        date: e.expense_date,
        createdAt: e.created_at,
        clientId: null,
        type: "Expense",
        description: e.description,
        entity: e.vendor || "-",
        category: e.category,
        income: 0,
        expense: e.amount,
      });
    }
    for (const s of salaries) {
      allTxs.push({
        id: s.id,
        date: s.payment_date,
        createdAt: s.created_at,
        clientId: null,
        type: "Expense",
        description: s.notes || "Salary payment",
        entity: s.employees?.name || "Unknown",
        category: "Salary",
        income: 0,
        expense: netSalary(s),
      });
    }

    // Chronological order, tie-broken by created_at so the running balance below
    // is deterministic when several transactions share a date.
    allTxs.sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    );

    // All-time running net position (from zero). This is a net-since-inception
    // ledger; it intentionally does not use the per-month opening_balances,
    // which drive the separate Cash Flow tab.
    let currentBalance = 0;
    const txsWithBalance = allTxs.map(tx => {
      currentBalance = currentBalance + tx.income - tx.expense;
      return { ...tx, balance: currentBalance };
    });

    // Apply filters
    const filtered = txsWithBalance.filter(tx => {
      const inDateRange = tx.date >= txFrom && tx.date <= txTo;
      const matchType = txType === "all" || tx.type.toLowerCase() === txType;
      const matchClient = txClient === "all" || (tx.type === "Income" ? tx.clientId === txClient : true);
      const matchCategory = txCategory === "all" || tx.category === txCategory;
      const search = txSearch.toLowerCase();
      const matchSearch = search === "" || 
        tx.description.toLowerCase().includes(search) || 
        tx.entity.toLowerCase().includes(search) ||
        tx.category.toLowerCase().includes(search);
      return inDateRange && matchType && matchClient && matchCategory && matchSearch;
    });

    // Sort descending for display (newest first), stable on same-date rows.
    return filtered.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );

  }, [payments, expenses, salaries, txFrom, txTo, txType, txClient, txCategory, txSearch]);

  const hasTxFilters = txFrom !== firstDayOfMonth() || txTo !== today() || txType !== "all" || txClient !== "all" || txCategory !== "all" || txSearch !== "";
  function resetTxFilters() {
    setTxFrom(firstDayOfMonth());
    setTxTo(today());
    setTxType("all");
    setTxClient("all");
    setTxCategory("all");
    setTxSearch("");
  }


  // --- Exports ---
  
  const handlePrint = () => window.print();

  const handleExport = () => {
    const m = month;
    if (activeTab === "income") {
      downloadCSV(`Income_Statement_${m}.csv`, ["Metric", "Amount"], [
        ["Revenue", incomeData.revenue],
        ["Expenses", incomeData.expenses],
        ["Salaries", incomeData.salaries],
        ["Net Profit", incomeData.profit],
      ]);
    } else if (activeTab === "expense") {
      downloadCSV(`Expense_Statement_${m}.csv`, ["Category", "Amount", "Percentage"], expenseData.list.map(r => [
        r.category, r.amount, `${r.percent.toFixed(1)}%`
      ]));
    } else if (activeTab === "cashflow") {
      downloadCSV(`Cash_Flow_Statement_${m}.csv`, ["Metric", "Amount"], [
        ["Opening Balance", cashFlowData.opening],
        ["Money Received", cashFlowData.received],
        ["Money Spent", cashFlowData.spent],
        ["Closing Balance", cashFlowData.closing],
      ]);
    } else if (activeTab === "client") {
      downloadCSV(`Client_Outstanding_${m}.csv`, ["Client", "Total Billed", "Total Received", "Outstanding"], clientData.map(r => [
        r.name, r.billed, r.received, r.outstanding
      ]));
    } else if (activeTab === "salary") {
      downloadCSV(`Salary_Statement_${m}.csv`, ["Employee", "Monthly Salary", "Paid", "Pending"], salaryData.map(r => [
        r.name, r.base, r.paid, r.pending
      ]));
    } else if (activeTab === "transactions") {
      downloadCSV(`Transactions_${txFrom}_to_${txTo}.csv`, ["Date", "Type", "Description", "Entity", "Category", "Income", "Expense", "Balance"], transactionData.map(r => [
        formatDate(r.date), r.type, r.description, r.entity, r.category, r.income, r.expense, r.balance
      ]));
    }
  };

  const monthLabel = new Date(`${month}-01`).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="print-hide flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader title="Financial Statements" description={`Reports for ${activeTab === 'transactions' ? 'Transactions' : monthLabel}`} />
        <div className="flex items-center gap-3">
          {activeTab !== "transactions" && (
            <Input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="w-44"
            />
          )}
          <Button variant="outline" size="icon" onClick={handlePrint} title="Print">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleExport} title="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Print only header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold">Financial Statements - {activeTab === 'transactions' ? `Transactions (${formatDate(txFrom)} to ${formatDate(txTo)})` : monthLabel}</h1>
      </div>

      {error && (
        <Card className="print-hide">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load statements</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center print-hide">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 print:space-y-8">
          <TabsList className="print-hide overflow-x-auto flex flex-nowrap w-full justify-start h-auto p-1">
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="client">Client Outstanding</TabsTrigger>
            <TabsTrigger value="salary">Salary</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          {/* Income Statement */}
          <TabsContent value="income" className="print:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Income Statement</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Revenue</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(incomeData.revenue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Expenses</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(incomeData.expenses)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Salaries</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(incomeData.salaries)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold">Net Profit</TableCell>
                      <TableCell className={cn("text-right font-bold tabular-nums", incomeData.profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {formatCurrency(incomeData.profit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expense Statement */}
          <TabsContent value="expense" className="print:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseData.list.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No expenses this month</TableCell>
                      </TableRow>
                    ) : (
                      expenseData.list.map(r => (
                        <TableRow key={r.category}>
                          <TableCell className="font-medium">{r.category}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(r.amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.percent.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                    {expenseData.list.length > 0 && (
                       <TableRow className="bg-muted/50 font-bold">
                          <TableCell>Total Expenses</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(expenseData.total)}</TableCell>
                          <TableCell className="text-right tabular-nums">100%</TableCell>
                       </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Statement */}
          <TabsContent value="cashflow" className="print:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cash Flow Statement</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        Opening Balance
                        <div className="mt-2 flex items-center gap-2 print-hide max-w-[250px]">
                          <Input 
                            type="number" 
                            size={10} 
                            placeholder="Set opening balance..." 
                            value={balanceInput}
                            onChange={e => setBalanceInput(e.target.value)}
                            className="h-8 w-32"
                          />
                          <Button size="sm" onClick={handleSaveBalance} disabled={savingBalance}>Save</Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold align-top pt-4">
                        {formatCurrency(cashFlowData.opening)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Money Received</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">+{formatCurrency(cashFlowData.received)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Money Spent</TableCell>
                      <TableCell className="text-right tabular-nums text-red-600">-{formatCurrency(cashFlowData.spent)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell className="font-bold">Closing Balance</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        {formatCurrency(cashFlowData.closing)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Outstanding Statement */}
          <TabsContent value="client" className="print:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Total Billed</TableHead>
                      <TableHead className="text-right">Total Received</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No clients found</TableCell>
                      </TableRow>
                    ) : (
                      clientData.map(c => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(c.billed)}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(c.received)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums font-semibold", c.outstanding > 0 ? "text-amber-600" : "text-muted-foreground")}>
                            {formatCurrency(c.outstanding)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Salary Statement */}
          <TabsContent value="salary" className="print:block">
             <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Monthly Salary</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No employees found</TableCell>
                      </TableRow>
                    ) : (
                      salaryData.map(s => (
                        <TableRow key={s.name}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(s.base)}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(s.paid)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums font-semibold", s.pending > 0 ? "text-amber-600" : "text-muted-foreground")}>
                            {formatCurrency(s.pending)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Statement */}
          <TabsContent value="transactions" className="print:block space-y-4">
            <div className="print-hide flex flex-wrap items-center gap-3">
              <Input
                type="date"
                value={txFrom}
                onChange={e => setTxFrom(e.target.value)}
                className="w-36"
                title="From Date"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={txTo}
                onChange={e => setTxTo(e.target.value)}
                className="w-36"
                title="To Date"
              />
              <Select value={txType} onValueChange={setTxType}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              <Select value={txClient} onValueChange={setTxClient}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={txCategory} onValueChange={setTxCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Payment">Payment</SelectItem>
                  <SelectItem value="Salary">Salary</SelectItem>
                  {expenseCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search client, employee, category..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {hasTxFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetTxFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reset
                </Button>
              )}
            </div>
            
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Client/Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Income</TableHead>
                      <TableHead className="text-right">Expense</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No transactions found</TableCell>
                      </TableRow>
                    ) : (
                      transactionData.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                          <TableCell>
                            <span className={cn("px-2 py-1 rounded-full text-xs font-medium", tx.type === "Income" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                              {tx.type}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={tx.description}>{tx.description}</TableCell>
                          <TableCell className="truncate max-w-[150px]">{tx.entity}</TableCell>
                          <TableCell className="text-muted-foreground">{tx.category}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-600">{tx.income > 0 ? formatCurrency(tx.income) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-red-600">{tx.expense > 0 ? formatCurrency(tx.expense) : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(tx.balance)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}
