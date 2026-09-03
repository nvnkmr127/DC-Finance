import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

// ---- Validation ----------------------------------------------------------

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  company: z.string().min(1, "Company is required").max(120),
  phone: z
    .string()
    .min(7, "Enter a valid phone number")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Only digits and + - ( ) allowed")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  service: z.string().min(1, "Service is required").max(120),
  monthly_value: z
    .number({ error: "Enter a number" })
    .min(0, "Must be 0 or more"),
  status: z.enum(["active", "inactive"]),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type ClientInput = z.infer<typeof clientSchema>;

// ---- Types ---------------------------------------------------------------

export type Client = ClientInput & { id: string; created_at: string };

// Row from the `client_summary` view (client fields + payment-derived totals).
export type ClientSummary = Client & {
  total_received: number;
  outstanding: number;
  payment_count: number;
};

export type Payment = {
  id: string;
  client_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

// ---- Data access ---------------------------------------------------------

export async function listClients(): Promise<ClientSummary[]> {
  const { data, error } = await getSupabase()
    .from("client_summary")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ClientSummary[];
}

export async function getClientSummary(id: string): Promise<ClientSummary> {
  const { data, error } = await getSupabase()
    .from("client_summary")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as ClientSummary;
}

export async function getClientPayments(clientId: string): Promise<Payment[]> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select("*")
    .eq("client_id", clientId)
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Payment[];
}

export async function createClient(input: ClientInput): Promise<void> {
  const { error } = await getSupabase().from("clients").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  const { error } = await getSupabase().from("clients").update(input).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await getSupabase().from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
