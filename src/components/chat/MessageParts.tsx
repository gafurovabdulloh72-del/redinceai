"use client";

import { useEffect, useRef, useState } from "react";
import { CornerUpLeft, FileText, Image as ImageIcon, Mic, Paperclip, Pause, Play, Video, X } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import type { QuoteView } from "@/lib/chat/quote";
import { cn } from "@/lib/utils";
import { formatBytes, formatDuration, isAudioAttachment, isImageAttachment, isVideoAttachment, type Attachment } from "./attachments";

/* ------------------------------------------------------------------ */
/* Ovozli xabar pleyeri                                                 */
/* ------------------------------------------------------------------ */
/** Bir vaqtda bitta audio o'ynaydi (Telegram kabi) */
let current: HTMLAudioElement | null = null;
const BARS = 30;

/** URL'dan barqaror "to'lqin" naqshi (haqiqiy waveform saqlanmaydi — ko'rinish uchun) */
function barsFor(url: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    const env = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI); // o'rtasi balandroq
    out.push(Math.max(0.18, Math.min(1, (0.3 + r * 0.7) * env)));
  }
  return out;
}

export function AudioBubble({ a, mine }: { a: Attachment; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(a.duration ?? 0);
  const [rate, setRate] = useState(1);
  const bars = useRef(barsFor(a.url)).current;

  function el(): HTMLAudioElement {
    if (!audioRef.current) {
      const au = new Audio(a.url);
      au.preload = "metadata";
      au.addEventListener("timeupdate", () => {
        const d = au.duration && Number.isFinite(au.duration) ? au.duration : duration || 1;
        setTime(au.currentTime);
        setProgress(Math.min(1, au.currentTime / d));
      });
      au.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(au.duration) && au.duration > 0) setDuration(au.duration);
      });
      au.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(0);
        setTime(0);
      });
      au.addEventListener("pause", () => setPlaying(false));
      au.addEventListener("play", () => setPlaying(true));
      audioRef.current = au;
    }
    return audioRef.current;
  }
  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (current === audioRef.current) current = null;
    },
    [],
  );

  async function toggle() {
    const au = el();
    if (playing) {
      au.pause();
      return;
    }
    if (current && current !== au) current.pause();
    current = au;
    au.playbackRate = rate;
    try {
      await au.play();
    } catch {
      setPlaying(false);
    }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const au = el();
    const d = Number.isFinite(au.duration) && au.duration > 0 ? au.duration : duration;
    if (d > 0) {
      au.currentTime = ratio * d;
      setProgress(ratio);
      setTime(ratio * d);
    }
  }
  function cycleRate() {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const shown = playing || time > 0 ? time : duration;
  return (
    <div className={cn("flex w-[min(260px,70vw)] items-center gap-2.5 py-0.5", mine ? "text-ink-fg" : "text-fg")} role="group" aria-label={`Ovozli xabar, ${formatDuration(duration)}`}>
      <button type="button" onClick={() => void toggle()} aria-label={playing ? "To'xtatish" : "Tinglash"} className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        {playing ? <Pause size={15} className="fill-current" /> : <Play size={15} className="ml-0.5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-7 cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Ijro holati">
          {bars.map((h, i) => (
            <span key={i} className={cn("w-[3px] flex-1 rounded-full transition-opacity", i / BARS <= progress ? "opacity-100" : "opacity-35", mine ? "bg-ink-fg" : "bg-fg")} style={{ height: `${Math.round(h * 100)}%` }} />
          ))}
        </div>
        <div className={cn("mt-0.5 flex items-center justify-between text-[11px] tabular-nums", mine ? "text-ink-fg/70" : "text-fg-3")}>
          <span className="inline-flex items-center gap-1">
            <Mic size={10} /> {formatDuration(shown)}
          </span>
          <button type="button" onClick={cycleRate} className={cn("rounded-full px-1.5 font-semibold", mine ? "bg-white/15" : "bg-fg/8")} aria-label="Tezlik">
            {rate}×
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Biriktirmalar ro'yxati (ovoz / video / rasm / fayl)                  */
/* ------------------------------------------------------------------ */
export function AttachmentList({ attachments, mine }: { attachments: Attachment[]; mine: boolean }) {
  if (!attachments.length) return null;
  return (
    <div className="mb-1.5 space-y-1.5">
      {attachments.map((a) =>
        isAudioAttachment(a) ? (
          <AudioBubble key={a.url} a={a} mine={mine} />
        ) : isVideoAttachment(a) ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key={a.url} src={a.url} controls preload="metadata" playsInline className="max-h-64 w-full rounded-lg bg-black/20" title={a.name} />
        ) : isImageAttachment(a) ? (
          <a key={a.url} href={a.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg">
            <SafeImage src={a.url} alt={a.name} width={360} height={240} className="h-auto max-h-56 w-full object-cover" />
          </a>
        ) : (
          <a key={a.url} href={a.url} target="_blank" rel="noopener" className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold underline-offset-2 hover:underline", mine ? "bg-white/10" : "bg-fg/5")}>
            <Paperclip size={13} className="shrink-0" />
            <span className="truncate">{a.name}</span>
            <span className={cn("shrink-0 text-[11px] font-normal", mine ? "text-ink-fg/60" : "text-fg-4")}>{formatBytes(a.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Iqtibos (javob)                                                      */
/* ------------------------------------------------------------------ */
const KIND_ICON = { text: null, voice: Mic, image: ImageIcon, video: Video, file: FileText } as const;

/** Xabar ichidagi iqtibos bloki — bosilsa asl xabarga o'tadi va uni yoritadi */
export function QuoteBlock({ q, mine, className }: { q: QuoteView; mine: boolean; className?: string }) {
  const Icon = KIND_ICON[q.kind];
  return (
    <button
      type="button"
      onClick={() => jumpToMessage(q.id)}
      className={cn("mb-1.5 flex w-full min-w-0 max-w-full items-stretch gap-2 rounded-[10px] border-l-[3px] border-accent px-2.5 py-1.5 text-left transition", mine ? "bg-white/10 hover:bg-white/15" : "bg-accent-soft/70 hover:bg-accent-soft", className)}
      title="Asl xabarga o'tish"
    >
      <span className="min-w-0">
        {q.senderName && <span className={cn("block truncate text-[11.5px] font-bold", mine ? "text-ink-fg" : "text-accent-text")}>{q.senderName}</span>}
        <span className={cn("flex items-center gap-1 truncate text-[12.5px]", mine ? "text-ink-fg/80" : "text-fg-2")}>
          {Icon && <Icon size={12} className="shrink-0" />}
          <span className="truncate">{q.body || "…"}</span>
        </span>
      </span>
    </button>
  );
}

/** Kompozitor ustidagi "Javob:" paneli */
export function ReplyBar({ q, onCancel }: { q: QuoteView; onCancel: () => void }) {
  const Icon = KIND_ICON[q.kind];
  return (
    <div className="expand-in mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-accent bg-accent-soft/60 py-1.5 pl-3 pr-1" role="status">
      <CornerUpLeft size={14} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-bold text-accent-text">{q.senderName ? `Javob: ${q.senderName}` : "Javob"}</span>
        <span className="flex items-center gap-1 truncate text-[12.5px] text-fg-2">
          {Icon && <Icon size={12} className="shrink-0" />}
          <span className="truncate">{q.body || "…"}</span>
        </span>
      </span>
      <button type="button" onClick={onCancel} aria-label="Javobni bekor qilish" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg">
        <X size={14} />
      </button>
    </div>
  );
}

/** Xabar yonidagi "Javob berish" tugmasi — sichqoncha ustida ko'rinadi, sensorli ekranda doim xira ko'rinadi */
export function ReplyButton({ onClick, mine }: { onClick: () => void; mine: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Javob berish"
      title="Javob berish"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-fg-4 opacity-0 transition hover:bg-fg/8 hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60",
        mine ? "order-first" : "",
      )}
    >
      <CornerUpLeft size={14} />
    </button>
  );
}

/** Asl xabarga o'tish va qisqa yoritish */
export function jumpToMessage(id: string) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("ring-2", "ring-accent/60");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-accent/60"), 1400);
}

/* ------------------------------------------------------------------ */
/* "Yozmoqda…"                                                          */
/* ------------------------------------------------------------------ */
export function TypingDots({ label }: { label: string }) {
  return (
    <p className="expand-in flex items-center gap-2 px-1 text-[12.5px] font-medium text-fg-3" aria-live="polite">
      <span className="typing-dots inline-flex items-center gap-[3px] rounded-full bg-fg/6 px-2 py-1.5" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-fg-3" />
        <span className="h-1.5 w-1.5 rounded-full bg-fg-3" />
        <span className="h-1.5 w-1.5 rounded-full bg-fg-3" />
      </span>
      {label}
    </p>
  );
}

/** Guruh uchun "yozmoqda" matni: 1 — "Ali yozmoqda…", 2 — "Ali va Vali yozmoqda…", 3+ — "3 kishi yozmoqda…" */
export function typingLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} yozmoqda…`;
  if (names.length === 2) return `${names[0]} va ${names[1]} yozmoqda…`;
  return `${names.length} kishi yozmoqda…`;
}
