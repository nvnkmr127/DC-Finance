import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { executeWebhookDelivery } from "../src/lib/webhooks-server";
import { generateWebhookSecret } from "../src/lib/webhooks";

// Load environment variables from .env.local quietly (stdio must be pure JSON-RPC)
config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Optional: Sign in with credentials if configured for RLS
async function initAuth() {
  const email = process.env.DC_FINANCE_USER_EMAIL;
  const password = process.env.DC_FINANCE_USER_PASSWORD;
  if (email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(`Warning: Failed to sign in as ${email}:`, error.message);
    }
  }
}

const server = new McpServer({
  name: "dc-finance",
  version: "1.0.0",
});

// 1. List Webhooks
server.tool(
  "list_webhooks",
  "List all configured outbound webhook endpoints in DC Finance, including their URLs, event subscriptions, and active statuses.",
  {},
  async () => {
    const { data, error } = await supabase
      .from("webhooks")
      .select("id, name, url, events, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return { content: [{ type: "text", text: `Error fetching webhooks: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// 2. Create Webhook
server.tool(
  "create_webhook",
  "Create a new outbound webhook endpoint subscription in DC Finance.",
  {
    name: z.string().describe("Human-readable name for the webhook (e.g. 'Slack Notifications')"),
    url: z.string().url().describe("Destination HTTPS/HTTP URL that will receive POST payloads"),
    events: z
      .array(z.string())
      .default(["*"])
      .describe("Array of event names to subscribe to, or ['*'] for all events"),
    secret: z
      .string()
      .optional()
      .describe("Custom HMAC secret (optional, auto-generated if omitted)"),
    is_active: z.boolean().default(true).describe("Whether the webhook is active immediately"),
  },
  async ({ name, url, events, secret, is_active }) => {
    const whSecret = secret?.trim() || generateWebhookSecret();
    const { data, error } = await supabase
      .from("webhooks")
      .insert({
        name: name.trim(),
        url: url.trim(),
        secret: whSecret,
        events,
        is_active,
      })
      .select("id, name, url, events, is_active, created_at")
      .single();

    if (error) {
      return { content: [{ type: "text", text: `Error creating webhook: ${error.message}` }] };
    }

    return {
      content: [
        {
          type: "text",
          text: `Webhook created successfully:\n${JSON.stringify({ ...data, secret: whSecret }, null, 2)}`,
        },
      ],
    };
  },
);

// 3. Test Webhook
server.tool(
  "test_webhook",
  "Send an immediate 'test.ping' webhook event to a specific webhook endpoint to verify connectivity and signature.",
  {
    webhook_id: z.string().describe("The ID of the webhook endpoint to test"),
  },
  async ({ webhook_id }) => {
    const { data: webhook, error } = await supabase
      .from("webhooks")
      .select("id, url, secret")
      .eq("id", webhook_id)
      .single();

    if (error || !webhook) {
      return { content: [{ type: "text", text: `Webhook not found: ${error?.message}` }] };
    }

    const testPayload = {
      message: "Test ping from DC Finance MCP server",
      test: true,
      timestamp: new Date().toISOString(),
    };

    const result = await executeWebhookDelivery(webhook, "test.ping", testPayload, supabase);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

// 4. List Webhook Deliveries
server.tool(
  "list_webhook_deliveries",
  "View recent webhook delivery logs, including status codes, latency, payload, and response bodies.",
  {
    webhook_id: z.string().optional().describe("Filter deliveries by specific webhook ID"),
    limit: z.number().default(20).describe("Maximum number of deliveries to return (default 20)"),
  },
  async ({ webhook_id, limit }) => {
    let query = supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event, url, status_code, execution_time_ms, success, error, delivered_at")
      .order("delivered_at", { ascending: false })
      .limit(limit);

    if (webhook_id) {
      query = query.eq("webhook_id", webhook_id);
    }

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: `Error fetching delivery logs: ${error.message}` }] };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
);

// 5. Dispatch Custom Event
server.tool(
  "dispatch_webhook_event",
  "Manually trigger an outbound event to all active subscribed webhook endpoints.",
  {
    event: z.string().describe("Event name (e.g. 'payment.created', 'invoice.paid', 'custom.alert')"),
    data: z.record(z.string(), z.unknown()).describe("Event data payload object"),
  },
  async ({ event, data }) => {
    const { data: webhooks, error } = await supabase
      .from("webhooks")
      .select("id, url, secret, events")
      .eq("is_active", true);

    if (error) {
      return { content: [{ type: "text", text: `Error finding webhooks: ${error.message}` }] };
    }

    const matching = (webhooks || []).filter((wh) => {
      const events = Array.isArray(wh.events) ? wh.events : [];
      return events.includes("*") || events.includes(event);
    });

    if (matching.length === 0) {
      return { content: [{ type: "text", text: `No active webhooks subscribed to event '${event}'.` }] };
    }

    const results = await Promise.allSettled(
      matching.map((wh) => executeWebhookDelivery(wh, event, data, supabase)),
    );

    const summary = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { webhook_id: matching[i].id, success: false, error: String(r.reason) };
    });

    return {
      content: [{ type: "text", text: `Dispatched to ${matching.length} endpoints:\n${JSON.stringify(summary, null, 2)}` }],
    };
  },
);

// 6. List Payments
server.tool(
  "list_payments",
  "List recent client payments in DC Finance.",
  {
    limit: z.number().default(20).describe("Number of payments to retrieve"),
  },
  async ({ limit }) => {
    const { data, error } = await supabase
      .from("payments")
      .select("id, client_id, amount, payment_date, payment_method, reference_number, notes, billing_month, clients(name, company)")
      .order("payment_date", { ascending: false })
      .limit(limit);

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

// 7. List Invoices
server.tool(
  "list_invoices",
  "List invoices in DC Finance with their payment status and outstanding balances.",
  {
    status: z.enum(["all", "draft", "sent", "paid", "partial", "cancelled"]).default("all").describe("Filter by invoice status"),
    limit: z.number().default(20).describe("Number of invoices to retrieve"),
  },
  async ({ status, limit }) => {
    let query = supabase
      .from("invoice_summary")
      .select("*")
      .order("issue_date", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("display_status", status);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

// 8. List Expenses
server.tool(
  "list_expenses",
  "List business expenses logged in DC Finance.",
  {
    limit: z.number().default(20).describe("Number of expenses to retrieve"),
  },
  async ({ limit }) => {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, category, description, vendor, amount, expense_date, payment_method")
      .order("expense_date", { ascending: false })
      .limit(limit);

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

// 9. List Clients
server.tool(
  "list_clients",
  "List active clients and their monthly billing values.",
  {},
  async () => {
    const { data, error } = await supabase
      .from("client_summary")
      .select("id, name, company, service, monthly_value, status, received, outstanding")
      .order("name", { ascending: true });

    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);

// Start stdio transport
async function start() {
  await initAuth();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

start().catch((err) => {
  console.error("Fatal error starting DC Finance MCP server:", err);
  process.exit(1);
});
