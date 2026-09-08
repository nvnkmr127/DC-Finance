import { getClient, registerClient, createAuthorizationCode } from "@/lib/oauth-server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") || "";
  const scope = url.searchParams.get("scope") || "finance:read webhooks:write";

  if (!clientId || !redirectUri) {
    return new Response("Missing client_id or redirect_uri", { status: 400 });
  }

  if (responseType !== "code") {
    return new Response("unsupported_response_type: response_type must be 'code'", { status: 400 });
  }

  const consent = url.searchParams.get("consent");
  if (consent !== "approved") {
    // Route through the interactive Consent UI dialog screen
    const consentUrl = new URL("/oauth/authorize", url.origin);
    consentUrl.searchParams.set("client_id", clientId);
    consentUrl.searchParams.set("redirect_uri", redirectUri);
    consentUrl.searchParams.set("response_type", responseType);
    if (state) consentUrl.searchParams.set("state", state);
    if (scope) consentUrl.searchParams.set("scope", scope);
    return Response.redirect(consentUrl.toString(), 302);
  }

  // Lookup client or auto-register standard ChatGPT client
  let client = await getClient(clientId);
  if (!client) {
    // If it's a new external client or ChatGPT, auto-register client credentials
    const defaultSecret = process.env.DC_FINANCE_API_KEY || "sec_chatgpt_default";
    client = await registerClient({
      name: "ChatGPT Action Client",
      clientId,
      clientSecret: defaultSecret,
      redirectUris: [redirectUri],
    });
  } else if (!client.redirect_uris.includes(redirectUri)) {
    // Append redirect URI if not listed
    const supabase = (await import("@/lib/gpt-auth")).getServiceSupabase();
    await supabase
      .from("oauth_clients")
      .update({ redirect_uris: [...client.redirect_uris, redirectUri] })
      .eq("id", client.id);
  }

  // Create single-use authorization code
  const code = await createAuthorizationCode({
    clientId,
    redirectUri,
    scope,
  });

  // Redirect back to caller with code & state
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);

  return Response.redirect(target.toString(), 302);
}
