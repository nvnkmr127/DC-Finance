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

  let body: { webhookId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.webhookId) {
    return Response.json({ error: "Missing webhookId." }, { status: 400 });
  }

  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select("id, url, secret")
    .eq("id", body.webhookId)
    .single();

  if (webhookError || !webhook) {
    return Response.json({ error: "Webhook not found." }, { status: 404 });
  }

  const testPayload = {
    message: "This is a test event from DC Finance.",
    test: true,
    sent_by: userData.user.email ?? "admin",
  };

  const result = await executeWebhookDelivery(webhook, "test.ping", testPayload, supabase);
  return Response.json(result);
}
