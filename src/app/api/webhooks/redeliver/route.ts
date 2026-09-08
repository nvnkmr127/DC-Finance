import { createClient } from "@supabase/supabase-js";
import { executeWebhookDelivery } from "@/lib/webhooks-server";

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return Response.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { deliveryId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.deliveryId) {
    return Response.json({ error: "Missing deliveryId." }, { status: 400 });
  }

  // Fetch the previous delivery
  const { data: delivery, error: deliveryError } = await supabase
    .from("webhook_deliveries")
    .select("webhook_id, event, payload")
    .eq("id", body.deliveryId)
    .single();

  if (deliveryError || !delivery) {
    return Response.json({ error: "Delivery not found." }, { status: 404 });
  }

  // Fetch current webhook config
  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select("id, url, secret")
    .eq("id", delivery.webhook_id)
    .single();

  if (webhookError || !webhook) {
    return Response.json({ error: "Associated webhook endpoint not found." }, { status: 404 });
  }

  const rawData =
    typeof delivery.payload === "object" && delivery.payload !== null && "data" in delivery.payload
      ? (delivery.payload as { data: Record<string, unknown> }).data
      : (delivery.payload as Record<string, unknown>);

  const result = await executeWebhookDelivery(webhook, delivery.event, rawData, supabase);
  return Response.json(result);
}
