import { getClient, registerClient, createAuthorizationCode } from "@/lib/oauth-server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") || "";
  const scope = url.searchParams.get("scope") || "finance:read webhooks:write";
  const codeChallenge = url.searchParams.get("code_challenge") || undefined;
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || undefined;

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
    if (codeChallenge) consentUrl.searchParams.set("code_challenge", codeChallenge);
    if (codeChallengeMethod) consentUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
    return Response.redirect(consentUrl.toString(), 302);
  }

  // Verify registered client and redirect URI
  const client = await getClient(clientId);
  if (!client) {
    return new Response("invalid_client: Client ID not found. Register client credentials first.", { status: 400 });
  }

  if (!client.redirect_uris.includes(redirectUri)) {
    return new Response("invalid_request: redirect_uri is not registered for this client", { status: 400 });
  }

  // Create single-use authorization code
  const code = await createAuthorizationCode({
    clientId,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
  });

  // Redirect back to caller with code & state
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);

  return Response.redirect(target.toString(), 302);
}
