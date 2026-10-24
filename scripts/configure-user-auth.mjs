import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [deployment, siteUrl] = process.argv.slice(2);
if (!deployment || !/^[a-z0-9-]+$/.test(deployment) || !siteUrl) throw new Error("Usage: node scripts/configure-user-auth.mjs <deployment> <site-url>");
new URL(siteUrl);
const path = `.env.auth-${deployment}.local`;
let privateKey;
if (existsSync(path)) privateKey = JSON.parse(readFileSync(path, "utf8")).privateKey;
else {
  privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" });
  writeFileSync(path, JSON.stringify({ privateKey }), { mode: 0o600 });
}
const jwk = { ...createPublicKey(privateKey).export({ format: "jwk" }), use: "sig", alg: "RS256" };
for (const [name, value] of Object.entries({ JWT_PRIVATE_KEY: privateKey, JWKS: JSON.stringify({ keys: [jwk] }), SITE_URL: siteUrl })) {
  const result = spawnSync("npx", ["convex", "env", "set", "--deployment", deployment, name], { encoding: "utf8", input: value });
  if (result.status !== 0) throw new Error(`Could not configure ${name} on ${deployment}`);
}
console.log(`Configured password authentication on ${deployment} for ${siteUrl}. No keys printed.`);
