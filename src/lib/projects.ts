import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

// ---- Validation ----------------------------------------------------------

export const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(160),
  // Empty = internal SaaS product (no external client).
  client_id: z.string().optional().or(z.literal("")),
  value: z.number({ error: "Enter a value" }).min(0, "Must be 0 or more"),
  status: z.enum(["active", "completed", "on-hold"]),
  start_date: z.string().min(1, "Select a start date"),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectStatus = ProjectInput["status"];

// Row from the `project_summary` view (project + client + payment-derived totals).
export type ProjectSummary = {
  id: string;
  name: string;
  client_id: string | null;
  client_name: string | null;
  client_company: string | null;
  value: number;
  status: ProjectStatus;
  start_date: string;
  notes: string | null;
  received: number;
  balance: number;
  created_at: string;
  updated_at: string;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  "on-hold": "On Hold",
};

// client_id is a uuid column, so an empty selection must become NULL, not "".
function normalize(input: ProjectInput) {
  return { ...input, client_id: input.client_id || null };
}

// ---- Data access ---------------------------------------------------------

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await getSupabase()
    .from("project_summary")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ProjectSummary[];
}

export async function createProject(input: ProjectInput): Promise<void> {
  const { error } = await getSupabase().from("projects").insert(normalize(input));
  if (error) throw new Error(error.message);
}

export async function updateProject(id: string, input: ProjectInput): Promise<void> {
  const { error } = await getSupabase().from("projects").update(normalize(input)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await getSupabase().from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
