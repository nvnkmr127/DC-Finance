import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

export const paymentSchema = z.object({
  client_id: z.string().min(1, "Select a client"),
  invoice_id: z.string().optional().or(z.literal("")),
  amount: z.number({ error: "Enter an amount" }).positive("Must be greater than 0"),
  payment_date: z.string().min(1, "Select a payment date"),
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
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  clients: { name: string; company: string } | null;
};

// invoice_id is a uuid column, so an empty selection must become NULL, not "".
function normalize(input: PaymentInput) {
  return { ...input, invoice_id: input.invoice_id || null };
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
  const { error } = await getSupabase().from("payments").insert(normalize(input));
  if (error) throw new Error(error.message);
}

export async function updatePayment(id: string, input: PaymentInput): Promise<void> {
  const { error } = await getSupabase().from("payments").update(normalize(input)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await getSupabase().from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
