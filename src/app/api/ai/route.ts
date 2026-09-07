import { generateText } from "ai";

// Vercel AI Gateway. Auth via AI_GATEWAY_API_KEY (or OIDC on Vercel).
// Free model ($0 in/out via the gateway), finance-tuned, 256K context.
// Swap to e.g. "anthropic/claude-sonnet-5" for higher quality at a cost.
const MODEL = "inclusionai/ling-3.0-flash-fin-free";

export const maxDuration = 60;

type Body = {
  mode: "insights" | "chat";
  currency?: string;
  context: unknown;
  messages?: { role: "user" | "assistant"; content: string }[];
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
    `You are a sharp financial advisor for a small business. ` +
    `All amounts are in ${currency}. Base every statement strictly on the data below — ` +
    `never invent figures, and quote the actual numbers you rely on. ` +
    `If a figure is zero, null, or missing, treat it as "no data" rather than a real value, ` +
    `and if the data is too sparse to judge, say so plainly instead of guessing. ` +
    `Here is the current financial data as JSON:\n\n` +
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

    return Response.json({ error: "Unknown mode" }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI request failed" },
      { status: 502 },
    );
  }
}
