import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyAccessToken } from "@/lib/oauth-server";

export async function getAuthError(req: Request, requiredScope?: string): Promise<Response | null> {
  const configuredKey = process.env.DC_FINANCE_API_KEY;

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim() || apiKeyHeader.trim();

  // 1. Static Master API Key check (grants full access across all scopes)
  if (configuredKey && token === configuredKey) {
    return null;
  }

  // 2. OAuth 2.0 Access Token check
  if (token && token.startsWith("atk_")) {
    const verification = await verifyAccessToken(token, requiredScope);
    if (verification.valid) {
      return null;
    }
    return Response.json(
      { error: "unauthorized", error_description: verification.error || "Invalid or expired token" },
      { status: 401 },
    );
  }

  // 3. Fallback check for production vs development
  if (!configuredKey) {
    if (process.env.NODE_ENV === "production") {
      return Response.json(
        { error: "Server misconfiguration: DC_FINANCE_API_KEY is not set on the server." },
        { status: 500 },
      );
    }
    return null; // allow in local dev if no key set
  }

  return Response.json(
    { error: "unauthorized", error_description: "Invalid or missing Bearer token / API key." },
    { status: 401 },
  );
}

export function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials missing.");
  }

  return createClient(url, key);
}
