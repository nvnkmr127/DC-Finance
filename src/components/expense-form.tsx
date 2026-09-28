"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Sparkles, Loader2 } from "lucide-react";
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
import { ReceiptField } from "@/components/receipt-field";
import {
  expenseSchema,
  createExpense,
  updateExpense,
  type ExpenseInput,
  type Expense,
} from "@/lib/expenses";
import { useSettings } from "@/components/settings-provider";

const today = () => new Date().toISOString().slice(0, 10);

const empty: ExpenseInput = {
  category: "Office",
  description: "",
  vendor: "",
  amount: 0,
  expense_date: today(),
  payment_method: "Bank Transfer",
  recurring: false,
  notes: "",
  receipt_path: "",
};

export function ExpenseForm({
  expense,
  open,
  onOpenChange,
  onSaved,
  showTrigger = false,
}: {
  expense?: Expense;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
  showTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);

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
    formState: { errors, isSubmitting },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: empty,
  });

  async function parseReceipt() {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "parse_receipt",
          receiptText: pasteText,
          categories: expenseCategories,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error || "Could not parse receipt");
      const d = json.data;
      if (d.vendor) setValue("vendor", d.vendor);
      if (d.description) setValue("description", d.description);
      if (d.amount) setValue("amount", Number(d.amount));
      if (d.category) {
        const match = expenseCategories.find((c) => c.toLowerCase() === d.category.toLowerCase());
        if (match) setValue("category", match);
      }
      if (d.expense_date) setValue("expense_date", d.expense_date);
      if (d.payment_method) {
        const matchMethod = paymentMethods.find((m) => m.toLowerCase() === d.payment_method.toLowerCase());
        if (matchMethod) setValue("payment_method", matchMethod);
      }
      toast.success("Details extracted by AI!");
      setPasteBoxOpen(false);
      setPasteText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse receipt");
    } finally {
      setParsing(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      reset(
        expense
          ? {
              category: expense.category,
              description: expense.description,
              vendor: expense.vendor ?? "",
              amount: expense.amount,
              expense_date: expense.expense_date,
              payment_method: expense.payment_method,
              recurring: expense.recurring,
              notes: expense.notes ?? "",
              receipt_path: expense.receipt_path ?? "",
            }
          : empty,
      );
    }
  }, [isOpen, expense, reset]);

  const onSubmit = async (values: ExpenseInput) => {
    try {
      if (expense) {
        await updateExpense(expense.id, values);
        toast.success("Expense updated");
      } else {
        await createExpense(values);
        toast.success("Expense added");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save expense");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
            <DialogDescription>Record a business expense.</DialogDescription>
          </DialogHeader>

          {!expense && (
            <div className="mt-2 rounded-lg border border-dashed border-violet-500/40 bg-violet-50/50 p-2.5 dark:bg-violet-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Bill & Receipt Auto-Fill</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400"
                  onClick={() => setPasteBoxOpen((o) => !o)}
                >
                  {pasteBoxOpen ? "Hide" : "Paste Bill Text"}
                </Button>
              </div>
              {pasteBoxOpen && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    placeholder="Paste receipt email text, SMS confirmation, or bill details here..."
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={3}
                    className="bg-background text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="w-full bg-violet-600 text-xs text-white hover:bg-violet-700"
                    onClick={parseReceipt}
                    disabled={parsing || !pasteText.trim()}
                  >
                    {parsing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                    Extract & Auto-Fill Form
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <Field label="Category" htmlFor="category" required error={errors.category?.message}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category" aria-invalid={!!errors.category} className="w-full">
                      <SelectValue placeholder="Select category" />
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

            <Field label="Description" htmlFor="description" required error={errors.description?.message}>
              <Input id="description" aria-invalid={!!errors.description} {...register("description")} placeholder="e.g. AWS cloud hosting" />
            </Field>

            <Field label="Vendor" htmlFor="vendor" error={errors.vendor?.message}>
              <Input id="vendor" aria-invalid={!!errors.vendor} {...register("vendor")} placeholder="e.g. Amazon Web Services, Adobe" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" htmlFor="amount" required error={errors.amount?.message}>
                <MoneyInput id="amount" aria-invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field label="Expense Date" htmlFor="expense_date" required error={errors.expense_date?.message}>
                <Input id="expense_date" type="date" aria-invalid={!!errors.expense_date} {...register("expense_date")} />
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

            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
              <Controller
                control={control}
                name="recurring"
                render={({ field }) => (
                  <Checkbox
                    id="recurring"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="recurring" className="font-normal">
                This is a recurring expense
              </Label>
            </div>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" {...register("notes")} placeholder="Optional notes" rows={2} />
            </Field>

            <Field label="Receipt" htmlFor="receipt">
              <Controller
                control={control}
                name="receipt_path"
                render={({ field }) => (
                  <ReceiptField value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
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
