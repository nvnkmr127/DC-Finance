import { generateText } from "ai";

// Vercel AI Gateway. Auth via AI_GATEWAY_API_KEY (or OIDC on Vercel).
const MODEL = "anthropic/claude-sonnet-5";

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
    `You are a concise financial analyst for a small business. ` +
    `All amounts are in ${currency}. Base every statement strictly on the data below — ` +
    `never invent figures. Be specific and quantitative; format money with the ${currency} amount. ` +
    `Here is the current financial data as JSON:\n\n` +
    JSON.stringify(context);

  try {
    if (mode === "insights") {
      const { text } = await generateText({
        model: MODEL,
        instructions,
        prompt:
          "Give 3-5 short bullet insights on this month's finances: what stands out, " +
          "any concerns (margin, overspend vs budget, overdue clients, pending salaries), " +
          "and one concrete suggestion. Use plain '- ' bullets, no preamble.",
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
