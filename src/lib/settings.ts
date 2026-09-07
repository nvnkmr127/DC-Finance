import { getSupabase } from "@/lib/supabase/client";

export type Settings = {
  id: number;
  company_name: string;
  company_logo: string | null;
  default_currency: string;
  financial_year_start: string;
  expense_categories: string[];
  payment_methods: string[];
  expense_only_emails: string[];
  email_reminders_enabled: boolean;
  reminder_from_email: string | null;
  updated_at: string;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await getSupabase()
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return {
      id: 1,
      company_name: "Digicloudify Finance",
      company_logo: null,
      default_currency: "INR",
      financial_year_start: "04-01",
      expense_categories: ["Office", "Software", "Advertising", "Equipment", "Travel", "Internet", "Electricity", "Freelancers", "Salary", "Other"],
      payment_methods: ["Bank Transfer", "UPI", "Cash", "Card", "Other"],
      expense_only_emails: [],
      email_reminders_enabled: false,
      reminder_from_email: null,
      updated_at: new Date().toISOString()
    };
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
