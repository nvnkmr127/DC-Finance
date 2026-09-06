import { getSupabase } from "@/lib/supabase/client";

export type Settings = {
  id: number;
  company_name: string;
  company_logo: string | null;
  default_currency: string;
  expense_categories: string[];
  payment_methods: string[];
  email_reminders_enabled: boolean;
  reminder_from_email: string | null;
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
        default_currency: "INR",
        expense_categories: ["Office", "Software", "Advertising", "Equipment", "Travel", "Internet", "Electricity", "Freelancers", "Salary", "Other"],
        payment_methods: ["Bank Transfer", "UPI", "Cash", "Card", "Other"],
        email_reminders_enabled: false,
        reminder_from_email: null,
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
