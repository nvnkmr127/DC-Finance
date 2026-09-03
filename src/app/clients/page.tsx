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
  ChevronLeft,
  ChevronRight,
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
import { StatusBadge } from "@/components/status-badge";
import { ClientForm } from "@/components/client-form";
import {
  listClients,
  deleteClient,
  type Client,
  type ClientSummary,
} from "@/lib/clients";
import { formatINR } from "@/lib/format";

const PAGE_SIZE = 10;

const SORTS: Record<string, (a: ClientSummary, b: ClientSummary) => number> = {
  recent: () => 0, // keep source order (created_at desc from the query)
  name: (a, b) => a.name.localeCompare(b.name),
  monthly: (a, b) => b.monthly_value - a.monthly_value,
  received: (a, b) => b.total_received - a.total_received,
  outstanding: (a, b) => b.outstanding - a.outstanding,
};

export default function ClientsPage() {
  const [rows, setRows] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<ClientSummary | null>(null);

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listClients());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [query, status, sort]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((c) => {
      const matchesQuery =
        !q ||
        [c.name, c.company, c.service, c.email].some((v) =>
          v.toLowerCase().includes(q),
        );
      const matchesStatus = status === "all" || c.status === status;
      return matchesQuery && matchesStatus;
    });
    return sort === "recent" ? list : [...list].sort(SORTS[sort]);
  }, [rows, query, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const blockedByPayments = (deleting?.payment_count ?? 0) > 0;

  async function confirmDelete() {
    if (!deleting || blockedByPayments) return;
    try {
      await deleteClient(deleting.id);
      toast.success("Client deleted");
      setDeleting(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete client");
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={loading ? "Loading…" : `${rows.length} clients`}
        action={<ClientForm showTrigger onSaved={refetch} />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Sort: Newest</SelectItem>
            <SelectItem value="name">Sort: Name (A–Z)</SelectItem>
            <SelectItem value="monthly">Sort: Monthly value</SelectItem>
            <SelectItem value="received">Sort: Total received</SelectItem>
            <SelectItem value="outstanding">Sort: Outstanding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load clients</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Monthly Value</TableHead>
              <TableHead className="text-right">Total Received</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
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
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "No clients yet" : "No results found"}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell>{c.company}</TableCell>
                  <TableCell>{c.service}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(c.monthly_value)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">
                    {formatINR(c.total_received)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.outstanding > 0 ? (
                      <span className="font-medium text-amber-600">
                        {formatINR(c.outstanding)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
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
                          <Link href={`/clients/${c.id}`}>
                            <Eye className="h-4 w-4" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleting(c)}
                        >
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

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages} · {filtered.length} clients
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog (controlled) */}
      <ClientForm
        client={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={refetch}
      />

      {/* Delete — blocked when the client has payment records */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockedByPayments ? `Can’t delete ${deleting?.name}` : `Delete ${deleting?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockedByPayments
                ? `This client has ${deleting?.payment_count} payment record${deleting?.payment_count === 1 ? "" : "s"}. Delete or reassign those payments first to protect your financial history.`
                : "This permanently removes the client. This can’t be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{blockedByPayments ? "Close" : "Cancel"}</AlertDialogCancel>
            {!blockedByPayments && (
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
