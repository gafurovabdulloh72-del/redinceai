"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Video, VideoOff, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { formatDuration, uploadAttachment, type Attachment } from "./attachments";

type Phase = "idle" | "recording" | "uploading";

/** Doira video xabar uzunligi (Telegram'da 60 s) */
export const VIDEO_NOTE_MAX_SECONDS = 60;
const MIMES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

/** Brauzer doira video yozishni qo'llab-quvvatlaydimi */
export const videoNoteSupported = () => typeof window !== "undefined" && typeof window.MediaRecorder === "function" && typeof navigator.mediaDevices?.getUserMedia === "function";

/**
 * Doira video xabar (Telegram «video note»): kamera tugmasi → aylana ko'rinish + taymer →
 * ✓ yuborish / ✕ bekor. MediaRecorder (WebM/VP9; Safari'da MP4) → video yuklash oqimi →
 * biriktirma `round: true` bilan. 60 soniyada avtomatik to'xtaydi.
 */
export function VideoNoteRecorder({ onRecorded, onError, onPhase, disabled }: { onRecorded: (a: Attachment) => Promise<void> | void; onError?: (msg: string) => void; onPhase?: (recording: boolean) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sec, setSec] = useState(0);
  const [progress, setProgress] = useState(0);
  const [denied, setDenied] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const discard = useRef(false);
  const mounted = useRef(true);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    onPhase?.(phase !== "idle");
  }, [phase, onPhase]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // Suhbat almashsa — yozuv tashlab yuboriladi
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
    try {
      const st = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: "user", frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current) return st.getTracks().forEach((t) => t.stop());
      stream.current = st;
      setDenied(false);
      const mime = MIMES.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: 1_200_000 } : undefined);
      chunks.current = [];
      discard.current = false;
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => void finish(r.mimeType || mime || "video/webm");
      rec.current = r;
      r.start(250);
      startedAt.current = Date.now();
      setSec(0);
      setPhase("recording");
      if (video.current) video.current.srcObject = st;
      timer.current = window.setInterval(() => {
        const s = Math.round((Date.now() - startedAt.current) / 1000);
        setSec(s);
        if (s >= VIDEO_NOTE_MAX_SECONDS) stop();
      }, 250);
    } catch {
      setDenied(true);
      onError?.("Kamera yoki mikrofonga ruxsat berilmagan — manzil satridagi qulf belgisidan ruxsat bering");
    }
  }

  function stop() {
    const r = rec.current;
    if (r && r.state !== "inactive") r.stop();
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  }

  function cancel() {
    discard.current = true;
    stop();
    cleanup();
    setPhase("idle");
    setSec(0);
  }

  async function finish(mime: string) {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const blob = new Blob(chunks.current, { type: mime });
    cleanup();
    if (discard.current || !mounted.current || blob.size < 1000) {
      if (mounted.current) setPhase("idle");
      return;
    }
    setPhase("uploading");
    setProgress(0);
    try {
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `doira-video.${ext}`, { type: mime.split(";")[0] });
      const a = await uploadAttachment(file, { docs: true, onProgress: setProgress });
      if (!mounted.current) return;
      await onRecorded({ ...a, name: "Doira video", duration: seconds, round: true });
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Yuborilmadi");
    } finally {
      if (mounted.current) {
        setPhase("idle");
        setSec(0);
      }
    }
  }

  // Yozish paytida aylana ko'rinish — portal (sahifa ichidagi transform fixed'ni qamab qo'yadi)
  const preview =
    phase !== "idle" && typeof document !== "undefined"
      ? createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[132] flex flex-col items-center gap-2" aria-hidden>
            <span className="relative block h-[180px] w-[180px] overflow-hidden rounded-full ring-4 ring-accent sm:h-[220px] sm:w-[220px]">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={video} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
              {phase === "uploading" && (
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-white">
                  <Loader2 size={26} className="animate-spin" />
                </span>
              )}
            </span>
            <span className="rounded-full bg-black/75 px-3 py-1 text-[12.5px] font-semibold tabular-nums text-white">
              {phase === "uploading" ? `Yuborilmoqda ${progress}%` : `${formatDuration(sec)} / ${formatDuration(VIDEO_NOTE_MAX_SECONDS)}`}
            </span>
          </div>,
          document.body,
        )
      : null;

  if (phase === "recording")
    return (
      <>
        {preview}
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={cancel} aria-label="Bekor qilish" className="grid h-10 w-10 place-items-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg">
            <X size={17} />
          </button>
          <button type="button" onClick={stop} aria-label="Yuborish" className="btn-accent grid h-10 w-10 place-items-center rounded-full">
            <Check size={17} />
          </button>
        </div>
      </>
    );

  if (phase === "uploading")
    return (
      <>
        {preview}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg/8 text-fg-3" aria-label="Yuborilmoqda">
          <Loader2 size={17} className="animate-spin" />
        </span>
      </>
    );

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={disabled}
      aria-label="Doira video xabar"
      title={denied ? "Kameraga ruxsat berilmagan" : "Doira video xabar"}
      className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-fg/8 disabled:opacity-40", denied ? "text-danger-text" : "text-fg-3 hover:text-fg")}
    >
      {denied ? <VideoOff size={18} /> : <Video size={18} />}
    </button>
  );
}
