import assert from "node:assert";
import crypto from "node:crypto";
import { signPayload } from "../src/lib/webhooks-server";
import { generateWebhookSecret } from "../src/lib/webhooks";

function testWebhookSigning() {
  const secret = generateWebhookSecret();
  assert(secret.startsWith("whsec_"), "Secret should start with whsec_ prefix");
  assert(secret.length >= 38, "Secret should be sufficiently long");

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: "evt_123",
    event: "payment.created",
    data: { amount: 50000, client: "Acme Corp" },
  });

  const signature = signPayload(secret, timestamp, payload);
  assert(typeof signature === "string" && signature.length === 64, "Signature should be 64-char hex string");

  // Verify recipient side
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  assert.strictEqual(signature, expected, "Computed signature must match expected HMAC-SHA256");

  // Tamper check
  const tamperedPayload = JSON.stringify({
    id: "evt_123",
    event: "payment.created",
    data: { amount: 999999, client: "Acme Corp" },
  });
  const tamperedSig = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${tamperedPayload}`)
    .digest("hex");

  assert.notStrictEqual(signature, tamperedSig, "Tampered payload must fail signature check");

  console.log("✓ Webhook HMAC-SHA256 signing and verification self-check passed.");
}

testWebhookSigning();
