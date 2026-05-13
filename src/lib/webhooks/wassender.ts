import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a Wassender webhook signature.
 * Wassender sends `X-Webhook-Signature` (or similar) as an HMAC-SHA256 of the raw
 * request body using the configured webhook secret.
 *
 * If no secret is configured we accept the request (useful for local testing)
 * but log a warning. In production, always set WASSENDER_WEBHOOK_SECRET.
 */
export function verifyWassenderSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(computed, "utf-8");
  const b = Buffer.from(signature.replace(/^sha256=/, "").trim(), "utf-8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
