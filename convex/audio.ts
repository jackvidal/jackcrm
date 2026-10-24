import { v, ConvexError } from "convex/values";
import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { principal } from "./lib/auth";
import { byId, canAccess } from "./lib/store";

const MAX_BYTES = 25 * 1024 * 1024;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
export const preflight = httpAction(async () => new Response(null, { status: 204, headers: cors }));

export const authorizedCall = internalQuery({
  args: { callId: v.string(), userId: v.string() },
  handler: async (ctx, { callId, userId }) => {
    const call = await byId(ctx, "call", callId);
    if (!call || !await canAccess(ctx, { userId, service: false }, "call", call)) return null;
    const audio = await ctx.db.query("audioFiles").withIndex("by_call", (q) => q.eq("callId", callId)).unique();
    return { callId, audio };
  },
});
export const attach = internalMutation({
  args: { callId: v.string(), userId: v.string(), storageId: v.id("_storage"), filename: v.string() },
  handler: async (ctx, args) => {
    const call = await byId(ctx, "call", args.callId);
    if (!call || !await canAccess(ctx, { userId: args.userId, service: false }, "call", call)) throw new ConvexError("Not found");
    const previous = await ctx.db.query("audioFiles").withIndex("by_call", (q) => q.eq("callId", args.callId)).unique();
    if (previous) {
      await ctx.storage.delete(previous.storageId);
      await ctx.db.delete(previous._id);
    }
    await ctx.db.insert("audioFiles", { callId: args.callId, ownerId: args.userId, storageId: args.storageId, filename: args.filename, createdAt: Date.now() });
    await ctx.db.patch(call._id, { audioUrl: args.storageId, updatedAt: Date.now() });
  },
});
export const upload = httpAction(async (ctx, request) => {
  let user;
  try { user = await principal(ctx); } catch { return new Response("Unauthorized", { status: 401, headers: cors }); }
  const url = new URL(request.url);
  const callId = url.searchParams.get("callId") ?? "";
  const filename = url.searchParams.get("filename") ?? "";
  if (!/\.(mp3|wav|m4a|mp4|mpeg|mpga|webm|ogg|flac)$/i.test(filename) || filename.length > 255) return new Response("Invalid file", { status: 400, headers: cors });
  if (!await ctx.runQuery(internal.audio.authorizedCall, { callId, userId: user.userId })) return new Response("Not found", { status: 404, headers: cors });
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return new Response("File too large", { status: 413, headers: cors });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing file", { status: 400, headers: cors });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return new Response("File too large", { status: 413, headers: cors });
    }
    chunks.push(value);
  }
  if (!size) return new Response("Empty file", { status: 400, headers: cors });
  const storageId = await ctx.storage.store(new Blob(chunks, { type: request.headers.get("content-type") ?? "audio/mpeg" }));
  try {
    await ctx.runMutation(internal.audio.attach, { callId, userId: user.userId, storageId, filename });
  } catch {
    await ctx.storage.delete(storageId);
    return new Response("Upload could not be attached", { status: 409, headers: cors });
  }
  return Response.json({ ok: true }, { headers: cors });
});
export const download = httpAction(async (ctx, request) => {
  let user;
  try { user = await principal(ctx); } catch { return new Response("Unauthorized", { status: 401, headers: cors }); }
  const callId = new URL(request.url).searchParams.get("callId") ?? "";
  const result = await ctx.runQuery(internal.audio.authorizedCall, { callId, userId: user.userId });
  if (!result?.audio) return new Response("Not found", { status: 404, headers: cors });
  const blob = await ctx.storage.get(result.audio.storageId);
  if (!blob) return new Response("Not found", { status: 404, headers: cors });
  return new Response(blob, { headers: { ...cors, "Content-Type": blob.type, "Cache-Control": "private, no-store", "X-Audio-Filename": encodeURIComponent(result.audio.filename) } });
});
