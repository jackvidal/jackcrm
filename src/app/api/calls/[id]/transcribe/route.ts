import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transcribeAudio } from "@/lib/ai/transcribe-audio";

export const runtime = "nodejs";
export const maxDuration = 60; // Whisper can take time for longer audio

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const call = await db.call.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  try {
    const downloadUrl = new URL("/call-audio", process.env.NEXT_PUBLIC_CONVEX_SITE_URL!);
    downloadUrl.searchParams.set("callId", call.id);
    const audio = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${await convexAuthNextjsToken()}` },
      cache: "no-store",
    });
    if (!audio.ok) return NextResponse.json({ error: "שגיאה בטעינת קובץ האודיו" }, { status: 400 });
    const audioBlob = await audio.blob();
    const filename = decodeURIComponent(audio.headers.get("X-Audio-Filename") ?? "audio.mp3");

    // 2. Send to Whisper
    const result = await transcribeAudio(audioBlob, filename);

    // 3. Save the transcript + audio reference on the call
    const updated = await db.call.update({
      where: { id: call.id },
      data: {
        transcript: result.text,
        // If the user hadn't entered duration, fill it from Whisper
        durationSeconds: call.durationSeconds ?? result.durationSeconds,
      },
    });

    revalidatePath(`/leads/${call.leadId}`);
    return NextResponse.json({
      call: updated,
      transcriptLength: result.text.length,
      durationSeconds: result.durationSeconds,
    });
  } catch (err) {
    console.error("Transcription failed", err);
    const raw = err instanceof Error ? err.message : "שגיאה לא ידועה";
    const sanitized =
      raw.length > 250 || /\b(invocation|prisma|stack|TypeError)\b/i.test(raw)
        ? "התמלול נכשל. אנא נסו שוב."
        : raw;
    return NextResponse.json({ error: sanitized }, { status: 500 });
  }
}
