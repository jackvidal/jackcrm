import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { appendFileSync, chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const deployment = process.argv[2];
if (!deployment || !/^[a-z0-9-]+$/.test(deployment)) throw new Error("Usage: node scripts/configure-convex-auth.mjs <deployment-name>");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
let pem = process.env.CRM_AUTH_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!pem) {
  pem = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
  appendFileSync(".env.local", `\nCRM_AUTH_PRIVATE_KEY=${JSON.stringify(pem)}\n`);
  chmodSync(".env.local", 0o600);
}
const jwk = { ...createPublicKey(pem).export({ format: "jwk" }), kid: "jackcrm-1", alg: "RS256", use: "sig" };
const jwks = `data:text/plain;charset=utf-8;base64,${Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64")}`;
const result = spawnSync("npx", ["convex", "env", "set", "--deployment", deployment, "CRM_AUTH_JWKS"], { encoding: "utf8", input: jwks });
if (result.status !== 0) throw new Error(result.stderr || "Could not configure the public key");
console.log(`Configured the public verification key on ${deployment}. Private key is in .env.local only.`);
