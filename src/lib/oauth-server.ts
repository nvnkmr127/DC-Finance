import crypto from "node:crypto";
import { getServiceSupabase } from "@/lib/gpt-auth";

export type OAuthClient = {
  id: string;
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
  created_at: string;
};

export type OAuthTokenRecord = {
  id: string;
  access_token: string;
  refresh_token: string;
  client_id: string;
  user_id: string | null;
  scope: string;
  expires_at: string;
  revoked: boolean;
};

// Resilient memory cache fallback for when Supabase migrations have not been applied yet
const globalScope = globalThis as unknown as {
  __memClients?: Map<string, OAuthClient>;
  __memCodes?: Map<string, { code: string; client_id: string; redirect_uri: string; user_id: string | null; scope: string; expires_at: string; used: boolean }>;
  __memTokens?: Map<string, OAuthTokenRecord>;
};

const memClients = (globalScope.__memClients ??= new Map<string, OAuthClient>());
const memCodes = (globalScope.__memCodes ??= new Map());
const memTokens = (globalScope.__memTokens ??= new Map<string, OAuthTokenRecord>());

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = (error as { message?: string }).message || "";
  const code = (error as { code?: string }).code || "";
  return (
    code === "42P01" ||
    code === "42501" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level security")
  );
}

export function generateToken(prefix = ""): string {
  return `${prefix}${crypto.randomBytes(32).toString("hex")}`;
}

export const DEFAULT_OAUTH_CLIENT_ID = "dcfinance-chatgpt";
export const DEFAULT_OAUTH_CLIENT_SECRET = "dcf_secret_chatgpt";

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (clientId === DEFAULT_OAUTH_CLIENT_ID) {
    return {
      id: "default-chatgpt-client",
      client_id: DEFAULT_OAUTH_CLIENT_ID,
      client_secret: process.env.DC_FINANCE_API_KEY || DEFAULT_OAUTH_CLIENT_SECRET,
      name: "ChatGPT Connector",
      redirect_uris: [
        "https://chat.openai.com/aip/plugin-oauth/callback",
        "https://chatgpt.com/aip/plugin-oauth/callback",
      ],
      created_at: new Date().toISOString(),
    };
  }

  const supabase = getServiceSupabase();
  try {
    const { data, error } = await supabase
      .from("oauth_clients")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error && isMissingTableError(error)) {
      return memClients.get(clientId) || null;
    }
    return (data as OAuthClient) || memClients.get(clientId) || null;
  } catch (e) {
    if (isMissingTableError(e)) return memClients.get(clientId) || null;
    throw e;
  }
}

export async function registerClient(params: {
  name: string;
  redirectUris: string[];
  clientId?: string;
  clientSecret?: string;
}): Promise<OAuthClient> {
  const supabase = getServiceSupabase();
  const clientId = params.clientId || `client_${crypto.randomBytes(12).toString("hex")}`;
  const clientSecret = params.clientSecret || generateToken("sec_");

  const record: OAuthClient = {
    id: crypto.randomUUID(),
    client_id: clientId,
    client_secret: clientSecret,
    name: params.name,
    redirect_uris: params.redirectUris,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("oauth_clients")
      .insert({
        client_id: clientId,
        client_secret: clientSecret,
        name: params.name,
        redirect_uris: params.redirectUris,
      })
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        memClients.set(clientId, record);
        return record;
      }
      throw new Error(error.message);
    }
    return data as OAuthClient;
  } catch (e) {
    if (isMissingTableError(e)) {
      memClients.set(clientId, record);
      return record;
    }
    throw e;
  }
}

export async function createAuthorizationCode(params: {
  clientId: string;
  redirectUri: string;
  userId?: string | null;
  scope?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}): Promise<string> {
  const supabase = getServiceSupabase();
  const code = generateToken("code_");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

  const codeData = {
    code,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    user_id: params.userId || null,
    scope: params.scope || "finance:read webhooks:write",
    code_challenge: params.codeChallenge || null,
    code_challenge_method: params.codeChallengeMethod || null,
    expires_at: expiresAt,
    used: false,
  };

  try {
    const { error } = await supabase.from("oauth_codes").insert(codeData);
    if (error) {
      if (isMissingTableError(error)) {
        memCodes.set(code, codeData);
        return code;
      }
      throw new Error(error.message);
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      memCodes.set(code, codeData);
      return code;
    }
    throw e;
  }

  return code;
}

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}> {
  const supabase = getServiceSupabase();

  // 1. Verify client credentials
  const client = await getClient(params.clientId);
  if (!client || client.client_secret !== params.clientSecret) {
    throw new Error("invalid_client: Invalid client credentials");
  }

  // 2. Fetch and consume authorization code
  let codeRow: {
    id?: string;
    code: string;
    client_id: string;
    redirect_uri: string;
    user_id: string | null;
    scope: string;
    expires_at: string;
    used: boolean;
    code_challenge?: string | null;
    code_challenge_method?: string | null;
  } | null = null;

  try {
    const { data, error } = await supabase
      .from("oauth_codes")
      .select("*")
      .eq("code", params.code)
      .eq("client_id", params.clientId)
      .maybeSingle();

    if (error && isMissingTableError(error)) {
      codeRow = (memCodes.get(params.code) as typeof codeRow) || null;
    } else {
      codeRow = data || (memCodes.get(params.code) as typeof codeRow) || null;
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      codeRow = (memCodes.get(params.code) as typeof codeRow) || null;
    } else {
      throw e;
    }
  }

  if (!codeRow) {
    throw new Error("invalid_grant: Invalid authorization code");
  }

  if (codeRow.used) {
    throw new Error("invalid_grant: Authorization code has already been used");
  }

  if (new Date(codeRow.expires_at) < new Date()) {
    throw new Error("invalid_grant: Authorization code has expired");
  }

  if (codeRow.redirect_uri !== params.redirectUri) {
    throw new Error("invalid_grant: Redirect URI mismatch");
  }

  // PKCE verification (RFC 7636)
  if (codeRow.code_challenge) {
    if (!params.codeVerifier) {
      throw new Error("invalid_grant: code_verifier is required for PKCE");
    }
    const method = (codeRow.code_challenge_method || "S256").toUpperCase();
    if (method === "S256") {
      const computed = crypto.createHash("sha256").update(params.codeVerifier).digest("base64url");
      if (computed !== codeRow.code_challenge) {
        throw new Error("invalid_grant: PKCE code_verifier verification failed");
      }
    } else if (method === "PLAIN") {
      if (params.codeVerifier !== codeRow.code_challenge) {
        throw new Error("invalid_grant: PKCE code_verifier verification failed");
      }
    }
  }

  // Mark code as used
  codeRow.used = true;
  if (codeRow.id) {
    try {
      await supabase.from("oauth_codes").update({ used: true }).eq("id", codeRow.id);
    } catch {}
  } else {
    memCodes.set(params.code, codeRow);
  }

  // 3. Issue access token (1 hour) and refresh token (30 days)
  const accessToken = generateToken("atk_");
  const refreshToken = generateToken("rtk_");
  const expiresIn = 3600; // 1 hour
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const tokenRecord: OAuthTokenRecord = {
    id: crypto.randomUUID(),
    access_token: accessToken,
    refresh_token: refreshToken,
    client_id: params.clientId,
    user_id: codeRow.user_id,
    scope: codeRow.scope,
    expires_at: expiresAt,
    revoked: false,
  };

  try {
    const { error } = await supabase.from("oauth_tokens").insert({
      access_token: accessToken,
      refresh_token: refreshToken,
      client_id: params.clientId,
      user_id: codeRow.user_id,
      scope: codeRow.scope,
      expires_at: expiresAt,
    });
    if (error && isMissingTableError(error)) {
      memTokens.set(accessToken, tokenRecord);
      memTokens.set(refreshToken, tokenRecord);
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      memTokens.set(accessToken, tokenRecord);
      memTokens.set(refreshToken, tokenRecord);
    } else {
      throw e;
    }
  }

  // Also cache in memory for instant lookups
  memTokens.set(accessToken, tokenRecord);
  memTokens.set(refreshToken, tokenRecord);

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: codeRow.scope,
  };
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}> {
  const supabase = getServiceSupabase();

  // 1. Verify client credentials
  const client = await getClient(params.clientId);
  if (!client || client.client_secret !== params.clientSecret) {
    throw new Error("invalid_client: Invalid client credentials");
  }

  // 2. Fetch existing token record
  let tokenRow: OAuthTokenRecord | null = null;
  try {
    const { data, error } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("refresh_token", params.refreshToken)
      .eq("client_id", params.clientId)
      .maybeSingle();

    if (error && isMissingTableError(error)) {
      tokenRow = memTokens.get(params.refreshToken) || null;
    } else {
      tokenRow = data || memTokens.get(params.refreshToken) || null;
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      tokenRow = memTokens.get(params.refreshToken) || null;
    } else {
      throw e;
    }
  }

  if (!tokenRow || tokenRow.revoked) {
    throw new Error("invalid_grant: Invalid or revoked refresh token");
  }

  // Revoke old refresh token
  tokenRow.revoked = true;
  memTokens.set(params.refreshToken, tokenRow);
  if (tokenRow.access_token) {
    memTokens.set(tokenRow.access_token, tokenRow);
  }
  if (tokenRow.id) {
    try {
      await supabase.from("oauth_tokens").update({ revoked: true }).eq("id", tokenRow.id);
    } catch {}
  }

  // Issue fresh token pair
  const newAccessToken = generateToken("atk_");
  const newRefreshToken = generateToken("rtk_");
  const expiresIn = 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const newTokenRecord: OAuthTokenRecord = {
    id: crypto.randomUUID(),
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    client_id: params.clientId,
    user_id: tokenRow.user_id,
    scope: tokenRow.scope,
    expires_at: expiresAt,
    revoked: false,
  };

  try {
    await supabase.from("oauth_tokens").insert({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      client_id: params.clientId,
      user_id: tokenRow.user_id,
      scope: tokenRow.scope,
      expires_at: expiresAt,
    });
  } catch {}

  memTokens.set(newAccessToken, newTokenRecord);
  memTokens.set(newRefreshToken, newTokenRecord);

  return {
    access_token: newAccessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: newRefreshToken,
    scope: tokenRow.scope,
  };
}

export async function verifyAccessToken(
  token: string,
  requiredScope?: string,
): Promise<{ valid: boolean; scope?: string; client_id?: string; error?: string }> {
  const supabase = getServiceSupabase();
  let data: OAuthTokenRecord | null = null;

  try {
    const { data: dbData, error } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("access_token", token)
      .eq("revoked", false)
      .maybeSingle();

    if (error && isMissingTableError(error)) {
      data = memTokens.get(token) || null;
    } else {
      data = dbData || memTokens.get(token) || null;
    }
  } catch (e) {
    if (isMissingTableError(e)) {
      data = memTokens.get(token) || null;
    } else {
      throw e;
    }
  }

  if (!data || data.revoked) {
    return { valid: false, error: "Invalid token" };
  }

  if (new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "Token expired" };
  }

  if (requiredScope) {
    const grantedScopes = (data.scope || "").split(/\s+/);
    if (!grantedScopes.includes(requiredScope) && !grantedScopes.includes("*")) {
      return { valid: false, error: `Insufficient scope. Requires '${requiredScope}'` };
    }
  }

  return { valid: true, scope: data.scope, client_id: data.client_id };
}

export async function issueApiKey(name: string): Promise<{ id: string; key: string; name: string; created_at: string }> {
  const supabase = getServiceSupabase();
  const rawKey = generateToken("dcf_live_");
  const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString();
  const cleanName = name.trim() || "API Key";
  const record: OAuthTokenRecord = {
    id: crypto.randomUUID(),
    access_token: rawKey,
    refresh_token: generateToken("dcf_ref_"),
    client_id: `key:${cleanName}`,
    user_id: "frontend_admin",
    scope: "finance:read webhooks:write *",
    expires_at: expiresAt,
    revoked: false,
  };

  try {
    const { data, error } = await supabase
      .from("oauth_tokens")
      .insert({
        access_token: rawKey,
        refresh_token: record.refresh_token,
        client_id: record.client_id,
        user_id: record.user_id,
        scope: record.scope,
        expires_at: record.expires_at,
        revoked: false,
      })
      .select()
      .single();

    if (error && isMissingTableError(error)) {
      memTokens.set(rawKey, record);
      return { id: record.id, key: rawKey, name: cleanName, created_at: new Date().toISOString() };
    }
    if (error) throw new Error(error.message);

    memTokens.set(rawKey, data as OAuthTokenRecord);
    return {
      id: (data as { id: string }).id,
      key: rawKey,
      name: cleanName,
      created_at: (data as { created_at?: string }).created_at || new Date().toISOString(),
    };
  } catch (e) {
    if (isMissingTableError(e)) {
      memTokens.set(rawKey, record);
      return { id: record.id, key: rawKey, name: cleanName, created_at: new Date().toISOString() };
    }
    throw e;
  }
}

export async function listApiKeys(): Promise<
  Array<{
    id: string;
    name: string;
    maskedKey: string;
    created_at: string;
    revoked: boolean;
  }>
> {
  const supabase = getServiceSupabase();
  const memList = Array.from(memTokens.values())
    .filter((t) => t.access_token.startsWith("dcf_live_"))
    .map((t) => ({
      id: t.id,
      name: t.client_id.replace(/^key:/, "") || "API Key",
      maskedKey: `${t.access_token.slice(0, 12)}...${t.access_token.slice(-4)}`,
      created_at: new Date().toISOString(),
      revoked: t.revoked,
    }));

  try {
    const { data, error } = await supabase
      .from("oauth_tokens")
      .select("id, access_token, client_id, created_at, revoked")
      .like("access_token", "dcf_live_%")
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return memList;
      throw new Error(error.message);
    }

    const dbList = (data || []).map((t) => ({
      id: t.id,
      name: (t.client_id || "").replace(/^key:/, "") || "API Key",
      maskedKey: `${t.access_token.slice(0, 12)}...${t.access_token.slice(-4)}`,
      created_at: t.created_at,
      revoked: t.revoked,
    }));

    if (dbList.length > 0) return dbList;
    return memList;
  } catch (e) {
    if (isMissingTableError(e)) return memList;
    throw e;
  }
}

export async function revokeApiKey(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  for (const [k, v] of memTokens.entries()) {
    if (v.id === id) {
      v.revoked = true;
      memTokens.set(k, v);
    }
  }
  try {
    await supabase.from("oauth_tokens").update({ revoked: true }).eq("id", id);
  } catch (e) {
    if (!isMissingTableError(e)) throw e;
  }
}
