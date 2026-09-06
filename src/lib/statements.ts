import { getSupabase } from "@/lib/supabase/client";

export async function getOpeningBalance(month: string): Promise<number | null> {
  const { data, error } = await getSupabase()
    .from("opening_balances")
    .select("balance")
    .eq("month", month)
    .maybeSingle();

  // Opening balance is optional. If the table hasn't been created yet, treat it
  // as "no opening balance" so the rest of the statement still renders instead
  // of failing the whole page. Any other error is a real problem.
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return null;
    throw new Error(error.message);
  }
  return data?.balance ?? null;
}

export async function setOpeningBalance(month: string, balance: number): Promise<void> {
  const { error } = await getSupabase()
    .from("opening_balances")
    .upsert({ month, balance });

  if (error) throw new Error(error.message);
}

// Utility to convert an array of objects to CSV and trigger download
export function downloadCSV(filename: string, headers: string[], data: (string | number)[][]) {
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
    ...data.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
