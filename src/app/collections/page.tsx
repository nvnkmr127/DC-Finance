"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, Copy, BellRing, CheckCircle2, Mail, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const [phoneByClient, setPhoneByClient] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [waState, setWaState] = useState<{
    open: boolean;
    row: (InvoiceSummary & { overdueDays: number }) | null;
    phone: string;
    message: string;
    tone: "gentle" | "professional" | "firm";
    loading: boolean;
  }>({
    open: false,
    row: null,
    phone: "",
    message: "",
    tone: "gentle",
    loading: false,
  });

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
      setPhoneByClient(Object.fromEntries(clients.map((c) => [c.id, c.phone ?? ""])));
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

  async function openWhatsAppDraft(r: InvoiceSummary & { overdueDays: number }, forcedTone?: "gentle" | "professional" | "firm") {
    const tone = forcedTone || (r.overdueDays > 30 ? "firm" : r.overdueDays > 7 ? "professional" : "gentle");
    const phone = phoneByClient[r.client_id] || "";
    const fallback = reminderMessage(r);

    setWaState({
      open: true,
      row: r,
      phone,
      message: fallback,
      tone,
      loading: true,
    });

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft_reminder",
          draftDetails: {
            clientName: r.client_name,
            companyName: company,
            invoiceNumber: r.invoice_number,
            amount: formatCurrency(r.balance),
            dueDate: formatDate(r.due_date),
            overdueDays: r.overdueDays,
            tone,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setWaState((prev) => ({ ...prev, message: data.text, loading: false }));
          return;
        }
      }
    } catch {
      // fallback already set
    }
    setWaState((prev) => ({ ...prev, loading: false }));
  }

  function launchWhatsApp() {
    if (!waState.row) return;
    const cleanPhone = waState.phone.replace(/[^0-9]/g, "");
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const textParam = encodeURIComponent(waState.message);
    const url = waPhone ? `https://wa.me/${waPhone}?text=${textParam}` : `https://wa.me/?text=${textParam}`;
    window.open(url, "_blank");
    markReminded(waState.row.id);
    setWaState((prev) => ({ ...prev, open: false }));
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openWhatsAppDraft(r)}
                        title="Draft & send WhatsApp reminder with AI"
                        className="border-emerald-600/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      >
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </Button>
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
          ? "Send directly via Resend email or 1-click WhatsApp with AI-drafted messages, or copy to send manually."
          : "Draft & send via WhatsApp with AI, or copy reminder messages to send manually. Turn on email reminders in Settings to send via Resend."}
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

      <Dialog open={waState.open} onOpenChange={(o) => setWaState((prev) => ({ ...prev, open: o }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              WhatsApp Payment Reminder
            </DialogTitle>
            <DialogDescription>
              AI-crafted payment nudge ready to review, tweak, and send directly via WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {waState.row && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground">{waState.row.client_name}</span>
                  <span className="text-muted-foreground"> ({waState.row.client_company})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{waState.row.invoice_number}</span>
                  <span className="font-bold text-foreground">{formatCurrency(waState.row.balance)}</span>
                  {waState.row.overdueDays > 0 ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      {waState.row.overdueDays}d overdue
                    </span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Not due yet</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Client WhatsApp / Mobile Number</label>
                <Input
                  value={waState.phone}
                  onChange={(e) => setWaState((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 9876543210 or +91..."
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Message Tone</label>
                  <div className="flex items-center gap-1">
                    {(["gentle", "professional", "firm"] as const).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={waState.tone === t ? "default" : "outline"}
                        className="h-7 capitalize text-xs"
                        disabled={waState.loading}
                        onClick={() => openWhatsAppDraft(waState.row!, t)}
                      >
                        {waState.tone === t && waState.loading ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Textarea
                    value={waState.message}
                    onChange={(e) => setWaState((prev) => ({ ...prev, message: e.target.value }))}
                    rows={5}
                    className="resize-none font-sans text-sm"
                    placeholder="Draft reminder message..."
                  />
                  {waState.loading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-xs">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Sparkles className="h-4 w-4 animate-pulse text-emerald-600" />
                        Drafting message with AI...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(waState.message);
                  toast.success("Message copied to clipboard");
                } catch {
                  toast.error("Couldn't copy message");
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setWaState((prev) => ({ ...prev, open: false }))}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={launchWhatsApp}
              >
                <MessageSquare className="h-4 w-4" />
                Send via WhatsApp
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
