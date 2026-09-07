"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
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
  type PaymentInput,
  type PaymentWithClient,
} from "@/lib/payments";
import { useSettings } from "@/components/settings-provider";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const emptyValues = (): PaymentInput => ({
  client_id: "",
  invoice_id: "",
  project_id: "",
  amount: 0,
  billing_month: thisMonth(),
  payment_date: today(),
  payment_method: "Bank Transfer",
  reference_number: "",
  notes: "",
});

export type PaymentInvoiceOption = {
  id: string;
  invoice_number: string;
  client_id: string;
  balance: number;
};

export type PaymentProjectOption = {
  id: string;
  name: string;
  client_id: string | null;
  balance: number;
};

export function PaymentForm({
  clients,
  invoices = [],
  projects = [],
  payment,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  clients: { id: string; name: string; company: string; monthly_value?: number }[];
  invoices?: PaymentInvoiceOption[];
  projects?: PaymentProjectOption[];
  payment?: PaymentWithClient;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { settings } = useSettings();
  const paymentMethods = settings?.payment_methods || [];
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: emptyValues(),
  });

  const selectedClient = useWatch({ control, name: "client_id" });
  // Open invoices for the chosen client (plus the one already linked, if editing).
  const clientInvoices = invoices.filter(
    (inv) =>
      inv.client_id === selectedClient &&
      (inv.balance > 0 || inv.id === payment?.invoice_id),
  );
  // Open projects for the chosen client (plus the one already linked, if editing).
  const clientProjects = projects.filter(
    (p) =>
      p.client_id === selectedClient &&
      (p.balance > 0 || p.id === payment?.project_id),
  );

  useEffect(() => {
    if (!isOpen) return;
    reset(
      payment
        ? {
            client_id: payment.client_id,
            invoice_id: payment.invoice_id ?? "",
            project_id: payment.project_id ?? "",
            amount: payment.amount,
            billing_month: payment.billing_month,
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
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      setValue("invoice_id", ""); // clear invoice when client changes
                      setValue("project_id", ""); // clear project when client changes
                      // Auto-fill amount from the client's monthly value.
                      const c = clients.find((cl) => cl.id === v);
                      if (c?.monthly_value != null) {
                        setValue("amount", c.monthly_value, { shouldValidate: true, shouldDirty: true });
                      }
                    }}
                  >
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

            {clientInvoices.length > 0 && (
              <Field label="Apply to Invoice" htmlFor="invoice_id" error={errors.invoice_id?.message}>
                <Controller
                  control={control}
                  name="invoice_id"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => {
                        field.onChange(v === "none" ? "" : v);
                        // Paying against an invoice → default amount to its balance.
                        const inv = clientInvoices.find((i) => i.id === v);
                        if (inv) {
                          setValue("amount", inv.balance, { shouldValidate: true, shouldDirty: true });
                        }
                      }}
                    >
                      <SelectTrigger id="invoice_id" className="w-full">
                        <SelectValue placeholder="No invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No invoice (ad-hoc)</SelectItem>
                        {clientInvoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.invoice_number} · balance {inv.balance}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            {clientProjects.length > 0 && (
              <Field label="Apply to Project" htmlFor="project_id" error={errors.project_id?.message}>
                <Controller
                  control={control}
                  name="project_id"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => {
                        field.onChange(v === "none" ? "" : v);
                        const pr = clientProjects.find((p) => p.id === v);
                        if (pr) {
                          setValue("amount", pr.balance, { shouldValidate: true, shouldDirty: true });
                        }
                      }}
                    >
                      <SelectTrigger id="project_id" className="w-full">
                        <SelectValue placeholder="No project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {clientProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · balance {p.balance}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="amount" required error={errors.amount?.message}>
                <MoneyInput id="amount" aria-invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Billing Month" htmlFor="billing_month" required error={errors.billing_month?.message}>
                <Input id="billing_month" type="month" aria-invalid={!!errors.billing_month} {...register("billing_month")} />
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
                      {paymentMethods.map((m) => (
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
