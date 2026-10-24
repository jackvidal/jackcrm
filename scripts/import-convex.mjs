import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const [snapshotArg, deployment, mode] = process.argv.slice(2);
if (!snapshotArg || !deployment || !/^[a-z0-9-]+$/.test(deployment) || (mode && mode !== "--verify-only")) throw new Error("Usage: node scripts/import-convex.mjs <snapshot-directory> <deployment-name> [--verify-only]");
const snapshot = resolve(snapshotArg);
const manifest = JSON.parse(readFileSync(join(snapshot, "manifest.json"), "utf8"));
if (manifest.version !== 1) throw new Error("Unsupported snapshot format");
const tokenName = `jackcrm-migration-${Date.now()}`;
const tokenResult = spawnSync("npx", ["convex", "deployment", "token", "create", tokenName, "--deployment", deployment], { encoding: "utf8" });
if (tokenResult.status !== 0) throw new Error("Could not create a temporary deployment-scoped migration key");
const deployKey = tokenResult.stdout.trim();
if (!deployKey.startsWith(`dev:${deployment}|`) && !deployKey.startsWith(`prod:${deployment}|`)) throw new Error("Unexpected deploy key scope");
const client = new ConvexHttpClient(`https://${deployment}.convex.cloud`, { logger: false });
// Admin API is restricted to this offline migration utility, never app code.
client.setAdminAuth(deployKey);
async function run(name, args) {
  try {
    const reference = makeFunctionReference(name);
    return name.endsWith("importBatch") ? await client.mutation(reference, args) : await client.query(reference, args);
  } catch {
    throw new Error(`${name} failed on ${deployment}. Review deployment logs; snapshot values were not printed.`);
  }
}

try {
  console.log(`Target: ${deployment}; source snapshot: ${manifest.snapshotAt}`);
  const report = { target: deployment, source: manifest.snapshotAt, verifiedAt: null, tables: {} };
  for (const [table, metadata] of Object.entries(manifest.tables)) {
    const bytes = readFileSync(join(snapshot, `${table}.jsonl`));
    if (createHash("sha256").update(bytes).digest("hex") !== metadata.sha256) throw new Error(`Checksum mismatch: ${table}`);
    const rows = bytes.toString("utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
    if (rows.length !== metadata.count) throw new Error(`Count mismatch: ${table}`);
    for (let offset = 0; offset < rows.length; offset += 50) {
      const args = { table, rows: rows.slice(offset, offset + 50) };
      if (mode !== "--verify-only") await run("migration:importBatch", args);
      await run("migration:verifyBatch", args);
    }
    let cursor = null, actualCount = 0;
    do {
      const result = await run("migration:inventoryPage", { table, paginationOpts: { cursor, numItems: 100 } });
      actualCount += result.count;
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor !== null);
    if (actualCount !== rows.length) throw new Error(`Target contains extra records in ${table}: expected ${rows.length}, found ${actualCount}`);
    report.tables[table] = { expected: rows.length, verified: rows.length, actual: actualCount };
    console.log(`${table}: ${rows.length} rows verified exactly`);
  }
  report.verifiedAt = new Date().toISOString();
  writeFileSync(join(snapshot, `verification-${deployment}.json`), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log("All rows and table counts verified. This does not switch the running application.");
} finally {
  const revoked = spawnSync("npx", ["convex", "deployment", "token", "delete", tokenName, "--deployment", deployment], { encoding: "utf8" });
  if (revoked.status !== 0) console.error(`Revoke the temporary token ${tokenName} in the Convex dashboard.`);
}
