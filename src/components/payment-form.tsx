"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
  paymentSchema,
  createPayment,
  updatePayment,
  PAYMENT_METHODS,
  type PaymentInput,
  type PaymentWithClient,
} from "@/lib/payments";

const today = () => new Date().toISOString().slice(0, 10);

const emptyValues = (): PaymentInput => ({
  client_id: "",
  amount: 0,
  payment_date: today(),
  payment_method: "Bank Transfer",
  reference_number: "",
  notes: "",
});

export function PaymentForm({
  clients,
  payment,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  clients: { id: string; name: string; company: string }[];
  payment?: PaymentWithClient;
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
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      payment
        ? {
            client_id: payment.client_id,
            amount: payment.amount,
            payment_date: payment.payment_date,
            payment_method: payment.payment_method as PaymentInput["payment_method"],
            reference_number: payment.reference_number ?? "",
            notes: payment.notes ?? "",
          }
        : emptyValues(),
    );
  }, [isOpen, payment, reset]);

  const onSubmit = async (values: PaymentInput) => {
    try {
      if (payment) {
        await updatePayment(payment.id, values);
        toast.success("Payment updated");
      } else {
        await createPayment(values);
        toast.success("Payment recorded");
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
            Record Payment
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{payment ? "Edit Payment" : "Record Payment"}</DialogTitle>
            <DialogDescription>Record a payment received from a client.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field label="Client" htmlFor="client_id" required error={errors.client_id?.message}>
              <Controller
                control={control}
                name="client_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="client_id" aria-invalid={!!errors.client_id} className="w-full">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.company}
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
            </div>

            <Field label="Payment Method" htmlFor="payment_method" required error={errors.payment_method?.message}>
              <Controller
                control={control}
                name="payment_method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="payment_method" aria-invalid={!!errors.payment_method} className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Reference Number" htmlFor="reference_number" error={errors.reference_number?.message}>
              <Input id="reference_number" {...register("reference_number")} placeholder="e.g. UTR / txn ID (optional)" />
            </Field>

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
