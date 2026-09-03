import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";

export const FREQUENCIES = ["Monthly", "Quarterly", "Yearly"] as const;

export const recurringSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  frequency: z.enum(FREQUENCIES),
  next_payment_date: z.string().min(1, "Select the next payment date"),
  active: z.boolean(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type RecurringInput = z.infer<typeof recurringSchema>;

export type Recurring = RecurringInput & { id: string; created_at: string };

export async function listRecurring(): Promise<Recurring[]> {
  const { data, error } = await getSupabase()
    .from("recurring")
    .select("*")
    .order("next_payment_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Recurring[];
}

export async function createRecurring(input: RecurringInput): Promise<void> {
  const { error } = await getSupabase().from("recurring").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateRecurring(id: string, input: RecurringInput): Promise<void> {
  const { error } = await getSupabase().from("recurring").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await getSupabase().from("recurring").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setRecurringActive(id: string, active: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from("recurring")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Whole days from today until an ISO date (negative = overdue).
export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
