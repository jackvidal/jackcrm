import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { principal, requireService } from "./lib/auth";
import { webhookStore } from "./lib/webhookStore";
import { calWebhookSchema } from "../src/schemas/cal-webhook";
import { wassenderWebhookSchema } from "../src/schemas/wassender-webhook";
import type { WhatsappMessageType, WhatsappStatus } from "@prisma/client";

type WebhookResult = { ok: boolean; duplicate?: boolean; kind?: string };

export const cal = mutation({
  args: { payload: v.any(), deliveryId: v.string() },
  handler: async (ctx, args): Promise<WebhookResult> => {
    requireService(await principal(ctx));
    const event = calWebhookSchema.parse(args.payload);
    const db = webhookStore(ctx);
    const externalId = `${event.triggerEvent}:${event.payload.uid}:${args.deliveryId}`;
    if (await db.webhookEvent.findFirst({ where: { source: "cal.com", externalId } })) return { ok: true, duplicate: true };
    const audit = await db.webhookEvent.create({ data: { source: "cal.com", externalId, payload: args.payload } });
    const webhookEventId = audit.id;
    const organizerEmail = event.payload.organizer?.email?.toLowerCase();
    if (!organizerEmail) {
      throw new Error("Webhook payload missing organizer email");
    }

    const profile = await db.profile.findFirst({
      where: { calOrganizerEmail: organizerEmail },
    });
    if (!profile) {
      throw new Error(
        `No Leadero user mapped to organizer ${organizerEmail}. Set this on the Settings page.`,
      );
    }

    const attendee = event.payload.attendees[0];
    if (!attendee?.email) {
      throw new Error("Webhook payload missing attendee email");
    }
    const attendeeEmail = attendee.email.toLowerCase();

    // Upsert lead by (ownerId + email)
    let lead = await db.lead.findFirst({
      where: { ownerId: profile.id, email: attendeeEmail },
    });
    if (!lead) {
      lead = await db.lead.create({
        data: {
          ownerId: profile.id,
          fullName: attendee.name ?? attendeeEmail,
          email: attendeeEmail,
          source: "cal.com",
          status: "MEETING_SCHEDULED",
        },
      });
    } else if (attendee.name && lead.fullName !== attendee.name) {
      lead = await db.lead.update({
        where: { id: lead.id },
        data: { fullName: attendee.name },
      });
    }

    const scheduledAt = Date.parse(event.payload.startTime);
    const endTime = Date.parse(event.payload.endTime);
    const durationMinutes = Math.max(
      5,
      Math.round((endTime - scheduledAt) / 60000),
    );

    // Decide meeting status from event type
    const meetingStatus =
      event.triggerEvent === "BOOKING_CANCELLED"
        ? "CANCELED"
        : event.triggerEvent === "MEETING_ENDED"
          ? "COMPLETED"
          : "SCHEDULED";

    // Upsert meeting by calEventId (uid)
    await db.meeting.upsert({
      where: { calEventId: event.payload.uid, ownerId: profile.id },
      create: {
        leadId: lead.id,
        ownerId: profile.id,
        scheduledAt,
        durationMinutes,
        status: meetingStatus,
        notes: event.payload.additionalNotes ?? null,
        meetingUrl: event.payload.location ?? null,
        calEventId: event.payload.uid,
      },
      update: {
        scheduledAt,
        durationMinutes,
        status: meetingStatus,
        meetingUrl: event.payload.location ?? null,
      },
    });

    // Auto-update lead status from event
    if (event.triggerEvent === "MEETING_ENDED") {
      await db.lead.updateMany({
        where: {
          id: lead.id,
          status: { in: ["NEW", "MEETING_SCHEDULED"] },
        },
        data: { status: "MEETING_COMPLETED" },
      });
    } else if (
      event.triggerEvent === "BOOKING_CREATED" ||
      event.triggerEvent === "BOOKING_RESCHEDULED"
    ) {
      await db.lead.updateMany({
        where: { id: lead.id, status: "NEW" },
        data: { status: "MEETING_SCHEDULED" },
      });
    }

    await db.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: Date.now() },
    });

    return { ok: true };
  },
});

export const wassender = mutation({
  args: { payload: v.any(), deliveryId: v.string() },
  handler: async (ctx, args): Promise<WebhookResult> => {
    requireService(await principal(ctx));
    const db = webhookStore(ctx);
  const event = wassenderWebhookSchema.parse(args.payload);
  const eventName = event.event.toLowerCase();
  const sessionId = event.sessionId ?? event.session_id ?? "";

  // Build a stable idempotency key from the WA message id when available.
  const messages = pick<Record<string, unknown>>(event.data, "messages");
  const key = messages ? pick<Record<string, unknown>>(messages, "key") : null;
  const providerMsgId =
    asString(key?.id) ??
    asString(messages?.id) ??
    asString(event.data?.id) ??
    args.deliveryId;
  const externalId = `${eventName}:${providerMsgId}`;

    if (await db.webhookEvent.findFirst({ where: { source: "wassender", externalId } })) return { ok: true, duplicate: true };
    const audit = await db.webhookEvent.create({ data: { source: "wassender", externalId, payload: args.payload } });
    const webhookEventId = audit.id;
    // Skip the simulator's test event — nothing to persist.
    if (eventName === "webhook.test") {
      await db.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: Date.now() },
      });
      return { ok: true, kind: "test" };
    }

    // Match user by sessionId = wassenderToken
    if (!sessionId) throw new Error("Webhook payload missing sessionId");
    const profile = await db.profile.findFirst({
      where: { wassenderToken: sessionId },
    });
    if (!profile) {
      throw new Error(
        `No Leadero user matches Wassender sessionId. Token not configured in Settings?`,
      );
    }

    // Delivery-status callbacks (message.sent, .delivered, .read, .failed).
    if (
      eventName.includes("delivered") ||
      eventName.includes("read") ||
      eventName.includes("failed") ||
      eventName === "message.sent" ||
      eventName === "messages.sent"
    ) {
      const newStatus: WhatsappStatus = eventName.includes("read")
        ? "READ"
        : eventName.includes("delivered")
          ? "DELIVERED"
          : eventName.includes("failed")
            ? "FAILED"
            : "SENT";
      if (providerMsgId) {
        await db.whatsappMessage.updateMany({
          where: { externalId: providerMsgId, ownerId: profile.id },
          data: { status: newStatus },
        });
      }
      await db.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: Date.now() },
      });
      return { ok: true, kind: "status_update" };
    }

    // Treat anything else as a received message.
    if (!messages) {
      throw new Error("Webhook payload missing data.messages");
    }

    const isFromMe = key?.fromMe === true;
    const senderPhone =
      normalizePhone(asString(key?.cleanedSenderPn) ?? "") ||
      normalizePhone(stripJid(asString(key?.senderPn))) ||
      normalizePhone(stripJid(asString(key?.remoteJid)));

    if (!senderPhone) {
      throw new Error("Could not extract sender phone from payload");
    }

    const messageBody = extractMessageBody(messages.message);
    const messageType = detectMessageType(messages.message);
    const sentAt = parseTimestamp(messages.messageTimestamp ?? event.timestamp);

    // The "other side" = the lead. If fromMe, the lead is the recipient
    // (which Wassender doesn't include reliably for outbound). For incoming,
    // the lead is the sender.
    const leadPhone = senderPhone; // we only support inbound routing reliably

    // Find-or-create lead
    let lead = await db.lead.findFirst({
      where: { ownerId: profile.id, phone: leadPhone },
    });
    if (!lead) {
      lead = await db.lead.create({
        data: {
          ownerId: profile.id,
          fullName: leadPhone,
          phone: leadPhone,
          source: "whatsapp",
          status: "NEW",
        },
      });
    }

    const myNumber = profile.whatsappNumber ?? "";
    await db.whatsappMessage.create({
      data: {
        ownerId: profile.id,
        leadId: lead.id,
        direction: isFromMe ? "OUTBOUND" : "INBOUND",
        messageType,
        body: messageBody,
        fromNumber: isFromMe ? myNumber : leadPhone,
        toNumber: isFromMe ? leadPhone : myNumber,
        status: isFromMe ? "SENT" : "DELIVERED",
        externalId: providerMsgId,
        sentAt,
      },
    });

    await db.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: Date.now() },
    });

    return { ok: true };
  },
});
function pick<T>(obj: Record<string, unknown> | undefined, key: string): T | null {
  if (!obj) return null;
  const v = obj[key];
  return v && typeof v === "object" ? (v as T) : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function stripJid(value: string | undefined): string {
  if (!value) return "";
  return value.split("@")[0] ?? value;
}

function extractMessageBody(msg: unknown): string | null {
  if (!msg || typeof msg !== "object") return null;
  const m = msg as Record<string, unknown>;
  if (typeof m.conversation === "string") return m.conversation;
  const ext = m.extendedTextMessage as Record<string, unknown> | undefined;
  if (ext && typeof ext.text === "string") return ext.text;
  const img = m.imageMessage as Record<string, unknown> | undefined;
  if (img && typeof img.caption === "string") return img.caption;
  const vid = m.videoMessage as Record<string, unknown> | undefined;
  if (vid && typeof vid.caption === "string") return vid.caption;
  const doc = m.documentMessage as Record<string, unknown> | undefined;
  if (doc && typeof doc.caption === "string") return doc.caption;
  return null;
}

function detectMessageType(msg: unknown): WhatsappMessageType {
  if (!msg || typeof msg !== "object") return "TEXT";
  const m = msg as Record<string, unknown>;
  if (m.conversation || m.extendedTextMessage) return "TEXT";
  if (m.imageMessage) return "IMAGE";
  if (m.videoMessage) return "VIDEO";
  if (m.audioMessage || m.pttMessage) return "AUDIO";
  if (m.documentMessage) return "DOCUMENT";
  return "OTHER";
}

function parseTimestamp(ts: unknown): number {
  if (ts === undefined || ts === null) return Date.now();
  const n = typeof ts === "string" ? Number(ts) : (ts as number);
  if (!Number.isFinite(n)) return Date.now();
  return n > 1e12 ? n : n * 1000;
}


function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
