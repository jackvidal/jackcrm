import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { convexClient } from "@/lib/db/client";
import { parseWebsiteLead, websiteSubmissionId } from "@/schemas/lead-webhook";
import { api } from "../../../../../convex/_generated/api";

export const runtime = "nodejs";
const MAX_BYTES = 64 * 1024;

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? new URL(req.url).searchParams.get("token");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!["application/json", "application/x-www-form-urlencoded", "multipart/form-data"].includes(contentType ?? "")) {
    return NextResponse.json({ error: "Use JSON or form data" }, { status: 415 });
  }
  const reader = req.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Empty request body" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  let payload: unknown;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Payload exceeds 64 KB" }, { status: 413 });
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    if (contentType === "application/json") payload = JSON.parse(body.toString("utf8"));
    else {
      const form = await new Response(body, { headers: { "Content-Type": req.headers.get("content-type")! } }).formData();
      if ([...form.values()].some((value) => typeof value !== "string")) return NextResponse.json({ error: "File uploads are not supported" }, { status: 400 });
      payload = Object.fromEntries(form);
    }
  } catch {
    return NextResponse.json({ error: "Malformed request body" }, { status: 400 });
  }
  const parsed = parseWebsiteLead(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead fields", fields: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400 });
  const submissionId = req.headers.get("idempotency-key") ?? websiteSubmissionId(payload);
  if (submissionId && submissionId.length > 200) return NextResponse.json({ error: "Submission ID exceeds 200 characters" }, { status: 400 });
  // Without a sender ID, retries of the same normalized submission are deduplicated for the UTC day.
  const deliveryId = createHash("sha256").update(submissionId ? `id:${submissionId}` : `body:${new Date().toISOString().slice(0, 10)}:${JSON.stringify(parsed.data)}`).digest("hex");
  try {
    const client = await convexClient(true);
    const result = await client.mutation(api.leadWebhooks.receive, { token, payload: parsed.data, deliveryId });
    if (!result.ok) {
      const status = result.error === "unauthorized" ? 401 : result.error === "contact_conflict" ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch {
    console.error("website lead webhook transaction failed");
    return NextResponse.json({ error: "Processing failed; retry the same submission ID" }, { status: 500 });
  }
}
