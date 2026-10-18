"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VOICE_MAX_SECONDS, VOICE_MIME_CANDIDATES, formatDuration, uploadAttachment, type Attachment } from "./attachments";

type Phase = "idle" | "recording" | "uploading";
/** Mikrofon holati: noma'lum / ruxsat rad etilgan / qurilma yo'q yoki band */
type MicState = "unknown" | "denied" | "missing";

const MIC_HINT: Record<Exclude<MicState, "unknown">, string> = {
  denied: "Mikrofonga ruxsat berilmagan — manzil satridagi qulf belgisidan ruxsat bering",
  missing: "Mikrofon topilmadi yoki boshqa dastur band qilgan",
};

/**
 * Ovozli xabar (Telegram uslubi): mikrofon tugmasi → yozish (taymer, pulsli nuqta) → ✓ yuborish / ✕ bekor.
 * MediaRecorder (WebM/Opus; Safari'da MP4) → /api/upload?purpose=voice → biriktirma (duration bilan) → onRecorded.
 * Yozish paytida ota-komponent matn maydonini yashiradi (onPhase orqali). 3 daqiqada avtomatik to'xtaydi.
 * Ruxsat rad etilsa tugma «o'chiq mikrofon» holatiga o'tadi (bosilsa yana so'raydi).
 */
export function VoiceRecorder({ onRecorded, onError, onPhase, disabled, size = "md" }: { onRecorded: (a: Attachment) => Promise<void> | void; onError?: (msg: string) => void; onPhase?: (recording: boolean) => void; disabled?: boolean; size?: "md" | "lg" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sec, setSec] = useState(0);
  const [mic, setMic] = useState<MicState>("unknown");
  const [progress, setProgress] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const discard = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    onPhase?.(phase !== "idle");
  }, [phase, onPhase]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      // Komponent yo'qolsa (suhbat almashdi) — yozuv tashlab yuboriladi, yuklanmaydi
      mounted.current = false;
      discard.current = true;
      if (timer.current) window.clearInterval(timer.current);
      const r = rec.current;
      if (r && r.state !== "inactive") r.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
      if (!mounted.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      setMic("unknown");
      // Ba'zi brauzerlarda isTypeSupported yo'q — unda brauzerning standart formati ishlatiladi
      const canCheck = typeof MediaRecorder.isTypeSupported === "function";
      const mime = canCheck ? (VOICE_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "") : "";
      let r: MediaRecorder;
      try {
        r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined);
      } catch {
        r = new MediaRecorder(s);
      }
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
      const name = e instanceof DOMException ? e.name : "";
      const state: MicState = name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError" ? "denied" : "missing";
      setMic(state);
      onError?.(MIC_HINT[state]);
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
    if (!mounted.current) return;
    if (discard.current || !parts.length || dur < 1) {
      setPhase("idle");
      return;
    }
    const base = mime.split(";")[0] || "audio/webm";
    const ext = base.includes("mp4") ? "m4a" : base.includes("ogg") ? "ogg" : "webm";
    const file = new File([new Blob(parts, { type: base })], `ovoz.${ext}`, { type: base });
    setPhase("uploading");
    setProgress(0);
    try {
      const a = await uploadAttachment(file, { voice: { duration: dur }, onProgress: (r) => mounted.current && setProgress(r) });
      if (!mounted.current) return;
      await onRecorded(a);
    } catch (e) {
      if (mounted.current) onError?.(e instanceof Error ? e.message : "Ovozli xabar yuborilmadi");
    } finally {
      if (mounted.current) setPhase("idle");
    }
  }

  const btn = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  if (phase === "idle") {
    const off = mic !== "unknown";
    return (
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        aria-label={off ? `Ovozli xabar — ${MIC_HINT[mic as Exclude<MicState, "unknown">]}` : "Ovozli xabar yozish"}
        title={off ? MIC_HINT[mic as Exclude<MicState, "unknown">] : "Ovozli xabar"}
        className={cn(
          "press flex shrink-0 items-center justify-center rounded-full border border-line transition hover:border-fg hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-40",
          off ? "text-danger-text" : "text-fg-3",
          btn,
        )}
      >
        {off ? <MicOff size={size === "lg" ? 17 : 16} /> : <Mic size={size === "lg" ? 17 : 16} />}
      </button>
    );
  }
  return (
    <div className={cn("expand-in flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-surface-2 pl-3.5 pr-1", size === "lg" ? "h-11" : "h-10")} role="status">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
        {phase === "recording" && <span className="absolute inline-flex h-full w-full animate-ping-soft rounded-full bg-danger" />}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", phase === "recording" ? "bg-danger" : "bg-fg-4")} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tabular-nums text-fg">
        {phase === "uploading" ? `Yuborilmoqda… ${Math.round(progress * 100)}%` : formatDuration(sec)}
      </span>
      <span className="flex items-center gap-0.5">
        <button type="button" onClick={() => stop(true)} disabled={phase === "uploading"} aria-label="Bekor qilish" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-danger-text focus-visible:outline-2 focus-visible:outline-fg disabled:opacity-40">
          <X size={15} />
        </button>
        <button type="button" onClick={() => stop(false)} disabled={phase === "uploading"} aria-label="Ovozli xabarni yuborish" className="btn-accent flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40">
          <Check size={15} />
        </button>
      </span>
    </div>
  );
}
