import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { importPKCS8, SignJWT } from "jose";

export async function convexClient(service = false) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("Convex URL is not configured");
  const client = new ConvexHttpClient(url);
  if (!service) {
    const token = await convexAuthNextjsToken();
    if (!token) throw new Error("Unauthorized");
    client.setAuth(token);
    return client;
  }
  // Only verified webhook handlers use the service identity.
  const pem = process.env.CRM_AUTH_PRIVATE_KEY;
  if (!pem) throw new Error("Webhook signing key is not configured");
  const key = await importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
  const token = await new SignJWT({ role: "service" })
    .setProtectedHeader({ alg: "RS256", kid: "jackcrm-1", typ: "JWT" })
    .setIssuer("https://jackcrm.internal").setAudience("jackcrm")
    .setSubject("jackcrm-service").setIssuedAt().setExpirationTime("60s").sign(key);
  client.setAuth(token);
  return client;
}
