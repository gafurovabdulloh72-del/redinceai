"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOICE_MAX_SECONDS, VOICE_MIME_CANDIDATES, formatDuration, uploadAttachment, type Attachment } from "./attachments";

type Phase = "idle" | "recording" | "uploading";

/**
 * Ovozli xabar (Telegram uslubi): mikrofon tugmasi → yozish (taymer, pulsli nuqta) → ✓ yuborish / ✕ bekor.
 * MediaRecorder (WebM/Opus; Safari'da MP4) → /api/upload?purpose=voice → biriktirma (duration bilan) → onRecorded.
 * Yozish paytida ota-komponent matn maydonini yashiradi (onPhase orqali). 3 daqiqada avtomatik to'xtaydi.
 */
export function VoiceRecorder({ onRecorded, onError, onPhase, disabled, size = "md" }: { onRecorded: (a: Attachment) => Promise<void> | void; onError?: (msg: string) => void; onPhase?: (recording: boolean) => void; disabled?: boolean; size?: "md" | "lg" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sec, setSec] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const discard = useRef(false);

  useEffect(() => {
    onPhase?.(phase !== "idle");
  }, [phase, onPhase]);
  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    rec.current = null;
  }

  async function start() {
    if (disabled || phase !== "idle") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError?.("Bu brauzerda ovoz yozib bo'lmaydi");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = VOICE_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
      chunks.current = [];
      discard.current = false;
      r.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      r.onstop = () => void finish(r.mimeType || mime);
      rec.current = r;
      r.start(250);
      startedAt.current = Date.now();
      setSec(0);
      setPhase("recording");
      timer.current = window.setInterval(() => {
        const s2 = Math.floor((Date.now() - startedAt.current) / 1000);
        setSec(s2);
        if (s2 >= VOICE_MAX_SECONDS) stop(false);
      }, 250);
    } catch (e) {
      cleanup();
      onError?.(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "Mikrofonga ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering" : "Mikrofon topilmadi");
    }
  }

  function stop(cancel: boolean) {
    discard.current = cancel;
    const r = rec.current;
    if (r && r.state !== "inactive") r.stop();
    else {
      cleanup();
      setPhase("idle");
    }
  }

  async function finish(mime: string) {
    const dur = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const parts = chunks.current;
    cleanup();
    if (discard.current || !parts.length || dur < 1) {
      setPhase("idle");
      return;
    }
    const base = mime.split(";")[0] || "audio/webm";
    const ext = base.includes("mp4") ? "m4a" : base.includes("ogg") ? "ogg" : "webm";
    const file = new File([new Blob(parts, { type: base })], `ovoz.${ext}`, { type: base });
    setPhase("uploading");
    try {
      const a = await uploadAttachment(file, { voice: { duration: dur } });
      await onRecorded(a);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Ovozli xabar yuborilmadi");
    } finally {
      setPhase("idle");
    }
  }

  const btn = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  if (phase === "idle") {
    return (
      <button type="button" onClick={() => void start()} disabled={disabled} aria-label="Ovozli xabar yozish" title="Ovozli xabar" className={cn("press flex shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition hover:border-fg hover:text-fg disabled:opacity-40", btn)}>
        <Mic size={size === "lg" ? 17 : 16} />
      </button>
    );
  }
  return (
    <div className={cn("expand-in flex min-w-0 flex-1 items-center gap-2 rounded-full border border-accent/40 bg-accent-soft/60 pl-3 pr-1", size === "lg" ? "h-11" : "h-10")} role="status" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-danger" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-fg">{phase === "uploading" ? "Yuborilmoqda…" : formatDuration(sec)}</span>
      <span className="hidden truncate text-[12px] text-fg-3 sm:inline">{phase === "uploading" ? "" : `Ovoz yozilmoqda · ko'pi bilan ${VOICE_MAX_SECONDS / 60} daqiqa`}</span>
      <span className="ml-auto flex items-center gap-1">
        <button type="button" onClick={() => stop(true)} disabled={phase === "uploading"} aria-label="Bekor qilish" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-danger-text disabled:opacity-40">
          <X size={15} />
        </button>
        <button type="button" onClick={() => stop(false)} disabled={phase === "uploading"} aria-label="Ovozli xabarni yuborish" className="btn-accent flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40">
          <Check size={15} />
        </button>
      </span>
    </div>
  );
}
