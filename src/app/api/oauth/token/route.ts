import { exchangeCodeForTokens, refreshAccessToken } from "@/lib/oauth-server";

export async function POST(req: Request) {
  let grantType = "";
  let code = "";
  let clientId = "";
  let clientSecret = "";
  let redirectUri = "";
  let refreshToken = "";
  let codeVerifier = "";

  // Check HTTP Basic Auth header (e.g. Basic base64(client_id:client_secret))
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authHeader.replace(/^Basic\s+/i, ""), "base64").toString("utf-8");
      const [id, secret] = decoded.split(":");
      clientId = id || "";
      clientSecret = secret || "";
    } catch {
      // ignore parse error, fallback to body
    }
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    grantType = params.get("grant_type") || "";
    code = params.get("code") || "";
    if (!clientId) clientId = params.get("client_id") || "";
    if (!clientSecret) clientSecret = params.get("client_secret") || "";
    redirectUri = params.get("redirect_uri") || "";
    refreshToken = params.get("refresh_token") || "";
    codeVerifier = params.get("code_verifier") || "";
  } else {
    try {
      const json = await req.json();
      grantType = json.grant_type || "";
      code = json.code || "";
      if (!clientId) clientId = json.client_id || "";
      if (!clientSecret) clientSecret = json.client_secret || "";
      redirectUri = json.redirect_uri || "";
      refreshToken = json.refresh_token || "";
      codeVerifier = json.code_verifier || "";
    } catch {
      // Empty or unparseable JSON
    }
  }

  try {
    if (grantType === "authorization_code") {
      if (!code || !clientId || !clientSecret || !redirectUri) {
        return Response.json(
          { error: "invalid_request", error_description: "Missing required parameters" },
          { status: 400 },
        );
      }

      const tokens = await exchangeCodeForTokens({
        code,
        clientId,
        clientSecret,
        redirectUri,
        codeVerifier: codeVerifier || undefined,
      });

      return Response.json(tokens, {
        headers: {
          "Cache-Control": "no-store",
          "Pragma": "no-cache",
        },
      });
    }

    if (grantType === "refresh_token") {
      if (!refreshToken || !clientId || !clientSecret) {
        return Response.json(
          { error: "invalid_request", error_description: "Missing refresh_token, client_id, or client_secret" },
          { status: 400 },
        );
      }

      const tokens = await refreshAccessToken({
        refreshToken,
        clientId,
        clientSecret,
      });

      return Response.json(tokens, {
        headers: {
          "Cache-Control": "no-store",
          "Pragma": "no-cache",
        },
      });
    }

    return Response.json(
      { error: "unsupported_grant_type", error_description: "Supported: authorization_code, refresh_token" },
      { status: 400 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OAuth token exchange error";
    const [errorCode, ...rest] = message.split(": ");
    return Response.json(
      {
        error: errorCode.trim() || "invalid_grant",
        error_description: rest.join(": ").trim() || message,
      },
      { status: 400 },
    );
  }
}
