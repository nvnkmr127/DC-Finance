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

  let body: { event?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { event, data } = body;
  if (!event || !data) {
    return Response.json({ error: "Missing event or data in payload." }, { status: 400 });
  }

  // Fetch all active webhooks
  const { data: webhooks, error: webhooksError } = await supabase
    .from("webhooks")
    .select("id, url, secret, events")
    .eq("is_active", true);

  if (webhooksError) {
    return Response.json({ error: webhooksError.message }, { status: 500 });
  }

  if (!webhooks || webhooks.length === 0) {
    return Response.json({ dispatched: 0, results: [] });
  }

  // Filter webhooks that subscribe to this event or wildcard "*"
  const matching = webhooks.filter((wh) => {
    const events = Array.isArray(wh.events) ? wh.events : [];
    return events.includes("*") || events.includes(event);
  });

  if (matching.length === 0) {
    return Response.json({ dispatched: 0, results: [] });
  }

  // Execute deliveries in parallel
  const results = await Promise.allSettled(
    matching.map((wh) => executeWebhookDelivery(wh, event, data, supabase)),
  );

  const deliveries = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      webhook_id: matching[i].id,
      url: matching[i].url,
      event,
      status_code: null,
      response_body: null,
      execution_time_ms: 0,
      success: false,
      error: r.reason instanceof Error ? r.reason.message : "Delivery failed",
    };
  });

  return Response.json({ dispatched: deliveries.length, results: deliveries });
}
