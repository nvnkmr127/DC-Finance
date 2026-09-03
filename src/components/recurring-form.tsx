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
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import {
  recurringSchema,
  createRecurring,
  updateRecurring,
  FREQUENCIES,
  type RecurringInput,
  type Recurring,
} from "@/lib/recurring";

const today = () => new Date().toISOString().slice(0, 10);

const empty: RecurringInput = {
  name: "",
  category: "Software",
  amount: 0,
  frequency: "Monthly",
  next_payment_date: today(),
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
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;
  const setOpen = controlled ? onOpenChange! : setInternalOpen;

  const {
    register,
    handleSubmit,
    control,
    reset,
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
              amount: recurring.amount,
              frequency: recurring.frequency,
              next_payment_date: recurring.next_payment_date,
              active: recurring.active,
              notes: recurring.notes ?? "",
            }
          : empty,
      );
    }
  }, [isOpen, recurring, reset]);

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
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Amount" htmlFor="amount" required error={errors.amount?.message}>
                <MoneyInput id="amount" aria-invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} placeholder="0" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Frequency" htmlFor="frequency" required error={errors.frequency?.message}>
                <Controller
                  control={control}
                  name="frequency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
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
              <Field label="Next Payment" htmlFor="next_payment_date" required error={errors.next_payment_date?.message}>
                <Input id="next_payment_date" type="date" aria-invalid={!!errors.next_payment_date} {...register("next_payment_date")} />
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
                Active
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
