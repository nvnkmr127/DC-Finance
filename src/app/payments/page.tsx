"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
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
import { PaymentForm } from "@/components/payment-form";
import { listPayments, deletePayment, type PaymentWithClient } from "@/lib/payments";
import { listClients, type ClientSummary } from "@/lib/clients";
import { formatINR, formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentWithClient[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [client, setClient] = useState("all");
  const [method, setMethod] = useState("all");
  const [sort, setSort] = useState("newest");

  const { settings } = useSettings();
  const paymentMethods = settings?.payment_methods || [];

  const [editing, setEditing] = useState<PaymentWithClient | null>(null);
  const [deleting, setDeleting] = useState<PaymentWithClient | null>(null);
  const [viewing, setViewing] = useState<PaymentWithClient | null>(null);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([listPayments(), listClients()]);
      setPayments(p);
      setClients(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  const summary = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthPrefix = now.toISOString().slice(0, 7);
    const yearPrefix = now.toISOString().slice(0, 4);
    const sumIf = (fn: (p: PaymentWithClient) => boolean) =>
      payments.filter(fn).reduce((s, p) => s + p.amount, 0);
    return {
      today: sumIf((p) => p.payment_date === todayStr),
      thisMonth: sumIf((p) => p.payment_date.startsWith(monthPrefix)),
      thisYear: sumIf((p) => p.payment_date.startsWith(yearPrefix)),
      total: sumIf(() => true),
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = payments.filter((p) => {
      const haystack = `${p.clients?.name ?? ""} ${p.clients?.company ?? ""} ${p.reference_number ?? ""} ${p.notes ?? ""}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      const matchesMonth = !month || p.payment_date.startsWith(month);
      const matchesClient = client === "all" || p.client_id === client;
      const matchesMethod = method === "all" || p.payment_method === method;
      return matchesQuery && matchesMonth && matchesClient && matchesMethod;
    });
    return [...list].sort((a, b) =>
      sort === "newest"
        ? b.payment_date.localeCompare(a.payment_date)
        : a.payment_date.localeCompare(b.payment_date),
    );
  }, [payments, query, month, client, method, sort]);

  const hasFilters = query !== "" || month !== "" || client !== "all" || method !== "all" || sort !== "newest";

  function resetFilters() {
    setQuery("");
    setMonth("");
    setClient("all");
    setMethod("all");
    setSort("newest");
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deletePayment(deleting.id);
      toast.success("Payment deleted");
      setDeleting(null);
      refetch(); // refreshes client totals + summary cards
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete payment");
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description={loading ? "Loading…" : `${payments.length} payments`}
        action={<PaymentForm showTrigger clients={clients} onSaved={refetch} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Today" value={formatINR(summary.today)} />
        <MetricCard label="This Month" value={formatINR(summary.thisMonth)} tone="positive" />
        <MetricCard label="This Year" value={formatINR(summary.thisYear)} />
        <MetricCard label="Total Received" value={formatINR(summary.total)} tone="positive" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client, reference, notes…"
            className="pl-9"
          />
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="sm:w-40"
          aria-label="Filter by month"
        />
        <Select value={client} onValueChange={setClient}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger className="sm:w-40">
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
              <p className="font-medium text-destructive">Couldn’t load payments</p>
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
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  {payments.length === 0 ? "No payments recorded yet" : "No results found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setViewing(p)}>
                  <TableCell className="text-muted-foreground">{formatDate(p.payment_date)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${p.client_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium hover:underline"
                    >
                      {p.clients?.name ?? "Unknown"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{p.clients?.company}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                    {formatINR(p.amount)}
                  </TableCell>
                  <TableCell>{p.payment_method}</TableCell>
                  <TableCell className="text-muted-foreground">{p.reference_number || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setViewing(p)}>
                          <Eye className="h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
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

      {/* View details */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>{viewing && formatDate(viewing.payment_date)}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="col-span-2 font-medium">
                {viewing.clients?.name}
                {viewing.clients?.company ? ` · ${viewing.clients.company}` : ""}
              </dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="col-span-2 font-semibold tabular-nums text-emerald-600">
                {formatINR(viewing.amount)}
              </dd>
              <dt className="text-muted-foreground">Method</dt>
              <dd className="col-span-2">{viewing.payment_method}</dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="col-span-2">{viewing.reference_number || "—"}</dd>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="col-span-2 whitespace-pre-wrap">{viewing.notes || "—"}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit (controlled) */}
      <PaymentForm
        clients={clients}
        payment={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={refetch}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                `${formatINR(deleting.amount)} from ${deleting.clients?.name ?? "client"} on ${formatDate(deleting.payment_date)}. This can't be undone and will update client totals.`}
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
