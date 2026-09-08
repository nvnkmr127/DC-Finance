import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DeliveryResult = {
  webhook_id: string;
  url: string;
  event: string;
  status_code: number | null;
  response_body: string | null;
  execution_time_ms: number;
  success: boolean;
  error: string | null;
};

export function signPayload(secret: string, timestamp: number, payloadString: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payloadString}`)
    .digest("hex");
}

export async function executeWebhookDelivery(
  webhook: { id: string; url: string; secret: string },
  event: string,
  data: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<DeliveryResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const fullPayload = {
    id: `evt_${crypto.randomUUID()}`,
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const payloadString = JSON.stringify(fullPayload);
  const signature = signPayload(webhook.secret, timestamp, payloadString);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;
  let errorMsg: string | null = null;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "DC-Finance-Webhook/1.0",
        "X-Webhook-Id": webhook.id,
        "X-Webhook-Event": event,
        "X-Webhook-Timestamp": String(timestamp),
        "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
      },
      body: payloadString,
      signal: controller.signal,
    });

    statusCode = res.status;
    success = res.ok;
    const text = await res.text().catch(() => "");
    // Truncate response text to 4000 characters to keep database lean
    responseBody = text ? text.slice(0, 4000) : null;
    if (!res.ok) {
      errorMsg = `Endpoint returned HTTP status ${res.status}`;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        errorMsg = "Delivery timed out after 10 seconds";
      } else {
        errorMsg = err.message;
      }
    } else {
      errorMsg = "Unknown network error occurred";
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const executionTimeMs = Date.now() - startTime;

  // Record delivery entry in database (non-blocking if table not yet migrated)
  try {
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      event,
      url: webhook.url,
      payload: fullPayload,
      status_code: statusCode,
      response_body: responseBody,
      execution_time_ms: executionTimeMs,
      success,
      error: errorMsg,
    });
  } catch (err) {
    console.warn("Could not record delivery log (run migrations in Supabase SQL editor):", err);
  }

  return {
    webhook_id: webhook.id,
    url: webhook.url,
    event,
    status_code: statusCode,
    response_body: responseBody,
    execution_time_ms: executionTimeMs,
    success,
    error: errorMsg,
  };
}
