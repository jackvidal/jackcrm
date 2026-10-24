import { deleteCallAudio } from "./audioFiles";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { defaults, fields, type Table } from "./models";
import { matches, type Row, type Where } from "./filters";
import type { Principal } from "./auth";
import { internal } from "../_generated/api";
import { EARLY_LEAD_STATUSES, isDateOnly } from "../../src/lib/leads";

// Dynamic access is confined to this module; schema.ts validates every stored
// document, and table names are validated at each public function boundary.
type Ctx = QueryCtx | MutationCtx;
export async function byId(ctx: Ctx, table: Table, id: string): Promise<Row | null> {
  return (ctx.db.query(table) as any).withIndex("by_legacy_id", (q: any) => q.eq("id", id)).unique();
}
export function clean(row: Row): Row {
  const { _id, _creationTime, ...data } = row;
  return data;
}
export async function canAccess(ctx: Ctx, user: Principal, table: Table, row: Row): Promise<boolean> {
  if (user.service) return true;
  if (table === "webhookEvent") return false;
  if (table === "profile") return row.id === user.userId;
  if (row.ownerId !== undefined && row.ownerId !== user.userId) return false;
  if (row.authorId !== undefined && row.authorId !== user.userId) return false;
  if (row.leadId) {
    const parent = await byId(ctx, "lead", row.leadId);
    return !!parent && parent.ownerId === user.userId;
  }
  return row.ownerId === user.userId;
}

export async function accessQuery(ctx: Ctx, user: Principal, table: Table, where: Where = {}) {
  // Use the narrowest available index. No user request can enumerate profiles,
  // webhook payloads, or another owner's records, even without a caller filter.
  const query: any = ctx.db.query(table);
  if (!user.service && table === "webhookEvent") throw new ConvexError("Forbidden");
  if (!user.service && table === "profile") return query.withIndex("by_legacy_id", (q: any) => q.eq("id", user.userId));
  if (typeof where.id === "string") return query.withIndex("by_legacy_id", (q: any) => q.eq("id", where.id));
  if (typeof where.leadId === "string") {
    const lead = await byId(ctx, "lead", where.leadId);
    if (!lead || !await canAccess(ctx, user, "lead", lead)) throw new ConvexError("Not found");
    return query.withIndex("by_leadId", (q: any) => q.eq("leadId", where.leadId));
  }
  if (table === "profile" && user.service) {
    for (const key of ["email", "calOrganizerEmail", "wassenderToken"]) {
      if (typeof where[key] === "string") return query.withIndex(`by_${key}`, (q: any) => q.eq(key, where[key]));
    }
  }
  if (table === "meeting" && typeof where.calEventId === "string") return query.withIndex("by_calEventId", (q: any) => q.eq("calEventId", where.calEventId));
  if (table === "whatsappMessage" && typeof where.externalId === "string") return query.withIndex("by_externalId", (q: any) => q.eq("externalId", where.externalId));
  if (table === "webhookEvent" && typeof where.source === "string" && typeof where.externalId === "string") return query.withIndex("by_source_externalId", (q: any) => q.eq("source", where.source).eq("externalId", where.externalId));
  const owner = user.service ? where.ownerId : user.userId;
  if (typeof owner === "string" && (fields[table] as readonly string[]).includes("ownerId")) {
    if (table === "lead") for (const key of ["email", "phone", "status"]) {
      if (typeof where[key] === "string") return query.withIndex(`by_owner_${key}`, (q: any) => q.eq("ownerId", owner).eq(key, where[key]));
    }
    return query.withIndex("by_ownerId", (q: any) => q.eq("ownerId", owner));
  }
  if (table === "leadNote" && !user.service) return query.withIndex("by_authorId", (q: any) => q.eq("authorId", user.userId));
  if (!user.service) throw new ConvexError("A lead filter is required");
  return query;
}
export async function findOne(ctx: Ctx, user: Principal, table: Table, where: Where): Promise<Row | null> {
  const rows: Row[] = await (await accessQuery(ctx, user, table, where)).take(100);
  for (const row of rows) if (matches(row, where) && await canAccess(ctx, user, table, row)) return row;
  return null;
}

function uuid() {
  // Convex's seeded Math.random is deterministic across transaction retries.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
async function validateParent(ctx: MutationCtx, user: Principal, table: Table, row: Row) {
  if (row.leadId) {
    const parent = await byId(ctx, "lead", row.leadId);
    if (!parent || !await canAccess(ctx, user, "lead", parent)) throw new ConvexError("Not found");
    if (row.ownerId && row.ownerId !== parent.ownerId) throw new ConvexError("Parent owner mismatch");
    if (row.authorId && row.authorId !== parent.ownerId) throw new ConvexError("Author owner mismatch");
  }
  if (table === "lead" && !await byId(ctx, "profile", row.ownerId)) throw new ConvexError("Profile not found");
  if (!await canAccess(ctx, user, table, row)) throw new ConvexError("Forbidden");
}
export async function unique(ctx: MutationCtx, table: Table, row: Row, existing?: Row | null) {
  const checks: [string, string[]][] = [["by_legacy_id", ["id"]]];
  if (table === "profile") checks.push(["by_email", ["email"]]);
  if (table === "meeting") checks.push(["by_calEventId", ["calEventId"]]);
  if (table === "whatsappMessage") checks.push(["by_externalId", ["externalId"]]);
  if (table === "webhookEvent") checks.push(["by_source_externalId", ["source", "externalId"]]);
  for (const [index, keys] of checks) {
    if (keys.some((key) => row[key] == null)) continue;
    const collision = await (ctx.db.query(table) as any).withIndex(index, (q: any) => keys.reduce((range, key) => range.eq(key, row[key]), q)).unique();
    if (collision && collision._id !== existing?._id) throw new ConvexError({ code: "CONFLICT", message: "Record already exists" });
  }
}
export type Write = { table: Table; operation: "create" | "update" | "delete" | "upsert" | "updateMany" | "deleteMany"; where?: Where; data?: Row; create?: Row };
export async function write(ctx: MutationCtx, user: Principal, command: Write): Promise<any> {
  const { table, operation, where = {}, data = {} } = command;
  if (!user.service && table === "webhookEvent") throw new ConvexError("Forbidden");
  const existing = operation === "create" ? null : await findOne(ctx, user, table, where);
  if (operation === "delete" || operation === "deleteMany") {
    if (!existing) {
      if (operation === "delete") throw new ConvexError("Not found");
      return { count: 0 };
    }
    // All current bulk updates/deletes target a unique UUID or external ID.
    if (!where.id && !where.externalId) throw new ConvexError("An ID is required");
    if (table === "profile") throw new ConvexError("Profile deletion is not supported");
    if (table === "call") await deleteCallAudio(ctx, existing.id);
    await ctx.db.delete(existing._id);
    if (table === "lead") await ctx.scheduler.runAfter(0, internal.crm.purgeLeadChildren, { leadId: existing.id });
    return operation === "deleteMany" ? { count: 1 } : clean(existing);
  }
  if (operation === "updateMany" && !where.id && !where.externalId) throw new ConvexError("An ID is required");
  if (!existing && (operation === "update" || operation === "updateMany")) {
    if (operation === "updateMany") return { count: 0 };
    throw new ConvexError("Not found");
  }
  const input = operation === "upsert" && !existing ? command.create ?? {} : data;
  for (const key of Object.keys(input)) {
    if (!(fields[table] as readonly string[]).includes(key)) throw new ConvexError(`Unknown ${table} field`);
    if (existing && ["id", "ownerId", "authorId", "leadId", "createdAt"].includes(key) && existing[key] !== input[key]) throw new ConvexError("Ownership and identity are immutable");
  }
  const now = Date.now();
  const row: Row = existing ? { ...clean(existing), ...input } : { ...defaults[table], id: uuid(), createdAt: now, ...input };
  if (table === "lead" && row.followUpDate != null && (typeof row.followUpDate !== "string" || !isDateOnly(row.followUpDate))) throw new ConvexError("Invalid follow-up date");
  if ((fields[table] as readonly string[]).includes("updatedAt")) row.updatedAt = now;
  await validateParent(ctx, user, table, row);
  await unique(ctx, table, row, existing);
  if (existing) await ctx.db.replace(existing._id, row as any);
  else await ctx.db.insert(table, row as any);

  // Meeting and pipeline changes commit as one Convex transaction.
  if (table === "meeting") {
    const lead = await byId(ctx, "lead", row.leadId);
    if (lead && ((!existing && row.status === "SCHEDULED" && EARLY_LEAD_STATUSES.includes(lead.status)) || (row.status === "COMPLETED" && [...EARLY_LEAD_STATUSES, "MEETING_SCHEDULED"].includes(lead.status)))) {
      await ctx.db.patch(lead._id, { status: row.status === "COMPLETED" ? "MEETING_COMPLETED" : "MEETING_SCHEDULED", updatedAt: now });
    }
  }
  return operation === "updateMany" ? { count: 1 } : row;
}
