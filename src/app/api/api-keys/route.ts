import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { issueApiKey, listApiKeys, revokeApiKey } from "@/lib/oauth-server";

async function verifyUser(req: Request): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    }
    return null;
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return null;
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  return null;
}

export async function GET(req: Request) {
  const authErr = await verifyUser(req);
  if (authErr) return authErr;

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
  const authErr = await verifyUser(req);
  if (authErr) return authErr;

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
  const authErr = await verifyUser(req);
  if (authErr) return authErr;

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
