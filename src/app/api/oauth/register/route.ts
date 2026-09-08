import { NextResponse } from "next/server";
import { registerClient } from "@/lib/oauth-server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const clientName = body.client_name || "External AI Connector";
    const redirectUris = Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0
      ? body.redirect_uris
      : ["https://chat.openai.com/aip/plugin-oauth/callback", "https://chatgpt.com/aip/plugin-oauth/callback"];

    const client = await registerClient({
      name: clientName,
      redirectUris,
    });

    return NextResponse.json(
      {
        client_id: client.client_id,
        client_secret: client.client_secret,
        client_name: client.name,
        redirect_uris: client.redirect_uris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: err instanceof Error ? err.message : "Registration failed" },
      { status: 400 },
    );
  }
}
