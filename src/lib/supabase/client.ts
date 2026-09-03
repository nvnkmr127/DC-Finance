import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton so `next build` doesn't crash when env vars aren't set yet
// (createClient throws on an undefined URL). Only called client-side at runtime.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New-style publishable key (sb_publishable_…) or the legacy anon key.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  client = createClient(url, key);
  return client;
}
