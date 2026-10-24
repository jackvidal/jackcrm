import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation, type QueryCtx } from "./_generated/server";
import { principal } from "./lib/auth";
import { byId, write } from "./lib/store";
import { emailKey, phoneKey, importLeadSchema, importFingerprint, IMPORT_BATCH, type ImportLead, type ImportOutcome } from "../src/lib/lead-import";

const rowsValidator = v.array(v.object({ row: v.number(), data: v.any() }));
async function owner(ctx: QueryCtx) {
  const user = await principal(ctx);
  if (user.service || !await byId(ctx, "profile", user.userId)) throw new ConvexError("Forbidden");
  if (await ctx.db.query("lead").withIndex("by_owner_contactKeysVersion", (q) => q.eq("ownerId", user.userId).eq("contactKeysVersion", undefined)).first()) throw new ConvexError("המערכת מכינה את בדיקת הכפילויות. נסו שוב בעוד רגע.");
  return user;
}
function checkBatch(rows: { row: number }[]) {
  if (!rows.length || rows.length > IMPORT_BATCH || rows.some((row) => !Number.isSafeInteger(row.row) || row.row < 2 || row.row > 1000000) || new Set(rows.map((row) => row.row)).size !== rows.length) throw new ConvexError("Invalid import batch");
}
async function contactMatch(ctx: QueryCtx, ownerId: string, data: ImportLead): Promise<"duplicate" | "conflict" | null> {
  const e = emailKey(data.email), p = phoneKey(data.phone);
  const emails = e ? await ctx.db.query("lead").withIndex("by_owner_emailKey", (q) => q.eq("ownerId", ownerId).eq("emailKey", e)).take(2) : [];
  const phones = p ? await ctx.db.query("lead").withIndex("by_owner_phoneKey", (q) => q.eq("ownerId", ownerId).eq("phoneKey", p)).take(2) : [];
  const ids = new Set([...emails, ...phones].map((lead) => lead.id));
  return ids.size > 1 ? "conflict" : ids.size ? "duplicate" : null;
}
const reason = { duplicate: "ליד עם אותו אימייל או טלפון כבר קיים — לא בוצע שינוי", conflict: "פרטי הקשר תואמים ליותר מליד אחד. יש לבדוק ידנית" };

export const preview = query({ args: { rows: rowsValidator }, handler: async (ctx, { rows }): Promise<ImportOutcome[]> => {
  checkBatch(rows); const user = await owner(ctx); const results: ImportOutcome[] = [];
  for (const row of rows) {
    const parsed = importLeadSchema.safeParse(row.data);
    if (!parsed.success) { results.push({ row: row.row, status: "invalid", reason: parsed.error.issues[0].message }); continue; }
    const fingerprint = await importFingerprint(parsed.data);
    const previous = await ctx.db.query("leadImportRows").withIndex("by_owner_fingerprint", (q) => q.eq("ownerId", user.userId).eq("fingerprint", fingerprint)).unique();
    if (previous && await byId(ctx, "lead", previous.leadId)) { results.push({ row: row.row, status: "duplicate", reason: "שורה זהה כבר יובאה בעבר" }); continue; }
    const match = await contactMatch(ctx, user.userId, parsed.data);
    results.push({ row: row.row, status: match ?? "ready", reason: match ? reason[match] : "מוכן לייבוא" });
  }
  return results;
} });

export const commit = mutation({ args: { requestId: v.string(), rows: rowsValidator }, handler: async (ctx, { requestId, rows }): Promise<ImportOutcome[]> => {
  checkBatch(rows);
  if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new ConvexError("Invalid request ID");
  const user = await owner(ctx); const results: ImportOutcome[] = [];
  for (const row of rows) {
    const parsed = importLeadSchema.safeParse(row.data);
    if (!parsed.success) { results.push({ row: row.row, status: "invalid", reason: parsed.error.issues[0].message }); continue; }
    const data = parsed.data, fingerprint = await importFingerprint(data);
    const previous = await ctx.db.query("leadImportRows").withIndex("by_owner_fingerprint", (q) => q.eq("ownerId", user.userId).eq("fingerprint", fingerprint)).unique();
    if (previous && await byId(ctx, "lead", previous.leadId)) {
      const replay = previous.requestId === requestId && previous.row === row.row;
      results.push({ row: row.row, status: replay ? "created" : "duplicate", reason: replay ? "יובא בהצלחה" : "שורה זהה כבר יובאה בעבר" }); continue;
    }
    const match = await contactMatch(ctx, user.userId, data);
    if (match) { results.push({ row: row.row, status: match, reason: reason[match] }); continue; }
    const lead = await write(ctx, user, { table: "lead", operation: "create", data: { ...data, ownerId: user.userId } });
    const receipt = { ownerId: user.userId, fingerprint, leadId: lead.id as string, requestId, row: row.row, createdAt: Date.now() };
    if (previous) await ctx.db.replace(previous._id, receipt); else await ctx.db.insert("leadImportRows", receipt);
    results.push({ row: row.row, status: "created", reason: "יובא בהצלחה" });
  }
  return results;
} });

// CLI-only, bounded and repeatable. Only derived search keys are backfilled.
export const backfillContactKeys = internalMutation({ args: {}, handler: async (ctx) => {
  const rows = await ctx.db.query("lead").withIndex("by_contactKeysVersion", (q) => q.eq("contactKeysVersion", undefined)).take(100);
  for (const row of rows) await ctx.db.patch(row._id, { emailKey: emailKey(row.email), phoneKey: phoneKey(row.phone), contactKeysVersion: 1 });
  return { processed: rows.length, done: rows.length < 100 };
} });
