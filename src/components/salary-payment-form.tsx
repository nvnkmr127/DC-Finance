"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, MoneyInput } from "@/components/form-field";
import {
  salaryPaymentSchema,
  createSalaryPayment,
  updateSalaryPayment,
  type SalaryPaymentInput,
  type SalaryPayment,
} from "@/lib/salaries";
import { formatINR } from "@/lib/format";

const today = () => new Date().toISOString().slice(0, 10);

const empty: SalaryPaymentInput = {
  employee_id: "",
  amount: 0,
  payment_date: today(),
  bonus: 0,
  deduction: 0,
  notes: "",
};

export function SalaryPaymentForm({
  employees,
  payment,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  employees: { id: string; name: string }[];
  payment?: SalaryPayment;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SalaryPaymentInput>({
    resolver: zodResolver(salaryPaymentSchema),
    defaultValues: empty,
  });

  const [amount, bonus, deduction] = useWatch({
    control,
    name: ["amount", "bonus", "deduction"],
  });
  const net = (amount || 0) + (bonus || 0) - (deduction || 0);

  useEffect(() => {
    if (!isOpen) return;
    reset(
      payment
        ? {
            employee_id: payment.employee_id,
            amount: payment.amount,
            payment_date: payment.payment_date,
            bonus: payment.bonus,
            deduction: payment.deduction,
            notes: payment.notes ?? "",
          }
        : empty,
    );
  }, [isOpen, payment, reset]);

  const onSubmit = async (values: SalaryPaymentInput) => {
    try {
      if (payment) {
        await updateSalaryPayment(payment.id, values);
        toast.success("Salary payment updated");
      } else {
        await createSalaryPayment(values);
        toast.success("Salary payment recorded");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save payment");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Pay Salary
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{payment ? "Edit Salary Payment" : "Record Salary Payment"}</DialogTitle>
            <DialogDescription>Net = amount + bonus − deduction.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field label="Employee" htmlFor="employee_id" required error={errors.employee_id?.message}>
              <Controller
                control={control}
                name="employee_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="employee_id" aria-invalid={!!errors.employee_id} className="w-full">
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="amount" required error={errors.amount?.message}>
                <MoneyInput id="amount" aria-invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Payment Date" htmlFor="payment_date" required error={errors.payment_date?.message}>
                <Input id="payment_date" type="date" aria-invalid={!!errors.payment_date} {...register("payment_date")} />
              </Field>
              <Field label="Bonus" htmlFor="bonus" error={errors.bonus?.message}>
                <MoneyInput id="bonus" aria-invalid={!!errors.bonus} {...register("bonus", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Deduction" htmlFor="deduction" error={errors.deduction?.message}>
                <MoneyInput id="deduction" aria-invalid={!!errors.deduction} {...register("deduction", { valueAsNumber: true })} placeholder="0" />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Net salary</span>
              <span className="font-semibold tabular-nums">{formatINR(net)}</span>
            </div>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" {...register("notes")} placeholder="Optional notes" rows={2} />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
