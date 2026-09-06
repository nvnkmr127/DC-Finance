"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
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
import { InvoiceForm } from "@/components/invoice-form";
import {
  listInvoices,
  deleteInvoice,
  getInvoiceItems,
  type InvoiceSummary,
  type InvoiceItemInput,
} from "@/lib/invoices";
import { listClients, type ClientSummary } from "@/lib/clients";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const [editing, setEditing] = useState<InvoiceSummary | null>(null);
  const [editingItems, setEditingItems] = useState<InvoiceItemInput[] | undefined>();
  const [deleting, setDeleting] = useState<InvoiceSummary | null>(null);

  const { formatCurrency } = useSettings();

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const [inv, cl] = await Promise.all([listInvoices(), listClients()]);
      setRows(inv);
      setClients(cl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  async function openEdit(inv: InvoiceSummary) {
    try {
      const items = await getInvoiceItems(inv.id);
      setEditingItems(
        items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      );
      setEditing(inv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load invoice");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteInvoice(deleting.id);
      toast.success("Invoice deleted");
      setDeleting(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete invoice");
      setDeleting(null);
    }
  }

  const summary = useMemo(() => {
    const outstanding = rows.reduce((s, r) => s + r.balance, 0);
    const overdue = rows
      .filter((r) => r.display_status !== "paid" && r.status !== "cancelled" && r.due_date < new Date().toISOString().slice(0, 10))
      .reduce((s, r) => s + r.balance, 0);
    const paid = rows.reduce((s, r) => s + r.paid, 0);
    return { outstanding, overdue, paid, count: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        [r.invoice_number, r.client_name, r.client_company].some((v) =>
          v?.toLowerCase().includes(q),
        );
      const matchesStatus = status === "all" || r.display_status === status;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, status]);

  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name, company: c.company }));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={loading ? "Loading…" : `${rows.length} invoices`}
        action={<InvoiceForm clients={clientOpts} showTrigger onSaved={refetch} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Outstanding" value={formatCurrency(summary.outstanding)} tone="warning" />
        <MetricCard label="Overdue" value={formatCurrency(summary.overdue)} tone="negative" />
        <MetricCard label="Total Collected" value={formatCurrency(summary.paid)} tone="positive" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoices…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load invoices</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No invoices yet" : "No results found"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const overdue =
                  r.display_status !== "paid" &&
                  r.status !== "cancelled" &&
                  r.due_date < todayStr;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/invoices/${r.id}`} className="hover:underline">
                        {r.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>{r.client_name}</div>
                      <div className="text-xs text-muted-foreground">{r.client_company}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.issue_date)}</TableCell>
                    <TableCell className={cn(overdue && "text-red-600 font-medium")}>
                      {formatDate(r.due_date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.balance > 0 ? (
                        <span className="font-medium text-amber-600">{formatCurrency(r.balance)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={overdue ? "overdue" : r.display_status} />
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
                          <DropdownMenuItem asChild>
                            <Link href={`/invoices/${r.id}`}>
                              <Eye className="h-4 w-4" />
                              View / Print
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEdit(r)}>
                            <Pencil className="h-4 w-4" />
                            Edit
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

      {/* Edit dialog (controlled) */}
      <InvoiceForm
        clients={clientOpts}
        invoice={editing ?? undefined}
        items={editingItems}
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setEditingItems(undefined);
          }
        }}
        onSaved={refetch}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the invoice and its line items. Any linked payments are kept
              but un-linked. This can’t be undone.
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
