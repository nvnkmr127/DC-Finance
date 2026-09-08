import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";
import { dispatchWebhookEvent } from "@/lib/webhooks";

export const paymentSchema = z.object({
  client_id: z.string().min(1, "Select a client"),
  invoice_id: z.string().optional().or(z.literal("")),
  project_id: z.string().optional().or(z.literal("")),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  billing_month: z.string().min(1, "Select the billing month"), // period the payment is for, "YYYY-MM"
  payment_date: z.string().min(1, "Select a payment date"),      // when it was received
  payment_method: z.string().min(1, "Select a payment method"),
  reference_number: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// Payment row with the linked client embedded (via the client_id FK).
export type PaymentWithClient = {
  id: string;
  client_id: string;
  invoice_id: string | null;
  project_id: string | null;
  amount: number;
  billing_month: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  clients: { name: string; company: string } | null;
};

// invoice_id / project_id are uuid columns, so an empty selection must become
// NULL, not "".
function normalize(input: PaymentInput) {
  return {
    ...input,
    invoice_id: input.invoice_id || null,
    project_id: input.project_id || null,
  };
}

export async function listPayments(): Promise<PaymentWithClient[]> {
  const { data, error } = await getSupabase()
    .from("payments")
    .select("*, clients(name, company)")
    .order("payment_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data as unknown as PaymentWithClient[];
}

export async function createPayment(input: PaymentInput): Promise<void> {
  const payload = normalize(input);
  const { data, error } = await getSupabase().from("payments").insert(payload).select().single();
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("payment.created", (data as Record<string, unknown>) ?? payload);

  if (payload.invoice_id) {
    try {
      const { data: inv } = await getSupabase()
        .from("invoice_summary")
        .select("id, balance, display_status")
        .eq("id", payload.invoice_id)
        .single();
      if (inv && inv.display_status === "paid") {
        dispatchWebhookEvent("invoice.paid", { invoice_id: inv.id, payment_id: data?.id });
      }
    } catch {
      // Non-critical background lookup
    }
  }
}

// Insert several payment rows at once (e.g. a quarterly lump split into 3 months).
export async function createPayments(inputs: PaymentInput[]): Promise<void> {
  if (!inputs.length) return;
  const payloads = inputs.map(normalize);
  const { data, error } = await getSupabase().from("payments").insert(payloads).select();
  if (error) throw new Error(error.message);
  for (const item of (data as Record<string, unknown>[]) ?? payloads) {
    dispatchWebhookEvent("payment.created", item);
  }
}

// "2025-07" + 2 → "2025-09"
export function addMonths(ym: string, n: number): string {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Split a quarterly lump into 3 monthly rows (billing months m, m+1, m+2),
// with cents balanced so the three amounts sum exactly to the total.
export function splitQuarterly(input: PaymentInput): PaymentInput[] {
  const per = Math.round((input.amount / 3) * 100) / 100;
  const amounts = [per, per, Math.round((input.amount - per * 2) * 100) / 100];
  return amounts.map((amount, i) => ({
    ...input,
    amount,
    billing_month: addMonths(input.billing_month, i),
  }));
}

export async function updatePayment(id: string, input: PaymentInput): Promise<void> {
  const payload = normalize(input);
  const { data, error } = await getSupabase().from("payments").update(payload).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("payment.updated", (data as Record<string, unknown>) ?? { id, ...payload });
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await getSupabase().from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  dispatchWebhookEvent("payment.deleted", { id });
}
