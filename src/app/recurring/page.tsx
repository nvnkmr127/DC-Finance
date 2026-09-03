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
import { StatusBadge } from "@/components/status-badge";
import { RecurringForm } from "@/components/recurring-form";
import {
  listRecurring,
  deleteRecurring,
  setRecurringActive,
  daysUntil,
  type Recurring,
} from "@/lib/recurring";
import { formatINR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function dueLabel(days: number) {
  if (days < 0) return { text: `Overdue by ${-days}d`, tone: "text-red-600" };
  if (days === 0) return { text: "Due today", tone: "text-amber-600" };
  if (days <= 7) return { text: `Due in ${days}d`, tone: "text-amber-600" };
  return { text: `Due in ${days}d`, tone: "text-muted-foreground" };
}

export default function RecurringPage() {
  const [rows, setRows] = useState<Recurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [deleting, setDeleting] = useState<Recurring | null>(null);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listRecurring());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recurring expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  // Active items due within the next 30 days (or overdue), soonest first.
  const upcoming = useMemo(
    () => rows.filter((r) => r.active && daysUntil(r.next_payment_date) <= 30),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        [r.name, r.category, r.notes ?? ""].some((v) => v.toLowerCase().includes(q));
      const matchesStatus =
        status === "all" || (status === "active" ? r.active : !r.active);
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, status]);

  async function toggleActive(r: Recurring) {
    try {
      await setRecurringActive(r.id, !r.active);
      toast.success(r.active ? "Deactivated" : "Activated");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Upcoming — next 30 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the next 30 days.</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((r) => {
                const label = dueLabel(daysUntil(r.next_payment_date));
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.frequency} · {formatDate(r.next_payment_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className={cn("text-xs font-medium", label.tone)}>{label.text}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatINR(r.amount)}
                      </span>
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
            placeholder="Search recurring…"
            className="pl-9"
          />
        </div>
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Next Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No recurring expenses yet" : "No results found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className={cn(!r.active && "opacity-60")}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(r.amount)}
                  </TableCell>
                  <TableCell>{r.frequency}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.next_payment_date)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.active ? "active" : "inactive"} />
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
              ))
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

      {/* Delete confirm */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the recurring template. No expense records are affected.
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
