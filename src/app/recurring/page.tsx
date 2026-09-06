"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  CalendarClock,
  Loader2,
  AlertCircle,
  Receipt,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { StatusBadge } from "@/components/status-badge";
import { RecurringForm } from "@/components/recurring-form";
import { Field } from "@/components/form-field";
import {
  listRecurring,
  deleteRecurring,
  setRecurringActive,
  daysUntil,
  calculateNextDate,
  advanceRecurringDate,
  recordRecurringPayment,
  type Recurring,
} from "@/lib/recurring";
import { useSettings } from "@/components/settings-provider";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function dueLabel(days: number) {
  if (days < 0) return { text: `Overdue by ${-days}d`, tone: "text-red-600 dark:text-red-400", isOverdue: true };
  if (days === 0) return { text: "Due today", tone: "text-amber-600 dark:text-amber-400", isApproaching: true };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "text-amber-600 dark:text-amber-400", isApproaching: true };
  return { text: `Due in ${days}d`, tone: "text-muted-foreground", isNormal: true };
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function RecurringPage() {
  const [rows, setRows] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const { settings } = useSettings();
  const expenseCategories = settings?.expense_categories || [];

  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleting, setDeleting] = useState<Recurring | null>(null);
  const [recording, setRecording] = useState<Recurring | null>(null);
  const [recordDate, setRecordDate] = useState(todayStr());
  const [isRecordingSubmitting, setIsRecordingSubmitting] = useState(false);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const data = await listRecurring();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recurring expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const summary = useMemo(() => {
    const activeRows = rows.filter((r) => r.active);
    const monthlyTotal = activeRows.reduce((sum, r) => {
      if (r.frequency === "Monthly") return sum + r.amount;
      if (r.frequency === "Quarterly") return sum + r.amount / 3;
      return sum + r.amount / 12;
    }, 0);

    const yearlyTotal = activeRows.reduce((sum, r) => {
      if (r.frequency === "Monthly") return sum + r.amount * 12;
      if (r.frequency === "Quarterly") return sum + r.amount * 4;
      return sum + r.amount;
    }, 0);

    const upcomingList = activeRows.filter((r) => daysUntil(r.next_payment_date) <= 30);
    const overdueCount = activeRows.filter((r) => daysUntil(r.next_payment_date) < 0).length;

    return {
      activeCount: activeRows.length,
      totalCount: rows.length,
      upcomingCount: upcomingList.length,
      overdueCount,
      monthlyTotal,
      yearlyTotal,
    };
  }, [rows]);

  // Active items due within next 30 days or overdue, sorted with overdue & soonest first.
  const upcoming = useMemo(() => {
    return rows
      .filter((r) => r.active && daysUntil(r.next_payment_date) <= 30)
      .sort((a, b) => a.next_payment_date.localeCompare(b.next_payment_date));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const haystack = `${r.name} ${r.category} ${r.vendor ?? ""} ${r.notes ?? ""}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesCategory = category === "all" || r.category === category;
      const matchesStatus =
        status === "all" || (status === "active" ? r.active : !r.active);
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [rows, query, category, status]);

  const hasFilters = query !== "" || category !== "all" || status !== "all";

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setStatus("all");
  }

  async function toggleActive(r: Recurring) {
    try {
      await setRecurringActive(r.id, !r.active);
      toast.success(r.active ? "Deactivated" : "Activated");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleAdvanceDate(r: Recurring) {
    try {
      const next = await advanceRecurringDate(r.id, r.next_payment_date, r.frequency);
      toast.success(`Advanced next payment date to ${formatDate(next)}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to advance date");
    }
  }

  async function handleConfirmRecordExpense() {
    if (!recording) return;
    setIsRecordingSubmitting(true);
    try {
      // Books the expense and advances the next payment date in one transaction,
      // so a partial failure can't leave a booked charge that gets recorded twice.
      const nextDate = await recordRecurringPayment(recording.id, recordDate);

      toast.success(
        `Recorded ${formatINR(recording.amount)} expense. Next payment date advanced to ${formatDate(nextDate)}.`,
      );
      setRecording(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record expense");
    } finally {
      setIsRecordingSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteRecurring(deleting.id);
      toast.success("Recurring expense deleted");
      setDeleting(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring"
        description={loading ? "Loading…" : `${rows.length} recurring expenses`}
        action={<RecurringForm showTrigger onSaved={refetch} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Active Recurring"
          value={summary.activeCount.toString()}
          sub={`${summary.totalCount} total templates`}
        />
        <MetricCard
          label="Upcoming Payments"
          value={summary.upcomingCount.toString()}
          tone={summary.overdueCount > 0 ? "negative" : summary.upcomingCount > 0 ? "warning" : "default"}
          sub={summary.overdueCount > 0 ? `${summary.overdueCount} overdue` : "Due next 30 days"}
        />
        <MetricCard
          label="Monthly Recurring"
          value={formatINR(summary.monthlyTotal)}
          tone="negative"
          sub="Normalized per month"
        />
        <MetricCard
          label="Yearly Recurring"
          value={formatINR(summary.yearlyTotal)}
          tone="negative"
          sub="Projected annual total"
        />
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load recurring expenses</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming view */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Upcoming Payments — next 30 days
            </span>
            {summary.overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {summary.overdueCount} Overdue
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming payments due in the next 30 days.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((r) => {
                const due = dueLabel(daysUntil(r.next_payment_date));
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between",
                      due.isOverdue && "rounded px-2 bg-destructive/5",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        {r.vendor && (
                          <span className="text-xs text-muted-foreground">({r.vendor})</span>
                        )}
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {r.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.frequency} · Next: {formatDate(r.next_payment_date)} · {r.payment_method}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className={cn("text-xs font-medium whitespace-nowrap", due.tone)}>
                        {due.text}
                      </span>
                      <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                        {formatINR(r.amount)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          setRecording(r);
                          setRecordDate(r.next_payment_date);
                        }}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Record Expense
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recurring, vendor…"
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Next Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No recurring expenses yet" : "No results found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const days = daysUntil(r.next_payment_date);
                const isOverdue = r.active && days < 0;
                const isApproaching = r.active && days >= 0 && days <= 7;

                return (
                  <TableRow
                    key={r.id}
                    className={cn(
                      !r.active && "opacity-60",
                      isOverdue && "bg-destructive/5 hover:bg-destructive/10 border-l-2 border-l-destructive",
                      isApproaching && "bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-500",
                    )}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <span>{r.name}</span>
                        {r.notes && (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">{r.notes}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.vendor || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                      {formatINR(r.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.frequency}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.payment_method || "Bank Transfer"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{formatDate(r.next_payment_date)}</span>
                        {isOverdue && (
                          <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                            Overdue ({Math.abs(days)}d)
                          </Badge>
                        )}
                        {isApproaching && (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] py-0 px-1.5 dark:bg-amber-950/40 dark:text-amber-400"
                          >
                            {days === 0 ? "Due today" : `Due in ${days}d`}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleActive(r)}
                        className="cursor-pointer transition-opacity hover:opacity-80"
                        title="Click to toggle status"
                      >
                        <StatusBadge status={r.active ? "active" : "inactive"} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => {
                              setRecording(r);
                              setRecordDate(r.next_payment_date);
                            }}
                          >
                            <Receipt className="h-4 w-4" />
                            Record Expense
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handleAdvanceDate(r)}>
                            <RotateCw className="h-4 w-4" />
                            Advance Date (+1 cycle)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setEditing(r)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggleActive(r)}>
                            <Power className="h-4 w-4" />
                            {r.active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit (controlled) */}
      <RecurringForm
        recurring={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={refetch}
      />

      {/* Record Expense Dialog - Explicit action to create an expense */}
      <Dialog open={recording !== null} onOpenChange={(o) => !o && setRecording(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>
              Create an expense transaction for this recurring template and advance its next payment date.
            </DialogDescription>
          </DialogHeader>

          {recording && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium">{recording.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-destructive">{formatINR(recording.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category:</span>
                  <span>{recording.category}</span>
                </div>
                {recording.vendor && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendor:</span>
                    <span>{recording.vendor}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span>{recording.payment_method || "Bank Transfer"}</span>
                </div>
                <div className="flex justify-between pt-1 border-t text-xs text-muted-foreground">
                  <span>Next scheduled cycle:</span>
                  <span>
                    {formatDate(calculateNextDate(recording.next_payment_date, recording.frequency))}
                  </span>
                </div>
              </div>

              <Field label="Expense Date" htmlFor="record_date" required>
                <Input
                  id="record_date"
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecording(null)}
              disabled={isRecordingSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRecordExpense}
              disabled={isRecordingSubmitting}
            >
              {isRecordingSubmitting ? "Recording…" : "Record Expense & Advance Date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the recurring template. No actual expense records are affected.
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
