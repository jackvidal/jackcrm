import type { AuthConfig } from "convex/server";

// Convex Auth users and a separate server-only identity for signed webhooks.
export default {
  providers: [
    { domain: process.env.CONVEX_SITE_URL!, applicationID: "convex" },
    { type: "customJwt", issuer: "https://jackcrm.internal", applicationID: "jackcrm", algorithm: "RS256", jwks: process.env.CRM_AUTH_JWKS! },
  ],
} satisfies AuthConfig;
