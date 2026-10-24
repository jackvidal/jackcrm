import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation, httpAction, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { principal } from "./lib/auth";
import { brandingSchema, DEFAULT_BRANDING, LOGO_MAX_BYTES, logoMime } from "../src/lib/branding";

async function owner(ctx: Pick<QueryCtx, "auth">) {
  const user = await principal(ctx);
  if (user.service) throw new ConvexError("Forbidden");
  return user.userId;
}
const find = (ctx: QueryCtx, ownerId: string) => ctx.db.query("branding").withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId)).unique();

export const current = query({ args: {}, handler: async (ctx) => {
  const row = await find(ctx, await owner(ctx));
  return { ...(row ? brandingSchema.parse(row.preferences) : DEFAULT_BRANDING), logoUrl: row?.logoStorageId ? await ctx.storage.getUrl(row.logoStorageId) : null };
} });
export const save = mutation({ args: { preferences: v.any() }, handler: async (ctx, args) => {
  const ownerId = await owner(ctx);
  const parsed = brandingSchema.safeParse(args.preferences);
  if (!parsed.success) throw new ConvexError("Invalid branding preferences");
  const row = await find(ctx, ownerId);
  const data = { preferences: parsed.data, updatedAt: Date.now() };
  if (row) await ctx.db.patch(row._id, data);
  else await ctx.db.insert("branding", { ownerId, ...data });
} });
export const removeLogo = mutation({ args: {}, handler: async (ctx) => {
  const row = await find(ctx, await owner(ctx));
  if (row?.logoStorageId) { await ctx.storage.delete(row.logoStorageId); await ctx.db.patch(row._id, { logoStorageId: undefined, updatedAt: Date.now() }); }
} });
// Only the authenticated HTTP upload can attach its newly stored file.
export const attachLogo = internalMutation({ args: { ownerId: v.string(), storageId: v.id("_storage") }, handler: async (ctx, { ownerId, storageId }) => {
  const row = await find(ctx, ownerId);
  if (row) {
    if (row.logoStorageId && row.logoStorageId !== storageId) await ctx.storage.delete(row.logoStorageId);
    await ctx.db.patch(row._id, { logoStorageId: storageId, updatedAt: Date.now() });
  } else await ctx.db.insert("branding", { ownerId, preferences: DEFAULT_BRANDING, logoStorageId: storageId, updatedAt: Date.now() });
} });

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
export const preflight = httpAction(async () => new Response(null, { status: 204, headers: cors }));
export const uploadLogo = httpAction(async (ctx, request) => {
  let ownerId: string;
  try { ownerId = await owner(ctx); } catch { return new Response("Unauthorized", { status: 401, headers: cors }); }
  if (Number(request.headers.get("content-length")) > LOGO_MAX_BYTES) return new Response("File too large", { status: 413, headers: cors });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing file", { status: 400, headers: cors });
  const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > LOGO_MAX_BYTES) { await reader.cancel(); return new Response("File too large", { status: 413, headers: cors }); }
    chunks.push(value);
  }
  const blob = new Blob(chunks);
  const mime = logoMime(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  if (!mime) return new Response("Use PNG, JPEG or WebP", { status: 415, headers: cors });
  const storageId = await ctx.storage.store(new Blob(chunks, { type: mime }));
  try { await ctx.runMutation(internal.branding.attachLogo, { ownerId, storageId }); }
  catch { await ctx.storage.delete(storageId); return new Response("Upload failed", { status: 409, headers: cors }); }
  return Response.json({ ok: true }, { headers: cors });
});
