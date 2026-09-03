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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, MoneyInput } from "@/components/form-field";
import {
  recurringSchema,
  createRecurring,
  updateRecurring,
  calculateNextDate,
  FREQUENCIES,
  type RecurringInput,
  type Recurring,
} from "@/lib/recurring";
import { useSettings } from "@/components/settings-provider";

const today = () => new Date().toISOString().slice(0, 10);

const empty: RecurringInput = {
  name: "",
  category: "Software",
  vendor: "",
  amount: 0,
  frequency: "Monthly",
  next_payment_date: today(),
  payment_method: "Bank Transfer",
  active: true,
  notes: "",
};

export function RecurringForm({
  recurring,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  recurring?: Recurring;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { settings } = useSettings();
  const expenseCategories = settings?.expense_categories || [];
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
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema),
    defaultValues: empty,
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        recurring
          ? {
              name: recurring.name,
              category: recurring.category,
              vendor: recurring.vendor ?? "",
              amount: recurring.amount,
              frequency: recurring.frequency,
              next_payment_date: recurring.next_payment_date,
              payment_method: recurring.payment_method || "Bank Transfer",
              active: recurring.active,
              notes: recurring.notes ?? "",
            }
          : empty,
      );
    }
  }, [isOpen, recurring, reset]);

  const onAdvanceDate = () => {
    const current = getValues("next_payment_date") || today();
    const freq = getValues("frequency") || "Monthly";
    setValue("next_payment_date", calculateNextDate(current, freq), {
      shouldValidate: true,
    });
  };

  const onSubmit = async (values: RecurringInput) => {
    try {
      if (recurring) {
        await updateRecurring(recurring.id, values);
        toast.success("Recurring expense updated");
      } else {
        await createRecurring(values);
        toast.success("Recurring expense created");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Add Recurring
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {recurring ? "Edit Recurring Expense" : "Add Recurring Expense"}
            </DialogTitle>
            <DialogDescription>
              A template only — no transactions are created from it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field label="Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" aria-invalid={!!errors.name} {...register("name")} placeholder="e.g. AWS Cloud Hosting" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category" required error={errors.category?.message}>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="category" aria-invalid={!!errors.category} className="w-full">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                      {expenseCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Vendor" htmlFor="vendor" error={errors.vendor?.message}>
                <Input id="vendor" aria-invalid={!!errors.vendor} {...register("vendor")} placeholder="e.g. Amazon, Google" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="amount" required error={errors.amount?.message}>
                <MoneyInput id="amount" aria-invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} placeholder="0" />
              </Field>

              <Field label="Frequency" htmlFor="frequency" required error={errors.frequency?.message}>
                <Controller
                  control={control}
                  name="frequency"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        // Automatically recalculate next payment date on frequency change for new template
                        if (!recurring) {
                          const base = getValues("next_payment_date") || today();
                          setValue("next_payment_date", calculateNextDate(base, val as (typeof FREQUENCIES)[number]));
                        }
                      }}
                    >
                      <SelectTrigger id="frequency" aria-invalid={!!errors.frequency} className="w-full">
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label htmlFor="next_payment_date" className="text-xs font-medium">
                    Next Payment <span className="text-destructive">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={onAdvanceDate}
                    className="text-[11px] font-medium text-primary hover:underline"
                    title="Calculate next payment date based on current frequency"
                  >
                    +1 cycle
                  </button>
                </div>
                <Input
                  id="next_payment_date"
                  type="date"
                  aria-invalid={!!errors.next_payment_date}
                  {...register("next_payment_date")}
                />
                {errors.next_payment_date?.message && (
                  <p className="mt-1 text-xs text-destructive">{errors.next_payment_date.message}</p>
                )}
              </div>

              <Field label="Payment Method" htmlFor="payment_method" required error={errors.payment_method?.message}>
                <Controller
                  control={control}
                  name="payment_method"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="payment_method" aria-invalid={!!errors.payment_method} className="w-full">
                        <SelectValue placeholder="Method" />
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
            </div>

            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Checkbox
                    id="active"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="active" className="font-normal">
                Active recurring expense
              </Label>
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
