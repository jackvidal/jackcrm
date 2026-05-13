import { NextResponse } from "next/server";
import {
  Prisma,
  type WhatsappMessageType,
  type WhatsappStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWassenderSignature } from "@/lib/webhooks/wassender";
import {
  wassenderWebhookSchema,
  type WassenderMessageData,
} from "@/schemas/wassender-webhook";
import { normalizePhone } from "@/lib/whatsapp/send";

export const runtime = "nodejs";

/**
 * Wassender webhook receiver.
 *
 * 1. Verify HMAC signature against WASSENDER_WEBHOOK_SECRET (if configured).
 * 2. Validate payload with Zod.
 * 3. Idempotency: insert into webhook_events on (source, externalId).
 * 4. Route to the right Leadero user via Profile.whatsappNumber (matching the
 *    Wassender session phone number that received the message).
 * 5. Find-or-create a lead by (ownerId + phone); insert a WhatsappMessage row.
 *
 * Inbound flow (most important): a customer sends a message → Wassender forwards
 * here → we create a Lead (if new) and add the message to the thread.
 *
 * Outbound delivery callbacks (sent/delivered/read) update an existing message's
 * status by externalId.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.WASSENDER_WEBHOOK_SECRET;
  const signature =
    req.headers.get("x-webhook-signature") ??
    req.headers.get("x-wassender-signature") ??
    req.headers.get("X-Webhook-Signature");

  // If a secret is configured, enforce signature. Otherwise allow (dev/local).
  if (secret) {
    const valid = verifyWassenderSignature(rawBody, signature, secret);
    if (!valid) {
      console.error("[wassender-webhook] signature mismatch", {
        hasSignature: Boolean(signature),
        sigLen: signature?.length ?? 0,
        sigPrefix: signature?.slice(0, 8) ?? null,
        secretLen: secret.length,
        secretPrefix: secret.slice(0, 8),
        secretsMatch: signature === secret,
        secretsMatchTrimmed: signature?.trim() === secret.trim(),
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }
  }

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = wassenderWebhookSchema.safeParse(payloadJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const event = parsed.data;
  const data = event.data as WassenderMessageData;

  // Build a stable idempotency key. Prefer the provider message id.
  const providerMsgId =
    data.msgId ?? data.messageId ?? data.id ?? cryptoRandomId();
  const externalId = `${event.event}:${providerMsgId}`;

  // Idempotency guard
  let webhookEventId: string;
  try {
    const created = await prisma.webhookEvent.create({
      data: {
        source: "wassender",
        externalId,
        payload: payloadJson as Prisma.InputJsonValue,
      },
    });
    webhookEventId = created.id;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw err;
  }

  try {
    const eventName = event.event.toLowerCase();

    // Delivery status callbacks: just update the existing message row.
    if (
      eventName.includes("delivered") ||
      eventName.includes("read") ||
      eventName.includes("failed") ||
      eventName.includes("sent")
    ) {
      const providerId = providerMsgId;
      const newStatus: WhatsappStatus = eventName.includes("read")
        ? "READ"
        : eventName.includes("delivered")
          ? "DELIVERED"
          : eventName.includes("failed")
            ? "FAILED"
            : "SENT";

      await prisma.whatsappMessage.updateMany({
        where: { externalId: providerId },
        data: { status: newStatus },
      });

      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date() },
      });
      return NextResponse.json({ ok: true, kind: "status_update" });
    }

    // Otherwise treat as a received-message event.
    const sessionPhone = normalizePhone(
      event.sessionPhone ??
        event.session_phone ??
        data.sessionPhone ??
        data.session_phone ??
        "",
    );
    const fromRaw = data.from ?? "";
    const toRaw = data.to ?? "";
    const fromPhone = normalizePhone(stripJid(fromRaw));
    const toPhone = normalizePhone(stripJid(toRaw));
    const isFromMe = data.fromMe === true;

    // Decide which number belongs to "us" (the Leadero user)
    // and which belongs to the lead.
    const myNumber = sessionPhone || (isFromMe ? fromPhone : toPhone);
    const leadPhone = isFromMe ? toPhone : fromPhone;

    if (!myNumber) {
      throw new Error("Webhook payload missing session phone");
    }
    if (!leadPhone) {
      throw new Error("Webhook payload missing lead phone number");
    }

    const profile = await prisma.profile.findFirst({
      where: { whatsappNumber: myNumber },
    });
    if (!profile) {
      throw new Error(
        `No Leadero user mapped to WhatsApp number ${myNumber}. Set it on the Settings page.`,
      );
    }

    // Find-or-create lead by (ownerId + phone)
    let lead = await prisma.lead.findFirst({
      where: { ownerId: profile.id, phone: leadPhone },
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          ownerId: profile.id,
          fullName: leadPhone, // we don't have a name from WhatsApp — phone is the placeholder
          phone: leadPhone,
          source: "whatsapp",
          status: "NEW",
        },
      });
    }

    const body = data.body ?? data.text ?? null;
    const messageType = mapMessageType(data.type);
    const mediaUrl = data.mediaUrl ?? data.media_url ?? null;
    const sentAt = parseTimestamp(data.timestamp);

    await prisma.whatsappMessage.create({
      data: {
        ownerId: profile.id,
        leadId: lead.id,
        direction: isFromMe ? "OUTBOUND" : "INBOUND",
        messageType,
        body,
        mediaUrl,
        fromNumber: fromPhone,
        toNumber: toPhone,
        status: isFromMe ? "SENT" : "DELIVERED",
        externalId: providerMsgId,
        sentAt,
      },
    });

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Wassender webhook processing failed:", message);
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { error: message.slice(0, 1000) },
    });
    // Return 200 so Wassender doesn't retry forever on a malformed/unmapped payload.
    return NextResponse.json({ ok: false, error: message });
  }
}

function stripJid(value: string): string {
  // Wassender/whatsapp ids look like "972501234567@s.whatsapp.net" or "...@c.us"
  return value.split("@")[0] ?? value;
}

function mapMessageType(raw: string | undefined): WhatsappMessageType {
  switch ((raw ?? "").toLowerCase()) {
    case "text":
    case "chat":
      return "TEXT";
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "audio":
    case "ptt":
    case "voice":
      return "AUDIO";
    case "document":
    case "file":
      return "DOCUMENT";
    default:
      return raw ? "OTHER" : "TEXT";
  }
}

function parseTimestamp(ts: number | string | undefined): Date {
  if (ts === undefined || ts === null) return new Date();
  const n = typeof ts === "string" ? Number(ts) : ts;
  if (!Number.isFinite(n)) return new Date();
  // WhatsApp typically sends seconds since epoch; if it's clearly ms, use as-is.
  return new Date(n > 1e12 ? n : n * 1000);
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
