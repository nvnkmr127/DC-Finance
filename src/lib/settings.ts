import { getSupabase } from "@/lib/supabase/client";

export type Settings = {
  id: number;
  company_name: string;
  company_logo: string | null;
  global_opening_balance: number;
  default_currency: string;
  financial_year_start: string;
  expense_categories: string[];
  payment_methods: string[];
  updated_at: string;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await getSupabase()
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === 'PGRST205') { // No rows found or table doesn't exist
      return {
        id: 1,
        company_name: "Digicloudify Finance",
        company_logo: null,
        global_opening_balance: 0,
        default_currency: "INR",
        financial_year_start: "04-01",
        expense_categories: ["Office", "Software", "Advertising", "Equipment", "Travel", "Internet", "Electricity", "Freelancers", "Salary", "Other"],
        payment_methods: ["Bank Transfer", "UPI", "Cash", "Card", "Other"],
        updated_at: new Date().toISOString()
      };
    }
    throw error;
  }
  return data;
}

export async function updateSettings(settings: Partial<Settings>) {
  const { data, error } = await getSupabase()
    .from("settings")
    .upsert({ id: 1, ...settings })
    .select()
    .single();

  if (error) throw error;
  return data;
}
