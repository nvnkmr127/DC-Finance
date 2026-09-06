import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

export const expenseSchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required").max(200),
  vendor: z.string().max(200).optional().or(z.literal("")),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  expense_date: z.string().min(1, "Select an expense date"),
  payment_method: z.string().min(1, "Select a payment method"),
  recurring: z.boolean(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  receipt_path: z.string().optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export type Expense = Omit<ExpenseInput, "receipt_path"> & {
  id: string;
  created_at: string;
  updated_at?: string;
  receipt_path: string | null;
};

// receipt_path is nullable text; an empty selection must become NULL, not "".
function normalize(input: ExpenseInput) {
  return { ...input, receipt_path: input.receipt_path || null };
}

export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await getSupabase()
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Expense[];
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const { error } = await getSupabase().from("expenses").insert(normalize(input));
  if (error) throw new Error(error.message);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { error } = await getSupabase().from("expenses").update(normalize(input)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await getSupabase().from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
