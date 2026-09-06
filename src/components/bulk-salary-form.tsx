"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import { createSalaryPaymentsBulk, netSalary, type SalaryPaymentInput } from "@/lib/salaries";
import { useSettings } from "@/components/settings-provider";

const today = () => new Date().toISOString().slice(0, 10);

type Row = {
  employee_id: string;
  name: string;
  include: boolean;
  amount: number;
  bonus: number;
  deduction: number;
};

export function BulkSalaryForm({
  employees,
  onSaved,
  showTrigger = false,
}: {
  employees: { id: string; name: string; salary?: number }[];
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const { formatCurrency } = useSettings();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);

  // Seed one row per employee, salary pre-filled, when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPaymentDate(today());
    setRows(
      employees.map((e) => ({
        employee_id: e.id,
        name: e.name,
        include: true,
        amount: e.salary ?? 0,
        bonus: 0,
        deduction: 0,
      })),
    );
  }, [open, employees]);

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.employee_id === id ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.include);
  const totalNet = useMemo(
    () => selected.reduce((s, r) => s + netSalary(r), 0),
    [selected],
  );
  const invalid = selected.filter((r) => r.amount <= 0);
  const canReview = selected.length > 0 && invalid.length === 0;

  async function confirmPay() {
    setSaving(true);
    try {
      const inputs: SalaryPaymentInput[] = selected.map((r) => ({
        employee_id: r.employee_id,
        amount: r.amount,
        bonus: r.bonus,
        deduction: r.deduction,
        payment_date: paymentDate,
        notes: "",
        receipt_path: "",
      }));
      await createSalaryPaymentsBulk(inputs);
      toast.success(`Recorded ${inputs.length} salary payment${inputs.length > 1 ? "s" : ""}`);
      setConfirming(false);
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record salaries");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button variant="outline">
              <Users className="h-4 w-4" />
              Bulk Pay
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Salary Payment</DialogTitle>
            <DialogDescription>
              Salaries are pre-filled from each employee. Adjust, untick anyone to skip, then review.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-3">
              <Label htmlFor="bulk_date" className="text-sm">Payment Date</Label>
              <Input
                id="bulk_date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-44"
              />
            </div>

            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active employees.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-8 p-2" />
                      <th className="p-2 text-left font-medium">Employee</th>
                      <th className="p-2 text-right font-medium">Amount</th>
                      <th className="p-2 text-right font-medium">Bonus</th>
                      <th className="p-2 text-right font-medium">Deduction</th>
                      <th className="p-2 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.employee_id} className={r.include ? "" : "opacity-50"}>
                        <td className="p-2 text-center">
                          <Checkbox
                            checked={r.include}
                            onCheckedChange={(v) => setRow(r.employee_id, { include: v === true })}
                            aria-label={`Include ${r.name}`}
                          />
                        </td>
                        <td className="p-2 font-medium">{r.name}</td>
                        {(["amount", "bonus", "deduction"] as const).map((f) => (
                          <td key={f} className="p-1">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              disabled={!r.include}
                              value={Number.isNaN(r[f]) ? "" : r[f]}
                              onChange={(e) =>
                                setRow(r.employee_id, { [f]: parseFloat(e.target.value) || 0 })
                              }
                              className="h-8 w-24 text-right tabular-nums"
                              aria-invalid={f === "amount" && r.include && r.amount <= 0}
                            />
                          </td>
                        ))}
                        <td className="p-2 text-right font-semibold tabular-nums">
                          {formatCurrency(netSalary(r))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {selected.length} employee{selected.length === 1 ? "" : "s"} · total net
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalNet)}</span>
            </div>
            {invalid.length > 0 && (
              <p className="text-xs font-medium text-destructive">
                {invalid.length} selected {invalid.length === 1 ? "row has" : "rows have"} an amount of 0 — set an amount or untick.
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="button" disabled={!canReview} onClick={() => setConfirming(true)}>
              Review &amp; Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation popup — the changes about to be applied */}
      <AlertDialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {selected.length} salary payment{selected.length === 1 ? "" : "s"}</AlertDialogTitle>
            <AlertDialogDescription>
              Dated {paymentDate}. This records the following and can’t be undone in bulk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto rounded-md border text-sm">
            <table className="w-full">
              <tbody>
                {selected.map((r) => (
                  <tr key={r.employee_id} className="border-b last:border-0">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-right text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(r.amount)}
                      {r.bonus ? ` +${formatCurrency(r.bonus)}` : ""}
                      {r.deduction ? ` −${formatCurrency(r.deduction)}` : ""}
                    </td>
                    <td className="p-2 text-right font-medium tabular-nums">{formatCurrency(netSalary(r))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td className="p-2">Total</td>
                  <td />
                  <td className="p-2 text-right tabular-nums">{formatCurrency(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // keep dialog open until the insert resolves
                confirmPay();
              }}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm &amp; Pay {formatCurrency(totalNet)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
