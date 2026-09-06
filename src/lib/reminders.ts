import { getSupabase } from "@/lib/supabase/client";

// Calls the server route that sends via Resend, passing the session token so the
// route can verify the caller. The API key stays server-side.
export async function sendReminderEmail(payload: {
  to: string;
  from: string;
  subject: string;
  text: string;
}): Promise<void> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch("/api/send-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Failed to send email");
}
