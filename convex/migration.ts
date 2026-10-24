import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { tableValidator } from "./crm";
import { byId, clean, unique } from "./lib/store";
import { fields } from "./lib/models";
import { emailKey, phoneKey } from "../src/lib/lead-import";

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

// CLI/admin only. Insert-only: reruns skip identical rows and reject changes,
// so a stale snapshot cannot overwrite records edited after a cutover.
export const importBatch = internalMutation({
  args: { table: tableValidator, rows: v.array(v.any()) },
  handler: async (ctx, { table, rows }) => {
    if (rows.length > 50) throw new ConvexError("Migration batch limit is 50");
    let inserted = 0, skipped = 0;
    for (const row of rows) {
      if (Object.keys(row).some((key) => !(fields[table] as readonly string[]).includes(key))) throw new ConvexError("Unknown snapshot field");
      if (typeof row.id !== "string") throw new ConvexError("Snapshot row ID is required");
      const existing = await byId(ctx, table, row.id);
      if (existing) {
        if (canonical(clean(existing)) !== canonical(row)) throw new ConvexError(`Migration conflict in ${table}; target was changed`);
        skipped++;
        continue;
      }
      if (row.leadId) {
        const lead = await byId(ctx, "lead", row.leadId);
        if (!lead || (row.ownerId && row.ownerId !== lead.ownerId) || (row.authorId && row.authorId !== lead.ownerId)) throw new ConvexError("Invalid snapshot parent");
      }
      if (row.ownerId && !await byId(ctx, "profile", row.ownerId)) throw new ConvexError("Missing snapshot profile");
      await unique(ctx, table, row);
      await ctx.db.insert(table, table === "lead" ? { ...row, emailKey: emailKey(row.email), phoneKey: phoneKey(row.phone), contactKeysVersion: 1 } : row);
      inserted++;
    }
    return { inserted, skipped };
  },
});
export const verifyBatch = internalQuery({
  args: { table: tableValidator, rows: v.array(v.any()) },
  handler: async (ctx, { table, rows }) => {
    if (rows.length > 50) throw new ConvexError("Verification batch limit is 50");
    let verified = 0;
    for (const row of rows) {
      const existing = await byId(ctx, table, row.id);
      if (!existing || canonical(clean(existing)) !== canonical(row)) throw new ConvexError(`Verification failed in ${table}`);
      verified++;
    }
    return { verified };
  },
});
export const inventoryPage = internalQuery({
  args: { table: tableValidator, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await ctx.db.query(args.table).paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 100) });
    return { count: page.page.length, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
