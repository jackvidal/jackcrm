import type { MutationCtx } from "../_generated/server";
export async function deleteCallAudio(ctx: MutationCtx, callId: string) {
  const file = await ctx.db.query("audioFiles").withIndex("by_call", (q) => q.eq("callId", callId)).unique();
  if (file) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
  }
}
