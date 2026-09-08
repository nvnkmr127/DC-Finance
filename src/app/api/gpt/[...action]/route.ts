import { getAuthError, getServiceSupabase } from "@/lib/gpt-auth";
import { executeWebhookDelivery } from "@/lib/webhooks-server";
import { generateWebhookSecret } from "@/lib/webhooks";

type RouteContext = {
  params: Promise<{ action: string[] }>;
};

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    },
  });
}

export async function GET(req: Request, context: RouteContext) {
  const authErr = await getAuthError(req, "finance:read");
  if (authErr) return authErr;

  const { action } = await context.params;
  const path = action.join("/");
  const url = new URL(req.url);
  const supabase = getServiceSupabase();

  try {
    if (path === "overview") {
      const [{ data: invs }, { data: exps }, { data: whs }] = await Promise.all([
        supabase.from("invoice_summary").select("total, paid, balance"),
        supabase.from("expenses").select("amount"),
        supabase.from("webhooks").select("id, is_active"),
      ]);

      const totalInvoiced = (invs || []).reduce((sum, i) => sum + Number(i.total || 0), 0);
      const totalCollected = (invs || []).reduce((sum, i) => sum + Number(i.paid || 0), 0);
      const totalOutstanding = (invs || []).reduce((sum, i) => sum + Number(i.balance || 0), 0);
      const totalExpenses = (exps || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const netProfit = totalCollected - totalExpenses;

      return Response.json({
        total_invoiced: totalInvoiced,
        total_collected: totalCollected,
        total_outstanding: totalOutstanding,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        active_webhooks: (whs || []).filter((w) => w.is_active).length,
      });
    }

    if (path === "webhooks") {
      const { data, error } = await supabase
        .from("webhooks")
        .select("id, name, url, events, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data);
    }

    if (path === "webhooks/deliveries") {
      const webhookId = url.searchParams.get("webhook_id");
      const limit = Number(url.searchParams.get("limit")) || 20;

      let query = supabase
        .from("webhook_deliveries")
        .select("id, webhook_id, event, url, status_code, execution_time_ms, success, error, delivered_at")
        .order("delivered_at", { ascending: false })
        .limit(limit);

      if (webhookId) query = query.eq("webhook_id", webhookId);
      const { data, error } = await query;
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data);
    }

    if (path === "invoices") {
      const status = url.searchParams.get("status") || "all";
      const limit = Number(url.searchParams.get("limit")) || 20;

      let query = supabase
        .from("invoice_summary")
        .select("id, invoice_number, client_name, client_company, issue_date, due_date, total, paid, balance, display_status")
        .order("issue_date", { ascending: false })
        .limit(limit);

      if (status !== "all") query = query.eq("display_status", status);
      const { data, error } = await query;
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data);
    }

    if (path === "payments") {
      const limit = Number(url.searchParams.get("limit")) || 20;
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, payment_date, payment_method, billing_month, reference_number, clients(name, company)")
        .order("payment_date", { ascending: false })
        .limit(limit);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data);
    }

    if (path === "expenses") {
      const limit = Number(url.searchParams.get("limit")) || 20;
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, description, vendor, amount, expense_date, payment_method")
        .order("expense_date", { ascending: false })
        .limit(limit);
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data);
    }

    if (path === "clients") {
      const { data, error } = await supabase
        .from("client_summary")
        .select("id, name, company, service, monthly_value, status, received, outstanding")
        .order("name", { ascending: true });
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json(data);
    }

    return Response.json({ error: `Not found: /api/gpt/${path}` }, { status: 404 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const authErr = await getAuthError(req, "webhooks:write");
  if (authErr) return authErr;

  const { action } = await context.params;
  const path = action.join("/");
  const supabase = getServiceSupabase();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is okay for some calls
  }

  try {
    if (path === "webhooks") {
      const name = String(body.name || "").trim();
      const targetUrl = String(body.url || "").trim();
      const events = Array.isArray(body.events) ? body.events : ["*"];
      const secret = String(body.secret || "").trim() || generateWebhookSecret();
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

      if (!name || !targetUrl) {
        return Response.json({ error: "Missing name or url" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("webhooks")
        .insert({ name, url: targetUrl, events, secret, is_active: isActive })
        .select("id, name, url, events, is_active, created_at")
        .single();

      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ ...data, secret });
    }

    if (path === "webhooks/test") {
      const webhookId = String(body.webhook_id || "");
      if (!webhookId) return Response.json({ error: "Missing webhook_id" }, { status: 400 });

      const { data: webhook, error } = await supabase
        .from("webhooks")
        .select("id, url, secret")
        .eq("id", webhookId)
        .single();

      if (error || !webhook) {
        return Response.json({ error: "Webhook endpoint not found" }, { status: 404 });
      }

      const testPayload = {
        message: "Test ping from ChatGPT / External GPT Action",
        test: true,
        timestamp: new Date().toISOString(),
      };

      const result = await executeWebhookDelivery(webhook, "test.ping", testPayload, supabase);
      return Response.json(result);
    }

    if (path === "webhooks/dispatch") {
      const event = String(body.event || "");
      const eventData = (body.data as Record<string, unknown>) || {};
      if (!event) return Response.json({ error: "Missing event name" }, { status: 400 });

      const { data: webhooks, error } = await supabase
        .from("webhooks")
        .select("id, url, secret, events")
        .eq("is_active", true);

      if (error) return Response.json({ error: error.message }, { status: 500 });

      const matching = (webhooks || []).filter((wh) => {
        const events = Array.isArray(wh.events) ? wh.events : [];
        return events.includes("*") || events.includes(event);
      });

      if (matching.length === 0) {
        return Response.json({ message: `No active webhooks subscribed to event '${event}'`, dispatched: 0 });
      }

      const results = await Promise.allSettled(
        matching.map((wh) => executeWebhookDelivery(wh, event, eventData, supabase)),
      );

      const summary = results.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        return { webhook_id: matching[i].id, success: false, error: String(r.reason) };
      });

      return Response.json({ dispatched: matching.length, results: summary });
    }

    return Response.json({ error: `Not found: /api/gpt/${path}` }, { status: 404 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
