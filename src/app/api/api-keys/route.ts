import { NextResponse } from "next/server";
import { issueApiKey, listApiKeys, revokeApiKey } from "@/lib/oauth-server";

export async function GET() {
  try {
    const keys = await listApiKeys();
    return NextResponse.json({ keys });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list API keys" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name : "Frontend API Key";
    const newKey = await issueApiKey(name);
    return NextResponse.json({ key: newKey }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate API key" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }
    await revokeApiKey(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to revoke API key" },
      { status: 500 },
    );
  }
}
