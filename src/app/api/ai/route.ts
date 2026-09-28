import { generateText } from "ai";

// Vercel AI Gateway. Auth via AI_GATEWAY_API_KEY (or OIDC on Vercel).
// Free model ($0 in/out via the gateway), finance-tuned, 256K context.
// Swap to e.g. "anthropic/claude-sonnet-5" for higher quality at a cost.
const MODEL = "inclusionai/ling-3.0-flash-sante-free";

export const maxDuration = 60;

type Body = {
  mode: "insights" | "chat" | "draft_reminder" | "parse_receipt" | "audit_subscriptions";
  currency?: string;
  context?: unknown;
  messages?: { role: "user" | "assistant"; content: string }[];
  draftDetails?: {
    clientName: string;
    companyName: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    overdueDays: number;
    tone?: "gentle" | "professional" | "firm";
  };
  receiptText?: string;
  categories?: string[];
  subscriptions?: unknown[];
};

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "AI is not configured. Add AI_GATEWAY_API_KEY to enable it." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { mode, currency = "INR", context, messages } = body;

  const instructions =
    `You are an expert CFO and financial strategist for a small business. All currency amounts are in ${currency}.\n\n` +
    `CORE FINANCIAL METRICS & REASONING RULES:\n` +
    `- Net Profit = Revenue - (Expenses + Salaries). Net Margin % = (Net Profit / Revenue) * 100.\n` +
    `- Cash Runway = Cash Balance / Monthly Burn (when net profit/cashflow is negative). Always assess runway risk when cash balance is available.\n` +
    `- Outstanding / AR: Uncollected revenue from clients. Cite specific client names and exact amounts owed.\n` +
    `- Pending Salaries: Unpaid compensation liabilities owed to staff. Highlight immediate liquidity pressure.\n` +
    `- Budget Variance: Compare actual spend vs allocated budgets to flag specific cost leaks.\n` +
    `- Grounding: Quote exact figures with ${currency}. Never hallucinate numbers. If data is missing or zero, note it as "no data" rather than guessing.\n\n` +
    `UPDATING RESULTS & SCENARIO ANALYSIS:\n` +
    `- When asked "what if", recalculation, projection, or update questions (e.g. "what if we cut marketing?", "client X pays ₹Y", "hire a dev at ₹Z", "revenue falls 20%"):\n` +
    `  1. Clearly calculate the updated figures step-by-step.\n` +
    `  2. Present a structured Before vs After summary (Baseline -> Updated -> Delta) for Revenue, Expenses, Net Profit, Margin %, and Runway.\n` +
    `  3. Give a 1-2 sentence strategic recommendation based on the change.\n\n` +
    `FULL FINANCIAL DATASET ACCESS:\n` +
    `- The data context includes high-level totals AND granular record ledgers: allPayments, allExpenses, allSalaries, allClients, allEmployees, and allRecurring.\n` +
    `- You can perform granular drill-downs: identify specific vendors, examine client payment timing/history, audit recurring subscriptions for cost cuts, and check employee compensation details.\n\n` +
    `FINANCIAL DATA CONTEXT (JSON):\n` +
    JSON.stringify(context);

  try {
    if (mode === "insights") {
      const { text } = await generateText({
        model: MODEL,
        instructions,
        prompt:
          "Write a short daily financial briefing from the data. Structure it as:\n" +
          "- Health: one line — is the business up/down/flat this period and why, with the key number.\n" +
          "- Watch: the real concerns, each with its figure — thin/negative margin, category over budget, " +
          "overdue receivables (AR aging), pending salaries, low runway. Skip any that don't apply.\n" +
          "- Do next: 2-3 specific, prioritized actions the owner should take now (e.g. 'chase ₹X overdue from Client Y', " +
          "'cut/renew recurring Z', 'invoice the 3 clients not yet billed this month'). Make them concrete and tied to the data.\n" +
          "Use plain '- ' bullets under those three bold labels. No preamble, no restating the whole dataset. " +
          "If there's essentially no activity yet, say that in one line instead of padding.",
      });
      return Response.json({ text });
    }

    if (mode === "chat") {
      if (!messages?.length) {
        return Response.json({ error: "No messages provided" }, { status: 400 });
      }
      const { text } = await generateText({ model: MODEL, instructions, messages });
      return Response.json({ text });
    }

    if (mode === "draft_reminder") {
      const d = body.draftDetails;
      if (!d) return Response.json({ error: "Missing draft details" }, { status: 400 });
      const tone = d.tone || (d.overdueDays > 30 ? "firm" : d.overdueDays > 7 ? "professional" : "gentle");
      const { text } = await generateText({
        model: MODEL,
        instructions:
          "You are a polite, effective business communication assistant drafting WhatsApp payment reminder messages for a small business.",
        prompt:
          `Draft a concise WhatsApp reminder to send to a client regarding an invoice payment.\n` +
          `- Client Name: ${d.clientName}\n` +
          `- Sender / My Company: ${d.companyName}\n` +
          `- Invoice Number: ${d.invoiceNumber}\n` +
          `- Amount Due: ${d.amount}\n` +
          `- Due Date: ${d.dueDate}\n` +
          `- Status: ${d.overdueDays > 0 ? `${d.overdueDays} days overdue` : "Due soon"}\n` +
          `- Desired Tone: ${tone}\n\n` +
          `Guidelines:\n` +
          `- Length: 2 to 4 sentences.\n` +
          `- Format naturally for WhatsApp (use *bold* on invoice number and amount if appropriate).\n` +
          `- Ask clearly for the status, transaction reference, or estimated clearance date.\n` +
          `- Output ONLY the message text. Do not include subject lines, placeholders, or explanations.`,
      });
      return Response.json({ text: text.trim() });
    }

    if (mode === "parse_receipt") {
      const textInput = body.receiptText;
      if (!textInput?.trim()) return Response.json({ error: "No receipt text provided" }, { status: 400 });
      const availableCategories = body.categories || [];
      const { text } = await generateText({
        model: MODEL,
        instructions:
          "You are an expense data extraction assistant. Extract structured JSON from raw invoice/receipt text or email confirmations.",
        prompt:
          `Extract expense details from the following receipt/invoice text.\n` +
          `Available categories: ${availableCategories.join(", ") || "Office, Software, Marketing, Travel, Equipment, Utilities, Misc"}\n\n` +
          `Text:\n"""\n${textInput}\n"""\n\n` +
          `Respond with ONLY a valid raw JSON object matching this schema without markdown fences:\n` +
          `{\n` +
          `  "vendor": "string (company/store name)",\n` +
          `  "description": "string (short description of purchase)",\n` +
          `  "amount": number (total amount paid),\n` +
          `  "category": "string (best matching category from available list)",\n` +
          `  "expense_date": "YYYY-MM-DD (invoice or purchase date, default to today if not found)",\n` +
          `  "payment_method": "string (Credit Card, Bank Transfer, UPI, Cash, etc.)"\n` +
          `}`,
      });
      try {
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return Response.json({ data: parsed });
      } catch {
        return Response.json({ error: "Failed to parse receipt JSON", raw: text }, { status: 422 });
      }
    }

    if (mode === "audit_subscriptions") {
      const subs = body.subscriptions || [];
      const { text } = await generateText({
        model: MODEL,
        instructions:
          "You are a seasoned CFO conducting an overhead and SaaS subscription audit for a small business.",
        prompt:
          `Audit these active recurring expenses and subscriptions for potential cost cuts, duplicate software, and negotiation opportunities:\n` +
          JSON.stringify(subs, null, 2) + `\n\n` +
          `Provide:\n` +
          `1. **Overhead Summary**: Total monthly and annual commitment, top category drains.\n` +
          `2. **Potential Redundancies / Overlap**: Any tools that duplicate functionality or have cheaper alternatives.\n` +
          `3. **Immediate Pruning Actions**: 2-3 specific subscriptions to cancel, downgrade, or renegotiate.\n` +
          `4. **Negotiation Templates**: 1 ready-to-use email/message draft requesting a discount or annual tier concession for the largest tool.`,
      });
      return Response.json({ text: text.trim() });
    }

    return Response.json({ error: "Unknown mode" }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 502 },
    );
  }
}
