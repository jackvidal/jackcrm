import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { verifyWassenderSignature } from "@/lib/webhooks/wassender";
import { wassenderWebhookSchema } from "@/schemas/wassender-webhook";
import { convexClient } from "@/lib/db/client";
import { api } from "../../../../../convex/_generated/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.WASSENDER_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const rawBody = await req.text();
  if (!verifyWassenderSignature(rawBody, req.headers.get("x-webhook-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!wassenderWebhookSchema.safeParse(payload).success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    const client = await convexClient(true);
    const result = await client.mutation(api.webhooks.wassender, {
      payload,
      deliveryId: createHash("sha256").update(rawBody).digest("hex"),
    });
    return NextResponse.json(result);
  } catch {
    // The transaction rolls back on failure, allowing provider retries without
    // losing an event or partially creating its lead/message/meeting.
    console.error("wassender webhook transaction failed");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
