"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, MoreHorizontal, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { ExpenseForm } from "@/components/expense-form";
import { useExpenseOnly } from "@/components/role";
import { useAuth } from "@/components/auth-provider";
import {
  listExpenses,
  deleteExpense,
  type Expense,
} from "@/lib/expenses";
import { formatINR, formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [method, setMethod] = useState("all");
  const [sort, setSort] = useState("newest");

  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const { settings } = useSettings();
  const { session } = useAuth();
  const expenseOnly = useExpenseOnly();
  const expenseCategories = settings?.expense_categories || [];
  const paymentMethods = settings?.payment_methods || [];

  // Expense-only users see just the rows they entered; admins see everything.
  const ownerId = expenseOnly ? session?.user?.id : undefined;

  async function refetch() {
    setError(null);
    try {
      setExpenses(await listExpenses(ownerId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  // Wait for settings (which decide the role) before loading, so a restricted
  // user never briefly sees everyone's expenses. Reloads if the role resolves.
  useEffect(() => {
    if (!settings) return;
    let ignore = false;
    listExpenses(ownerId)
      .then((data) => { if (!ignore) { setExpenses(data); setLoading(false); } })
      .catch((e) => { if (!ignore) { setError(e instanceof Error ? e.message : "Failed to load expenses"); setLoading(false); } });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, ownerId]);

  const summary = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthPrefix = now.toISOString().slice(0, 7);
    const yearPrefix = now.toISOString().slice(0, 4);
    const sumIf = (fn: (e: Expense) => boolean) =>
      expenses.filter(fn).reduce((s, e) => s + e.amount, 0);

    return {
      today: sumIf((e) => e.expense_date === todayStr),
      thisMonth: sumIf((e) => e.expense_date.startsWith(monthPrefix)),
      thisYear: sumIf((e) => e.expense_date.startsWith(yearPrefix)),
      total: sumIf(() => true),
    };
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = expenses.filter((e) => {
      const haystack = `${e.description} ${e.category} ${e.vendor ?? ""} ${e.notes ?? ""}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesCategory = category === "all" || e.category === category;
      const matchesDate = !dateFilter || e.expense_date.startsWith(dateFilter);
      const matchesMethod = method === "all" || e.payment_method === method;
      return matchesQuery && matchesCategory && matchesDate && matchesMethod;
    });

    return [...list].sort((a, b) =>
      sort === "newest"
        ? b.expense_date.localeCompare(a.expense_date)
        : a.expense_date.localeCompare(b.expense_date),
    );
  }, [expenses, query, category, dateFilter, method, sort]);

  const hasFilters =
    query !== "" ||
    category !== "all" ||
    dateFilter !== "" ||
    method !== "all" ||
    sort !== "newest";

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setDateFilter("");
    setMethod("all");
    setSort("newest");
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteExpense(deleting.id);
      toast.success("Expense deleted");
      setDeleting(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete expense");
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={loading ? "Loading…" : `${expenses.length} expenses`}
        action={<ExpenseForm showTrigger onSaved={refetch} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Today's Expenses" value={formatINR(summary.today)} tone="negative" />
        <MetricCard label="This Month's Expenses" value={formatINR(summary.thisMonth)} tone="negative" />
        <MetricCard label="This Year's Expenses" value={formatINR(summary.thisYear)} tone="negative" />
        <MetricCard label="Total Expenses" value={formatINR(summary.total)} tone="negative" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, vendor…"
            className="pl-9"
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {expenseCategories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="sm:w-40"
          aria-label="Filter by date"
        />

        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {paymentMethods.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Date: Newest</SelectItem>
            <SelectItem value="oldest">Date: Oldest</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load expenses</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              {!expenseOnly && <TableHead>Added by</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={expenseOnly ? 7 : 8} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={expenseOnly ? 7 : 8} className="h-32 text-center text-sm text-muted-foreground">
                  {expenses.length === 0 ? "No expenses recorded yet" : "No results found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(e.expense_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{e.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <span>{e.description}</span>
                      {e.recurring && (
                        <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10px] font-normal text-teal-700 py-0 px-1.5 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-400">
                          Recurring
                        </Badge>
                      )}
                    </div>
                    {e.notes && (
                      <p className="max-w-xs truncate text-xs text-muted-foreground">{e.notes}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.vendor || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                    {formatINR(e.amount)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{e.payment_method}</TableCell>
                  {!expenseOnly && (
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {e.created_by_email || "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(e)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(e)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit (controlled) */}
      <ExpenseForm
        expense={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={refetch}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                `${deleting.description}${deleting.vendor ? ` (${deleting.vendor})` : ""} — ${formatINR(deleting.amount)} on ${formatDate(deleting.expense_date)}. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
