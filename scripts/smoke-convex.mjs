import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { importPKCS8, SignJWT } from "jose";
process.loadEnvFile(".env.local");
const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const key = await importPKCS8(process.env.CRM_AUTH_PRIVATE_KEY.replace(/\\n/g, "\n"), "RS256");
const reference = makeFunctionReference("crm:page");
const args = { table: "profile", paginationOpts: { cursor: null, numItems: 1 } };
const anonymous = new ConvexHttpClient(url, { logger: false });
let blocked = false;
try { await anonymous.query(reference, args); } catch { blocked = true; }
if (!blocked) throw new Error("Anonymous access was allowed");
const token = await new SignJWT({ role: "service" }).setProtectedHeader({ alg: "RS256", kid: "jackcrm-1", typ: "JWT" }).setIssuer("https://jackcrm.internal").setAudience("jackcrm").setSubject("jackcrm-service").setIssuedAt().setExpirationTime("60s").sign(key);
const client = new ConvexHttpClient(url, { logger: false });
client.setAuth(token);
await client.query(reference, args);
console.log(`Verified JWT authentication and anonymous rejection on ${url}. Read-only check; no data modified.`);
