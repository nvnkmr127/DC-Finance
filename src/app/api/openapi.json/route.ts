export async function GET(req: Request) {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const serverUrl = `${protocol}://${host}`;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "DC Finance API for ChatGPT & Custom GPTs",
      description:
        "Manage outbound webhooks, inspect payments, invoices, expenses, and clients in DC Finance.",
      version: "1.0.0",
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/api/gpt/overview": {
        get: {
          operationId: "getFinancialOverview",
          summary: "Get overall financial dashboard statistics and outstanding balances",
          responses: {
            "200": {
              description: "Financial overview metrics",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/gpt/webhooks": {
        get: {
          operationId: "listWebhooks",
          summary: "List all configured outbound webhook endpoints",
          responses: {
            "200": {
              description: "Array of webhook configurations",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
        post: {
          operationId: "createWebhook",
          summary: "Create a new outbound webhook subscription",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "url"],
                  properties: {
                    name: { type: "string", description: "Webhook title (e.g. 'Slack Alert')" },
                    url: { type: "string", description: "Destination HTTPS URL" },
                    events: {
                      type: "array",
                      items: { type: "string" },
                      description: "Events to subscribe to or ['*'] for all events",
                    },
                    secret: { type: "string", description: "Optional HMAC secret" },
                    is_active: { type: "boolean", default: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Webhook successfully created",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/gpt/webhooks/test": {
        post: {
          operationId: "testWebhook",
          summary: "Send an immediate test.ping payload to a webhook endpoint",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["webhook_id"],
                  properties: {
                    webhook_id: { type: "string", description: "ID of the webhook to ping" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Test ping results including status and latency",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/gpt/webhooks/deliveries": {
        get: {
          operationId: "listWebhookDeliveries",
          summary: "List recent webhook delivery logs with status codes and latencies",
          parameters: [
            {
              name: "webhook_id",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Filter by webhook ID",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 },
              description: "Max number of logs to return",
            },
          ],
          responses: {
            "200": {
              description: "Array of delivery records",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
      "/api/gpt/webhooks/dispatch": {
        post: {
          operationId: "dispatchWebhookEvent",
          summary: "Manually trigger an outbound event to active webhook subscribers",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["event", "data"],
                  properties: {
                    event: { type: "string", description: "Event name (e.g. payment.created)" },
                    data: { type: "object", description: "Event payload data" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Dispatch delivery summary",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/gpt/invoices": {
        get: {
          operationId: "listInvoices",
          summary: "List client invoices with balance and payment status",
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["all", "draft", "sent", "paid", "partial", "cancelled"],
                default: "all",
              },
              description: "Filter by status",
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: {
            "200": {
              description: "Array of invoices",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
      "/api/gpt/payments": {
        get: {
          operationId: "listPayments",
          summary: "List recent client payments",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: {
            "200": {
              description: "Array of payments",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
      "/api/gpt/expenses": {
        get: {
          operationId: "listExpenses",
          summary: "List business expenses by category and date",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 },
            },
          ],
          responses: {
            "200": {
              description: "Array of expenses",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
      "/api/gpt/clients": {
        get: {
          operationId: "listClients",
          summary: "List clients with monthly contract values and outstanding totals",
          responses: {
            "200": {
              description: "Array of client summaries",
              content: { "application/json": { schema: { type: "array", items: { type: "object" } } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Enter your static DC_FINANCE_API_KEY",
        },
        OAuth2: {
          type: "oauth2",
          description: "Standard OAuth 2.0 Authorization Code flow for ChatGPT Actions",
          flows: {
            authorizationCode: {
              authorizationUrl: `${serverUrl}/api/oauth/authorize`,
              tokenUrl: `${serverUrl}/api/oauth/token`,
              scopes: {
                "finance:read": "Read financial records (invoices, payments, expenses, clients)",
                "webhooks:write": "Manage and dispatch webhooks",
              },
            },
          },
        },
      },
    },
    security: [{ OAuth2: ["finance:read", "webhooks:write"] }, { BearerAuth: [] }],
  };

  return Response.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
