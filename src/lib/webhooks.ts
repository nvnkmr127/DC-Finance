import { z } from "zod";
import { getSupabase } from "@/lib/supabase/client";

export const WEBHOOK_EVENTS = [
  { name: "payment.created", label: "Payment Created", description: "Triggered when a payment is recorded" },
  { name: "payment.updated", label: "Payment Updated", description: "Triggered when a payment is modified" },
  { name: "payment.deleted", label: "Payment Deleted", description: "Triggered when a payment is deleted" },
  { name: "invoice.created", label: "Invoice Created", description: "Triggered when an invoice is created" },
  { name: "invoice.updated", label: "Invoice Updated", description: "Triggered when an invoice is updated" },
  { name: "invoice.paid", label: "Invoice Paid", description: "Triggered when an invoice is fully paid" },
  { name: "invoice.deleted", label: "Invoice Deleted", description: "Triggered when an invoice is deleted" },
  { name: "expense.created", label: "Expense Created", description: "Triggered when an expense is logged" },
  { name: "expense.updated", label: "Expense Updated", description: "Triggered when an expense is modified" },
  { name: "expense.deleted", label: "Expense Deleted", description: "Triggered when an expense is deleted" },
  { name: "client.created", label: "Client Created", description: "Triggered when a new client is added" },
  { name: "client.updated", label: "Client Updated", description: "Triggered when client details change" },
  { name: "client.deleted", label: "Client Deleted", description: "Triggered when a client is removed" },
  { name: "test.ping", label: "Test Ping", description: "Manual verification ping" },
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENTS)[number]["name"];

export const webhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Must be a valid HTTP or HTTPS URL"),
  secret: z.string().min(8, "Secret must be at least 8 characters").optional(),
  events: z.array(z.string()).min(1, "Select at least one event"),
  is_active: z.boolean().default(true),
});

export type WebhookInput = z.infer<typeof webhookSchema>;

export type Webhook = {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  event: string;
  url: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  response_body: string | null;
  execution_time_ms: number | null;
  success: boolean;
  error: string | null;
  delivered_at: string;
  webhooks?: { name: string } | null;
};

export function generateWebhookSecret(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let random = "";
  for (let i = 0; i < 32; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `whsec_${random}`;
}

export async function listWebhooks(): Promise<Webhook[]> {
  const { data, error } = await getSupabase()
    .from("webhooks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Webhook[];
}

export async function createWebhook(input: WebhookInput): Promise<Webhook> {
  const secret = input.secret?.trim() || generateWebhookSecret();
  const { data, error } = await getSupabase()
    .from("webhooks")
    .insert({
      name: input.name.trim(),
      url: input.url.trim(),
      secret,
      events: input.events,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Webhook;
}

export async function updateWebhook(id: string, input: Partial<WebhookInput>): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.url !== undefined) updateData.url = input.url.trim();
  if (input.secret !== undefined) updateData.secret = input.secret.trim();
  if (input.events !== undefined) updateData.events = input.events;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { error } = await getSupabase().from("webhooks").update(updateData).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await getSupabase().from("webhooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listWebhookDeliveries(options?: {
  webhookId?: string;
  limit?: number;
}): Promise<WebhookDelivery[]> {
  let query = getSupabase()
    .from("webhook_deliveries")
    .select("*, webhooks(name)")
    .order("delivered_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.webhookId) {
    query = query.eq("webhook_id", options.webhookId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as unknown as WebhookDelivery[];
}

// Client-side dispatcher helper: fires in the background without blocking the UI
export async function dispatchWebhookEvent(
  event: WebhookEventName,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: sessionData } = await getSupabase().auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    fetch("/api/webhooks/dispatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event, data }),
    }).catch((err) => {
      console.warn("Webhook dispatch failed:", err);
    });
  } catch (err) {
    console.warn("Webhook dispatch session lookup failed:", err);
  }
}

// Trigger a test ping for a specific webhook
export async function testWebhook(webhookId: string): Promise<{
  success: boolean;
  status_code: number | null;
  execution_time_ms: number | null;
  error?: string;
}> {
  const { data: sessionData } = await getSupabase().auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/webhooks/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ webhookId }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to send test ping");
  return json;
}

// Re-deliver an existing delivery record
export async function redeliverWebhook(deliveryId: string): Promise<{
  success: boolean;
  status_code: number | null;
  execution_time_ms: number | null;
  error?: string;
}> {
  const { data: sessionData } = await getSupabase().auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch("/api/webhooks/redeliver", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ deliveryId }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to redeliver webhook");
  return json;
}
