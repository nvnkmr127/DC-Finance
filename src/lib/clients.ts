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
    .regex(/^[0-9+\-\s()]+$/, "Only digits and + - ( ) allowed"),
  email: z.string().email("Enter a valid email"),
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

export type ClientPricingRevision = {
  id: string | number;
  changed_at: string;
  actor: string | null;
  action: "CREATED" | "REVISED";
  old_price: number | null;
  new_price: number;
  old_service?: string | null;
  new_service?: string | null;
  diff: number;
  percentage_change?: number | null;
};

export async function getClientPricingHistory(clientId: string): Promise<ClientPricingRevision[]> {
  const revisions: ClientPricingRevision[] = [];
  const seenIds = new Set<string | number>();

  // 1. Try fetching from Supabase audit_log
  try {
    const { data, error } = await getSupabase()
      .from("audit_log")
      .select("*")
      .eq("table_name", "clients")
      .eq("row_id", clientId)
      .order("changed_at", { ascending: true });

    if (!error && data) {
      for (const entry of data) {
        const oldD = (entry.old_data as Record<string, unknown>) || {};
        const newD = (entry.new_data as Record<string, unknown>) || {};

        if (entry.action === "INSERT") {
          const initialPrice = Number(newD.monthly_value) || 0;
          seenIds.add(entry.id);
          revisions.push({
            id: entry.id,
            changed_at: entry.changed_at,
            actor: entry.actor || "System",
            action: "CREATED",
            old_price: null,
            new_price: initialPrice,
            old_service: null,
            new_service: (newD.service as string) || null,
            diff: 0,
            percentage_change: null,
          });
        } else if (entry.action === "UPDATE") {
          const oldVal = Number(oldD.monthly_value);
          const newVal = Number(newD.monthly_value);
          const oldService = (oldD.service as string) || null;
          const newService = (newD.service as string) || null;

          if (oldVal !== newVal || oldService !== newService) {
            seenIds.add(entry.id);
            const diff = newVal - (isNaN(oldVal) ? 0 : oldVal);
            const percentage = oldVal > 0 ? (diff / oldVal) * 100 : null;
            revisions.push({
              id: entry.id,
              changed_at: entry.changed_at,
              actor: entry.actor || "Admin",
              action: "REVISED",
              old_price: isNaN(oldVal) ? null : oldVal,
              new_price: newVal,
              old_service: oldService,
              new_service: newService,
              diff,
              percentage_change: percentage ? Math.round(percentage * 10) / 10 : null,
            });
          }
        }
      }
    }
  } catch {}

  // 2. Merge local cache revisions (useful fallback before database migrations run)
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(`dc_client_pricing_${clientId}`);
      if (raw) {
        const localList: ClientPricingRevision[] = JSON.parse(raw);
        for (const localRev of localList) {
          if (!seenIds.has(localRev.id)) {
            revisions.push(localRev);
          }
        }
      }
    } catch {}
  }

  // Sort newest first for display
  return revisions.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
}

export async function createClient(input: ClientInput): Promise<void> {
  const { data, error } = await getSupabase().from("clients").insert(input).select().single();
  if (error) throw new Error(error.message);

  if (typeof window !== "undefined" && data) {
    try {
      const initialRev: ClientPricingRevision = {
        id: `init-${Date.now()}`,
        changed_at: new Date().toISOString(),
        actor: "Admin",
        action: "CREATED",
        old_price: null,
        new_price: input.monthly_value,
        old_service: null,
        new_service: input.service,
        diff: 0,
        percentage_change: null,
      };
      localStorage.setItem(`dc_client_pricing_${data.id}`, JSON.stringify([initialRev]));
    } catch {}
  }
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  // Fetch old data to compare price revision
  let oldClient: ClientSummary | null = null;
  try {
    oldClient = await getClientSummary(id);
  } catch {}

  const { error } = await getSupabase().from("clients").update(input).eq("id", id);
  if (error) throw new Error(error.message);

  // If price or service changed, log to local cache
  if (typeof window !== "undefined" && oldClient) {
    if (oldClient.monthly_value !== input.monthly_value || oldClient.service !== input.service) {
      try {
        const key = `dc_client_pricing_${id}`;
        const raw = localStorage.getItem(key);
        const existing: ClientPricingRevision[] = raw ? JSON.parse(raw) : [];

        const diff = input.monthly_value - oldClient.monthly_value;
        const percentage = oldClient.monthly_value > 0 ? (diff / oldClient.monthly_value) * 100 : null;

        const newRevision: ClientPricingRevision = {
          id: `rev-${Date.now()}`,
          changed_at: new Date().toISOString(),
          actor: "Admin",
          action: "REVISED",
          old_price: oldClient.monthly_value,
          new_price: input.monthly_value,
          old_service: oldClient.service,
          new_service: input.service,
          diff,
          percentage_change: percentage ? Math.round(percentage * 10) / 10 : null,
        };

        localStorage.setItem(key, JSON.stringify([...existing, newRevision]));
      } catch {}
    }
  }
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await getSupabase().from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
