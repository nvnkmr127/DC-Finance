import { getSupabase } from "@/lib/supabase/client";

export type AuditEntry = {
  id: number;
  table_name: string;
  row_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
};

// Recent audit entries, newest first (capped — this is an activity view, not an export).
export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await getSupabase()
    .from("audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as AuditEntry[];
}
