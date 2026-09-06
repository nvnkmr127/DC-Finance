"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
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
import { Field } from "@/components/form-field";
import { useSettings } from "@/components/settings-provider";
import {
  invoiceSchema,
  createInvoice,
  updateInvoice,
  invoiceTotal,
  lineAmount,
  type InvoiceInput,
  type InvoiceItemInput,
  type InvoiceSummary,
} from "@/lib/invoices";

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const emptyItem = (): InvoiceItemInput => ({ description: "", quantity: 1, unit_price: 0 });

const emptyValues = (): InvoiceInput => ({
  client_id: "",
  issue_date: today(),
  due_date: inDays(30),
  status: "draft",
  notes: "",
  items: [emptyItem()],
});

export function InvoiceForm({
  clients,
  invoice,
  items,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  clients: { id: string; name: string; company: string }[];
  invoice?: InvoiceSummary;
  items?: InvoiceItemInput[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;
  const { formatCurrency } = useSettings();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: emptyValues(),
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      invoice
        ? {
            client_id: invoice.client_id,
            issue_date: invoice.issue_date,
            due_date: invoice.due_date,
            status: invoice.status,
            notes: invoice.notes ?? "",
            items: items?.length ? items : [emptyItem()],
          }
        : emptyValues(),
    );
  }, [isOpen, invoice, items, reset]);

  // Live total preview.
  const watchedItems = useWatch({ control, name: "items" });
  const total = invoiceTotal(
    (watchedItems ?? []).map((i) => ({
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
    })),
  );

  const onSubmit = async (values: InvoiceInput) => {
    try {
      if (invoice) {
        await updateInvoice(invoice.id, values);
        toast.success("Invoice updated");
      } else {
        await createInvoice(values);
        toast.success("Invoice created");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save invoice");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{invoice ? `Edit ${invoice.invoice_number}` : "New Invoice"}</DialogTitle>
            <DialogDescription>
              {invoice ? "Update this invoice." : "Create an invoice for a client."}
            </DialogDescription>
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

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Issue Date" htmlFor="issue_date" required error={errors.issue_date?.message}>
                <Input id="issue_date" type="date" {...register("issue_date")} />
              </Field>
              <Field label="Due Date" htmlFor="due_date" required error={errors.due_date?.message}>
                <Input id="due_date" type="date" {...register("due_date")} />
              </Field>
              <Field label="Status" htmlFor="status" required error={errors.status?.message}>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Line Items</span>
                <Button type="button" variant="outline" size="sm" onClick={() => append(emptyItem())}>
                  <Plus className="h-4 w-4" />
                  Add line
                </Button>
              </div>
              {typeof errors.items?.message === "string" && (
                <p className="text-xs font-medium text-destructive">{errors.items.message}</p>
              )}
              <div className="space-y-2">
                {fields.map((f, i) => {
                  const q = Number(watchedItems?.[i]?.quantity) || 0;
                  const up = Number(watchedItems?.[i]?.unit_price) || 0;
                  return (
                    <div key={f.id} className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Description"
                          aria-invalid={!!errors.items?.[i]?.description}
                          {...register(`items.${i}.description`)}
                        />
                        {errors.items?.[i]?.description && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.items[i]?.description?.message}
                          </p>
                        )}
                      </div>
                      <Input
                        type="number"
                        step="any"
                        className="w-20"
                        placeholder="Qty"
                        aria-invalid={!!errors.items?.[i]?.quantity}
                        {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                      />
                      <Input
                        type="number"
                        step="any"
                        className="w-28"
                        placeholder="Unit price"
                        aria-invalid={!!errors.items?.[i]?.unit_price}
                        {...register(`items.${i}.unit_price`, { valueAsNumber: true })}
                      />
                      <div className="w-28 pt-2 text-right text-sm tabular-nums text-muted-foreground">
                        {formatCurrency(lineAmount({ quantity: q, unit_price: up }))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 shrink-0"
                        aria-label="Remove line"
                        disabled={fields.length === 1}
                        onClick={() => remove(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end border-t pt-2 text-sm font-semibold">
                Total: <span className="ml-2 tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" {...register("notes")} placeholder="Optional notes / terms" rows={2} />
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
