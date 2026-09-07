"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateInvoicesForMonth } from "@/lib/invoices";
import type { ClientSummary } from "@/lib/clients";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export function GenerateInvoicesDialog({
  clients,
  onDone,
}: {
  clients: ClientSummary[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(thisMonth());
  const [dueDays, setDueDays] = useState(7);
  const [busy, setBusy] = useState(false);

  // Preview how many active recurring clients are eligible.
  const eligible = clients.filter(
    (c) => c.status === "active" && c.billing_cycle !== "commission" && c.monthly_value > 0,
  ).length;

  async function run() {
    setBusy(true);
    try {
      const { created, skipped } = await generateInvoicesForMonth(month, clients, dueDays);
      toast.success(
        created > 0
          ? `Created ${created} draft invoice${created > 1 ? "s" : ""}${skipped ? `, skipped ${skipped} already invoiced` : ""}`
          : "Nothing to generate — everyone eligible is already invoiced",
      );
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate invoices");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="h-4 w-4" />
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Invoices</DialogTitle>
          <DialogDescription>
            Creates draft invoices from each active client&apos;s billing cycle. Clients already
            invoiced for the period are skipped, so it&apos;s safe to run more than once.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="gen_month">Billing Month</Label>
            <Input id="gen_month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gen_due">Due in (days)</Label>
            <Input id="gen_due" type="number" min={0} value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value) || 0)} />
          </div>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {eligible} active recurring client{eligible === 1 ? "" : "s"} eligible. Monthly = full month,
            quarterly = full quarter amount (skipped if invoiced in the last 3 months). Commission clients are skipped.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy || !month}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate drafts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
