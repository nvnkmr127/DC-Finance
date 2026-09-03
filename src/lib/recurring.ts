import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES } from "@/lib/expenses";
import { PAYMENT_METHODS } from "@/lib/payments";

export const FREQUENCIES = ["Monthly", "Quarterly", "Yearly"] as const;

export const recurringSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  category: z.enum(EXPENSE_CATEGORIES),
  vendor: z.string().max(200).optional().or(z.literal("")),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  frequency: z.enum(FREQUENCIES),
  next_payment_date: z.string().min(1, "Select the next payment date"),
  payment_method: z.enum(PAYMENT_METHODS),
  active: z.boolean(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type RecurringInput = z.infer<typeof recurringSchema>;

export type Recurring = RecurringInput & { id: string; created_at: string; updated_at?: string };

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

// Automatically calculates the next payment date based on the chosen frequency.
export function calculateNextDate(
  currentDateStr: string,
  frequency: (typeof FREQUENCIES)[number],
): string {
  const base = currentDateStr ? new Date(currentDateStr) : new Date();
  if (isNaN(base.getTime())) return new Date().toISOString().slice(0, 10);

  const [y, m, d] = (currentDateStr || new Date().toISOString().slice(0, 10))
    .split("-")
    .map(Number);
  const monthsToAdd = frequency === "Monthly" ? 1 : frequency === "Quarterly" ? 3 : 12;
  const target = new Date(y, m - 1 + monthsToAdd, d);
  const expectedMonth = (m - 1 + monthsToAdd) % 12;
  if (target.getMonth() !== expectedMonth) {
    target.setDate(0);
  }
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Advances the next payment date for a recurring template without creating an expense.
export async function advanceRecurringDate(
  id: string,
  currentDate: string,
  frequency: (typeof FREQUENCIES)[number],
): Promise<string> {
  const next = calculateNextDate(currentDate, frequency);
  const { error } = await getSupabase()
    .from("recurring")
    .update({ next_payment_date: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return next;
}
