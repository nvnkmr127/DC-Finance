import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import { dispatchWebhookEvent } from "@/lib/webhooks";

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
  created_by?: string | null;
  created_by_email?: string | null;
};

// receipt_path is nullable text; an empty selection must become NULL, not "".
function normalize(input: ExpenseInput) {
  return { ...input, receipt_path: input.receipt_path || null };
}

// ownerId restricts the list to expenses that user entered (for expense-only
// data-entry logins). Omit it for the full list (admin views).
export async function listExpenses(ownerId?: string): Promise<Expense[]> {
  let q = getSupabase().from("expenses").select("*").order("expense_date", { ascending: false });
  if (ownerId) q = q.eq("created_by", ownerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Expense[];
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const payload = normalize(input);
  const { data, error } = await getSupabase().from("expenses").insert(payload).select().single();
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("expense.created", (data as Record<string, unknown>) ?? payload);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const payload = normalize(input);
  const { data, error } = await getSupabase().from("expenses").update(payload).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("expense.updated", (data as Record<string, unknown>) ?? { id, ...payload });
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await getSupabase().from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("expense.deleted", { id });
}
