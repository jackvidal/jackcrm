import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync, appendFileSync, chmodSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const sourceEnv = process.argv[2];
const destination = process.argv[3];
if (!sourceEnv || !destination) throw new Error("Usage: node scripts/export-postgres.mjs <source.env.local> <new-snapshot-directory>");
process.loadEnvFile(resolve(sourceEnv));
if (!process.env.DATABASE_URL) throw new Error("Source DATABASE_URL is missing");
const output = resolve(destination);
mkdirSync(output, { mode: 0o700 }); // Refuse to overwrite an existing snapshot.
chmodSync(output, 0o700);
const tables = ["profile", "lead", "leadNote", "meeting", "task", "call", "websiteAnalysis", "whatsappMessage", "webhookEvent"];
const client = new PrismaClient();
const convert = (value) => value instanceof Date ? value.getTime() : Array.isArray(value) ? value.map(convert) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, convert(v)])) : value;
const manifest = { version: 1, snapshotAt: new Date().toISOString(), sourceHost: new URL(process.env.DATABASE_URL).hostname, source: "Postgres read-only repeatable-read transaction", storage: "Supabase call-audio objects remain in place; references are included", tables: {} };
try {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    for (const table of tables) {
      const path = join(output, `${table}.jsonl`);
      writeFileSync(path, "", { mode: 0o600 });
      const hash = createHash("sha256");
      let count = 0, lastId;
      while (true) {
        const rows = await tx[table].findMany({ take: 100, orderBy: { id: "asc" }, ...(lastId ? { cursor: { id: lastId }, skip: 1 } : {}) });
        if (!rows.length) break;
        const chunk = rows.map((row) => JSON.stringify(convert(row))).join("\n") + "\n";
        appendFileSync(path, chunk);
        hash.update(chunk);
        count += rows.length;
        lastId = rows.at(-1).id;
      }
      manifest.tables[table] = { count, sha256: hash.digest("hex") };
      console.log(`${table}: ${count} rows exported`);
    }
  }, { isolationLevel: "RepeatableRead", timeout: 300000, maxWait: 30000 });
  writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(`Snapshot complete: ${output}`);
} finally { await client.$disconnect(); }
