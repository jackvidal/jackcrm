import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { principal, requireService } from "./lib/auth";
import { byId } from "./lib/store";
import { webhookStore } from "./lib/webhookStore";
import { websiteLeadSchema } from "../src/schemas/lead-webhook";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await principal(ctx);
    if (user.service) throw new ConvexError("Forbidden");
    const hook = await ctx.db.query("leadWebhooks").withIndex("by_ownerId", (q) => q.eq("ownerId", user.userId)).unique();
    return hook ? { token: hook.token, enabled: hook.enabled, lastReceivedAt: hook.lastReceivedAt ?? null, receivedCount: hook.receivedCount } : null;
  },
});

export const configure = mutation({
  args: { action: v.union(v.literal("create"), v.literal("rotate"), v.literal("disable")), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await principal(ctx);
    if (user.service || !await byId(ctx, "profile", user.userId)) throw new ConvexError("Forbidden");
    const hook = await ctx.db.query("leadWebhooks").withIndex("by_ownerId", (q) => q.eq("ownerId", user.userId)).unique();
    if (args.action === "disable") {
      if (hook) await ctx.db.patch(hook._id, { enabled: false, updatedAt: Date.now() });
      return;
    }
    if (args.action === "create" && hook?.enabled) return;
    if (!args.token || !/^[a-f0-9]{64}$/.test(args.token)) throw new ConvexError("Invalid token");
    if (await ctx.db.query("leadWebhooks").withIndex("by_token", (q) => q.eq("token", args.token!)).unique()) throw new ConvexError("Token already exists");
    if (hook) await ctx.db.patch(hook._id, { token: args.token, enabled: true, updatedAt: Date.now() });
    else await ctx.db.insert("leadWebhooks", { ownerId: user.userId, token: args.token, enabled: true, createdAt: Date.now(), updatedAt: Date.now(), receivedCount: 0 });
  },
});

export const receive = mutation({
  args: { token: v.string(), payload: v.any(), deliveryId: v.string() },
  handler: async (ctx, args) => {
    requireService(await principal(ctx));
    const hook = await ctx.db.query("leadWebhooks").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!hook?.enabled) return { ok: false, error: "unauthorized" as const };
    const parsed = websiteLeadSchema.safeParse(args.payload);
    if (!parsed.success || !/^[a-f0-9]{64}$/.test(args.deliveryId)) return { ok: false, error: "invalid_payload" as const };
    const data = parsed.data;
    const db = webhookStore(ctx);
    const externalId = `${hook._id}:${args.deliveryId}`;
    if (await db.webhookEvent.findFirst({ where: { source: "website-form", externalId } })) return { ok: true, duplicate: true };
    // Never let contact data supplied by a form select a different owner.
    const emailLead = data.email ? await db.lead.findFirst({ where: { ownerId: hook.ownerId, email: data.email } }) : null;
    const phoneLead = data.phone ? await db.lead.findFirst({ where: { ownerId: hook.ownerId, phone: data.phone } }) : null;
    if (emailLead && phoneLead && emailLead.id !== phoneLead.id) return { ok: false, error: "contact_conflict" as const };
    let lead = emailLead ?? phoneLead;
    const created = !lead;
    if (!lead) {
      lead = await db.lead.create({ data: { ...data, ownerId: hook.ownerId, status: "NEW" } });
    } else {
      // Preserve the sales stage and existing contact data; retain every new inquiry.
      const details = [
        `פנייה נוספת מטופס אתר (${data.source})`, `שם: ${data.fullName}`,
        data.email && `אימייל: ${data.email}`, data.phone && `טלפון: ${data.phone}`,
        data.company && `חברה: ${data.company}`, data.websiteUrl && `אתר: ${data.websiteUrl}`, data.notes,
      ].filter(Boolean).join("\n");
      await db.leadNote.create({ data: { leadId: lead.id, authorId: hook.ownerId, content: details } });
    }
    await db.webhookEvent.create({ data: { source: "website-form", externalId, payload: { leadId: lead.id }, processedAt: Date.now() } });
    await ctx.db.patch(hook._id, { lastReceivedAt: Date.now(), receivedCount: hook.receivedCount + 1 });
    return { ok: true, created };
  },
});
