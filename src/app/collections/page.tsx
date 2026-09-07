"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, Copy, BellRing, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { listInvoices, logReminder, type InvoiceSummary } from "@/lib/invoices";
import { listClients } from "@/lib/clients";
import { sendReminderEmail } from "@/lib/reminders";
import { formatDate } from "@/lib/format";
import { useSettings } from "@/components/settings-provider";
import { cn } from "@/lib/utils";

const daysBetween = (isoDate: string) => {
  const due = new Date(isoDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / 86_400_000);
};

export default function CollectionsPage() {
  const [rows, setRows] = useState<InvoiceSummary[]>([]);
  const [emailByClient, setEmailByClient] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { formatCurrency, settings } = useSettings();
  const company = settings?.company_name || "our company";
  const emailEnabled = !!settings?.email_reminders_enabled;
  const fromEmail = settings?.reminder_from_email ?? "";

  async function refetch() {
    setLoading(true);
    setError(null);
    try {
      const [inv, clients] = await Promise.all([listInvoices(), listClients()]);
      setRows(inv);
      setEmailByClient(Object.fromEntries(clients.map((c) => [c.id, c.email ?? ""])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refetch();
  }, []);

  // Unpaid, non-cancelled invoices with a balance, most overdue first.
  const open = useMemo(
    () =>
      rows
        .filter((r) => r.balance > 0 && r.status !== "cancelled")
        .map((r) => ({ ...r, overdueDays: daysBetween(r.due_date) }))
        .sort((a, b) => b.overdueDays - a.overdueDays),
    [rows],
  );

  const buckets = useMemo(() => {
    const b = { notDue: 0, d1: 0, d31: 0, d61: 0 };
    for (const r of open) {
      if (r.overdueDays <= 0) b.notDue += r.balance;
      else if (r.overdueDays <= 30) b.d1 += r.balance;
      else if (r.overdueDays <= 60) b.d31 += r.balance;
      else b.d61 += r.balance;
    }
    return b;
  }, [open]);

  const totalOutstanding = buckets.notDue + buckets.d1 + buckets.d31 + buckets.d61;

  function reminderMessage(r: InvoiceSummary & { overdueDays: number }) {
    const overdue = r.overdueDays > 0 ? ` (overdue by ${r.overdueDays} days)` : "";
    return (
      `Hi ${r.client_name},\n\n` +
      `This is a friendly reminder that invoice ${r.invoice_number} for ` +
      `${formatCurrency(r.balance)} was due on ${formatDate(r.due_date)}${overdue}. ` +
      `Please arrange the payment at your earliest convenience.\n\n` +
      `Thank you,\n${company}`
    );
  }

  async function copyMessage(r: InvoiceSummary & { overdueDays: number }) {
    try {
      await navigator.clipboard.writeText(reminderMessage(r));
      toast.success("Reminder message copied");
    } catch {
      toast.error("Couldn’t copy to clipboard");
    }
  }

  async function markReminded(id: string) {
    try {
      await logReminder(id);
      toast.success("Reminder logged");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log reminder");
    }
  }

  async function sendEmail(r: InvoiceSummary & { overdueDays: number }) {
    const to = emailByClient[r.client_id];
    if (!to) return toast.error("This client has no email address");
    if (!fromEmail) return toast.error("Set a From email in Settings first");
    setSendingId(r.id);
    try {
      await sendReminderEmail({
        to,
        from: fromEmail,
        subject: `Payment reminder — ${r.invoice_number}`,
        text: reminderMessage(r),
      });
      await logReminder(r.id);
      toast.success(`Reminder emailed to ${to}`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send email");
    } finally {
      setSendingId(null);
    }
  }

  // Overdue invoices whose client has an email — the batch-reminder targets.
  const overdueEmailable = useMemo(
    () => open.filter((r) => r.overdueDays > 0 && emailByClient[r.client_id]),
    [open, emailByClient],
  );

  async function sendAllOverdue() {
    setBulkSending(true);
    let sent = 0, failed = 0;
    for (const r of overdueEmailable) {
      try {
        await sendReminderEmail({
          to: emailByClient[r.client_id],
          from: fromEmail,
          subject: `Payment reminder — ${r.invoice_number}`,
          text: reminderMessage(r),
        });
        await logReminder(r.id);
        sent++;
      } catch {
        failed++;
      }
    }
    setBulkSending(false);
    setBulkOpen(false);
    toast[failed ? "warning" : "success"](
      `Sent ${sent} reminder${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`,
    );
    refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collections"
        description={loading ? "Loading…" : `${open.length} open invoices · ${formatCurrency(totalOutstanding)} outstanding`}
        action={
          emailEnabled ? (
            <Button
              onClick={() => setBulkOpen(true)}
              disabled={!fromEmail || overdueEmailable.length === 0}
              title={!fromEmail ? "Set a From email in Settings first" : undefined}
            >
              <Mail className="h-4 w-4" />
              Email all overdue ({overdueEmailable.length})
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Not yet due" value={formatCurrency(buckets.notDue)} />
        <MetricCard label="1–30 days" value={formatCurrency(buckets.d1)} tone="warning" />
        <MetricCard label="31–60 days" value={formatCurrency(buckets.d31)} tone="warning" />
        <MetricCard label="60+ days" value={formatCurrency(buckets.d61)} tone="negative" />
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Couldn’t load collections</p>
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
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Last reminded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : open.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                  Nothing outstanding — all invoices are paid. 🎉
                </TableCell>
              </TableRow>
            ) : (
              open.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.invoice_number}</TableCell>
                  <TableCell>
                    <div>{r.client_name}</div>
                    <div className="text-xs text-muted-foreground">{r.client_company}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.due_date)}</TableCell>
                  <TableCell className="text-right">
                    {r.overdueDays > 0 ? (
                      <span className={cn("font-medium", r.overdueDays > 60 ? "text-red-600" : "text-amber-600")}>
                        {r.overdueDays}d
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(r.balance)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.last_reminded_at ? formatDate(r.last_reminded_at) : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {emailEnabled && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendingId === r.id || !emailByClient[r.client_id]}
                          onClick={() => sendEmail(r)}
                          title={
                            emailByClient[r.client_id]
                              ? `Email reminder to ${emailByClient[r.client_id]}`
                              : "Client has no email address"
                          }
                        >
                          {sendingId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                          Email
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => copyMessage(r)} title="Copy reminder message">
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => markReminded(r.id)} title="Log that a reminder was sent">
                        {r.last_reminded_at ? <CheckCircle2 className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                        Log
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {emailEnabled
          ? "Email sends directly via Resend to the client’s email. You can also copy the message to send manually."
          : "Copy a reminder message to send via email or WhatsApp, then log it here. Turn on email reminders in Settings to send directly via Resend."}
      </p>

      <AlertDialog open={bulkOpen} onOpenChange={(o) => !o && !bulkSending && setBulkOpen(false)}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Email {overdueEmailable.length} overdue reminder{overdueEmailable.length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends a payment reminder from {fromEmail || "your From email"} to each overdue client below.
              Real emails go out immediately and can’t be recalled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-56 overflow-y-auto rounded-md border text-sm">
            <table className="w-full">
              <tbody>
                {overdueEmailable.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="font-medium">{r.client_name}</div>
                      <div className="text-xs text-muted-foreground">{emailByClient[r.client_id]} · {r.invoice_number} · {r.overdueDays}d overdue</div>
                    </td>
                    <td className="p-2 text-right tabular-nums font-medium">{formatCurrency(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); sendAllOverdue(); }}
              disabled={bulkSending}
            >
              {bulkSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send {overdueEmailable.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
