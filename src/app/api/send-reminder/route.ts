import { createClient } from "@supabase/supabase-js";

// Server-side reminder sender. The Resend API key never leaves the server.
// Requires a valid Supabase session (so this isn't an open email relay).
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  // Verify the caller is signed in.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Not authenticated." }, { status: 401 });
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Email is not configured: set RESEND_API_KEY on the server." },
      { status: 500 },
    );
  }

  let body: { to?: string; from?: string; subject?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { to, from, subject, text } = body;
  if (!to || !from || !subject || !text) {
    return Response.json({ error: "Missing to, from, subject, or text." }, { status: 400 });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: `Resend rejected the email: ${detail}` }, { status: 502 });
  }

  return Response.json({ ok: true });
}
