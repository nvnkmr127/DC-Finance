// AI Gateway smoke test: streams a response and logs token usage.
// Run: npx tsx scripts/ai-smoke.ts   (reads AI_GATEWAY_API_KEY from .env.local)
import { config } from "dotenv";
import { streamText } from "ai";

config({ path: ".env.local" });

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error("AI_GATEWAY_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const result = streamText({
    model: "openai/gpt-5.6-sol",
    prompt: "Invent a new holiday and describe its traditions in 3 sentences.",
    onError: ({ error }) => console.error("\n[stream error]", error),
  });

  for await (const part of result.textStream) process.stdout.write(part);

  const usage = await result.usage;
  console.log("\n\n[usage]", usage);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
