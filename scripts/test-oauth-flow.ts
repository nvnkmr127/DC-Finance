import assert from "node:assert";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import {
  registerClient,
  getClient,
  createAuthorizationCode,
  exchangeCodeForTokens,
  refreshAccessToken,
  verifyAccessToken,
} from "../src/lib/oauth-server";

async function testOAuthFlow() {
  console.log("Starting OAuth 2.0 flow verification...");

  // 1. Register a test client
  const testClientId = `test_client_${Date.now()}`;
  const testClientSecret = `test_sec_${Date.now()}`;
  const redirectUri = "https://chatgpt.com/aip/oauth/callback";

  const client = await registerClient({
    name: "ChatGPT Test Suite",
    clientId: testClientId,
    clientSecret: testClientSecret,
    redirectUris: [redirectUri],
  });

  assert(client.client_id === testClientId, "Client ID should match");
  console.log("✓ Client registered successfully");

  // 2. Fetch registered client
  const fetched = await getClient(testClientId);
  assert(fetched !== null, "Should fetch registered client");
  assert.strictEqual(fetched?.client_secret, testClientSecret);
  console.log("✓ Client lookup verified");

  // 3. Create an authorization code
  const code = await createAuthorizationCode({
    clientId: testClientId,
    redirectUri,
    scope: "finance:read webhooks:write",
  });
  assert(code.startsWith("code_"), "Authorization code should start with code_");
  console.log("✓ Authorization code generated");

  // 4. Exchange code for access & refresh tokens
  const tokenPair = await exchangeCodeForTokens({
    code,
    clientId: testClientId,
    clientSecret: testClientSecret,
    redirectUri,
  });

  assert(tokenPair.access_token.startsWith("atk_"), "Access token should start with atk_");
  assert(tokenPair.refresh_token.startsWith("rtk_"), "Refresh token should start with rtk_");
  assert.strictEqual(tokenPair.token_type, "Bearer");
  assert.strictEqual(tokenPair.expires_in, 3600);
  console.log("✓ Code exchanged for Bearer token pair");

  // 5. Verify single-use code protection (cannot use code twice)
  let reusedCodeFailed = false;
  try {
    await exchangeCodeForTokens({
      code,
      clientId: testClientId,
      clientSecret: testClientSecret,
      redirectUri,
    });
  } catch (err: unknown) {
    reusedCodeFailed = true;
  }
  assert(reusedCodeFailed, "Reusing an authorization code must throw an error");
  console.log("✓ Code reuse prevention verified");

  // 6. Verify access token with scope checks
  const validRead = await verifyAccessToken(tokenPair.access_token, "finance:read");
  assert(validRead.valid, "Token should be valid for finance:read");

  const validWrite = await verifyAccessToken(tokenPair.access_token, "webhooks:write");
  assert(validWrite.valid, "Token should be valid for webhooks:write");

  const invalidScope = await verifyAccessToken(tokenPair.access_token, "admin:superpower");
  assert(!invalidScope.valid, "Token should fail for ungranted scope");
  console.log("✓ Scoped access token verification passed");

  // 7. Refresh token rotation
  const refreshed = await refreshAccessToken({
    refreshToken: tokenPair.refresh_token,
    clientId: testClientId,
    clientSecret: testClientSecret,
  });

  assert(refreshed.access_token.startsWith("atk_"));
  assert.notStrictEqual(refreshed.access_token, tokenPair.access_token);
  console.log("✓ Refresh token rotated and fresh access token issued");

  // 8. Old refresh token should now be revoked
  let oldRefreshFailed = false;
  try {
    await refreshAccessToken({
      refreshToken: tokenPair.refresh_token,
      clientId: testClientId,
      clientSecret: testClientSecret,
    });
  } catch {
    oldRefreshFailed = true;
  }
  assert(oldRefreshFailed, "Revoked refresh token should be rejected");
  console.log("✓ Revocation protection verified");

  console.log("\n All OAuth 2.0 Authorization Server checks passed successfully!");
}

testOAuthFlow().catch((err) => {
  console.error("OAuth test failed:", err);
  process.exit(1);
});
