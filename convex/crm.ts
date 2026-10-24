import { deleteCallAudio } from "./lib/audioFiles";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { principal } from "./lib/auth";
import { accessQuery, canAccess, clean, write } from "./lib/store";
import { matches } from "./lib/filters";

export const tableValidator = v.union(v.literal("profile"), v.literal("lead"), v.literal("leadNote"), v.literal("meeting"), v.literal("task"), v.literal("call"), v.literal("websiteAnalysis"), v.literal("whatsappMessage"), v.literal("webhookEvent"));
const commandValidator = v.object({ table: tableValidator, operation: v.union(v.literal("create"), v.literal("update"), v.literal("delete"), v.literal("upsert"), v.literal("updateMany"), v.literal("deleteMany")), where: v.optional(v.any()), data: v.optional(v.any()), create: v.optional(v.any()) });

export const page = query({
  args: { table: tableValidator, where: v.optional(v.any()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await principal(ctx);
    const result = await (await accessQuery(ctx, user, args.table, args.where)).paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, 100) });
    const rows = [];
    for (const row of result.page) if (matches(row, args.where) && await canAccess(ctx, user, args.table, row)) rows.push(clean(row));
    return { ...result, page: rows };
  },
});
export const commit = mutation({
  args: { commands: v.array(commandValidator) },
  handler: async (ctx, args) => {
    const user = await principal(ctx);
    if (args.commands.length > 100) throw new ConvexError("Batch limit is 100");
    const results = [];
    for (const command of args.commands) results.push(await write(ctx, user, command));
    return results;
  },
});

export const purgeLeadChildren = internalMutation({
  args: { leadId: v.string() },
  handler: async (ctx, { leadId }) => {
    // The lead is already inaccessible. Delete history in resumable bounded
    // batches so deleting a large conversation cannot exceed a transaction.
    for (const table of ["leadNote", "meeting", "task", "call", "websiteAnalysis", "whatsappMessage"] as const) {
      const rows = await ctx.db.query(table).withIndex("by_leadId", (q) => q.eq("leadId", leadId)).take(100);
      for (const row of rows) {
        if (table === "call") await deleteCallAudio(ctx, row.id);
        await ctx.db.delete(row._id);
      }
      if (rows.length === 100) {
        await ctx.scheduler.runAfter(0, internal.crm.purgeLeadChildren, { leadId });
        return;
      }
    }
  },
});
