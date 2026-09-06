import { getSupabase } from "@/lib/supabase/client";

export type Budget = {
  id: string;
  month: string;
  category: string;
  amount: number;
};

export async function listBudgets(month: string): Promise<Budget[]> {
  const { data, error } = await getSupabase()
    .from("budgets")
    .select("*")
    .eq("month", month);
  if (error) throw new Error(error.message);
  return data as Budget[];
}

// Upsert one month/category budget (unique on month+category). amount 0 clears it.
export async function setBudget(month: string, category: string, amount: number): Promise<void> {
  const { error } = await getSupabase()
    .from("budgets")
    .upsert({ month, category, amount }, { onConflict: "month,category" });
  if (error) throw new Error(error.message);
}
