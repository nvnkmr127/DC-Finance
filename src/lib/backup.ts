import { getSupabase } from "@/lib/supabase/client";

const TABLES = [
  "clients",
  "employees",
  "invoices",
  "invoice_items",
  "payments",
  "expenses",
  "recurring",
  "salary_payments",
  "opening_balances",
  "budgets",
  "settings",
] as const;

// Fetch every table and download one JSON backup file.
export async function exportAllData(): Promise<void> {
  const supabase = getSupabase();
  const tables: Record<string, unknown[]> = {};

  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`${t}: ${error.message}`);
    tables[t] = data ?? [];
  }

  const payload = { exported_at: new Date().toISOString(), tables };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dcfinance-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
