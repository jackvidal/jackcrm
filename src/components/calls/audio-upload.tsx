"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, Mic } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { t } from "@/i18n/he";

interface Props {
  callId: string;
}

type Stage = "idle" | "uploading" | "transcribing";

// Whisper-supported audio + video containers (Whisper extracts the audio track from videos)
const ACCEPTED_EXTS = ["mp3", "wav", "m4a", "mp4", "mpeg", "mpga", "webm", "ogg", "flac"];
const ACCEPT_ATTR = [
  "audio/*",
  "video/mp4",
  "video/webm",
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".webm",
  ".ogg",
  ".flac",
].join(",");
const MAX_BYTES = 25 * 1024 * 1024;

export function AudioUpload({ callId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError(t.calls.audioUpload.invalidFormat);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t.calls.audioUpload.tooBig);
      return;
    }

    setStage("uploading");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Unauthorized");
        setStage("idle");
        return;
      }

      // Each user has their own folder. RLS will enforce read access.
      const path = `${user.id}/${callId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("call-audio")
        .upload(path, file, {
          contentType: file.type || "audio/mpeg",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Tell the server to fetch from storage and transcribe
      setStage("transcribing");
      const res = await fetch(`/api/calls/${callId}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: path }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t.calls.audioUpload.error);
      }

      toast({
        title: t.calls.audioUpload.success,
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t.calls.audioUpload.error;
      setError(msg);
      toast({
        title: t.calls.audioUpload.error,
        description: msg,
        variant: "destructive",
      });
    } finally {
      setStage("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const busy = stage !== "idle";

  return (
    <div className="mt-3">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          busy
            ? "border-primary/40 bg-primary/5 cursor-wait"
            : dragOver
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        {stage === "idle" && (
          <>
            <CloudUpload className="h-6 w-6 text-muted-foreground" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {t.calls.audioUpload.dragHere}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.calls.audioUpload.supportedFormats}
              </p>
            </div>
          </>
        )}

        {stage === "uploading" && (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium">{t.calls.audioUpload.uploading}</p>
          </>
        )}

        {stage === "transcribing" && (
          <>
            <Mic className="h-6 w-6 animate-pulse text-primary" />
            <p className="text-sm font-medium">
              {t.calls.audioUpload.transcribing}
            </p>
            <p className="text-xs text-muted-foreground">
              עד דקה תלוי באורך ההקלטה
            </p>
          </>
        )}
      </label>

      {error && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
