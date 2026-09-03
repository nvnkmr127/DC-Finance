import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import { PAYMENT_METHODS } from "@/lib/payments";

export const EXPENSE_CATEGORIES = [
  "Office",
  "Software",
  "Advertising",
  "Equipment",
  "Travel",
  "Internet",
  "Electricity",
  "Freelancers",
  "Salary",
  "Other",
] as const;

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1, "Description is required").max(200),
  vendor: z.string().max(200).optional().or(z.literal("")),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  expense_date: z.string().min(1, "Select an expense date"),
  payment_method: z.enum(PAYMENT_METHODS),
  recurring: z.boolean(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export type Expense = ExpenseInput & { id: string; created_at: string; updated_at?: string };

export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await getSupabase()
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Expense[];
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const { error } = await getSupabase().from("expenses").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { error } = await getSupabase().from("expenses").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await getSupabase().from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
