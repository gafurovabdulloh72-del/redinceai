"use client";

import { Fragment, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CornerUpLeft, FileText, Image as ImageIcon, Mic, Paperclip, Pause, Play, Video, X } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import type { QuoteView } from "@/lib/chat/quote";
import { DM_REACTIONS, type LinkPreviewView, type ReactionSummary } from "@/lib/chat/constants";
import { cn } from "@/lib/utils";
import { attachmentExt, formatBytes, formatDuration, isAudioAttachment, isImageAttachment, isVideoAttachment, type Attachment } from "./attachments";

/** Dumaloq ikonka tugma — chat bo'ylab bir xil (40px, fokus halqasi) */
export const iconBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg disabled:opacity-40";

/* ------------------------------------------------------------------ */
/* Yagona media boshqaruvi: bir vaqtda bitta audio/video o'ynaydi       */
/* ------------------------------------------------------------------ */
let currentMedia: HTMLMediaElement | null = null;
/** Yangi media boshlanganda avvalgisini (audio yoki video) to'xtatadi */
export function claimMedia(el: HTMLMediaElement) {
  if (currentMedia && currentMedia !== el && !currentMedia.paused) currentMedia.pause();
  currentMedia = el;
}

/* ------------------------------------------------------------------ */
/* Ovozli xabar pleyeri                                                 */
/* ------------------------------------------------------------------ */
const BARS = 30;
const RATE_KEY = "chat:rate";
const RATES = [1, 1.5, 2] as const;

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

function readRate(): number {
  try {
    const v = Number(window.localStorage.getItem(RATE_KEY));
    return (RATES as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

export function AudioBubble({ a, mine }: { a: Attachment; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(a.duration ?? 0);
  const [rate, setRate] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  const bars = useRef(barsFor(a.url)).current;

  // Tezlik eslab qolinadi (barcha ovozli xabarlar uchun bitta sozlama)
  useEffect(() => {
    setRate(readRate());
  }, []);

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
      if (currentMedia === audioRef.current) currentMedia = null;
    },
    [],
  );

  async function toggle() {
    const au = el();
    if (playing) {
      au.pause();
      return;
    }
    claimMedia(au);
    au.playbackRate = rate;
    try {
      await au.play();
    } catch {
      setPlaying(false);
    }
  }
  const dur = () => {
    const au = audioRef.current;
    return au && Number.isFinite(au.duration) && au.duration > 0 ? au.duration : duration;
  };
  function seekTo(ratio: number) {
    const r = Math.max(0, Math.min(1, ratio));
    const d = dur();
    setProgress(r);
    if (d > 0) {
      el().currentTime = r * d;
      setTime(r * d);
    }
  }
  const ratioOf = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) / rect.width;
  };
  // Surish (scrub): bosib turib harakatlantirish — pointer capture bilan
  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(true);
    seekTo(ratioOf(e));
  }
  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (scrubbing) seekTo(ratioOf(e));
  }
  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    setScrubbing(false);
    seekTo(ratioOf(e));
  }
  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const d = dur();
    if (!d) return;
    const step = 5 / d;
    if (e.key === "ArrowRight") (e.preventDefault(), seekTo(progress + step));
    else if (e.key === "ArrowLeft") (e.preventDefault(), seekTo(progress - step));
    else if (e.key === "Home") (e.preventDefault(), seekTo(0));
    else if (e.key === "End") (e.preventDefault(), seekTo(1));
    else if (e.key === " " || e.key === "Enter") (e.preventDefault(), void toggle());
  }
  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
    try {
      window.localStorage.setItem(RATE_KEY, String(next));
    } catch {
      /* eslab qolinmasa ham ishlaydi */
    }
  }

  const shown = playing || time > 0 ? time : duration;
  return (
    <div className={cn("flex w-[min(250px,66vw)] items-center gap-2.5 py-0.5", mine ? "text-ink-fg" : "text-fg")} role="group" aria-label={`Ovozli xabar, ${formatDuration(duration)}`}>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={playing ? "To'xtatish" : "Tinglash"}
        className={cn("press flex h-9 w-9 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1", mine ? "bg-ink-fg/15 text-ink-fg focus-visible:outline-ink-fg" : "bg-ink text-ink-fg focus-visible:outline-fg")}
      >
        {playing ? <Pause size={15} className="fill-current" /> : <Play size={15} className="ml-0.5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn("flex h-7 touch-none select-none items-center gap-[2px] rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2", scrubbing ? "cursor-grabbing" : "cursor-pointer", mine ? "focus-visible:outline-ink-fg" : "focus-visible:outline-fg")}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setScrubbing(false)}
          onKeyDown={onKey}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={formatDuration(time)}
          aria-label="Ijro holati"
        >
          {bars.map((h, i) => (
            <span key={i} className={cn("w-[3px] flex-1 rounded-full transition-opacity", i / BARS <= progress ? "opacity-100" : "opacity-35", mine ? "bg-ink-fg" : "bg-fg")} style={{ height: `${Math.round(h * 100)}%` }} />
          ))}
        </div>
        <div className={cn("mt-0.5 flex items-center justify-between text-[11px] tabular-nums", mine ? "text-ink-fg/70" : "text-fg-3")}>
          <span>{formatDuration(shown)}</span>
          <button type="button" onClick={cycleRate} className={cn("rounded-full px-1.5 font-semibold transition hover:opacity-80", mine ? "bg-ink-fg/15" : "bg-fg/8")} aria-label={`Tezlik ${rate}× — almashtirish`}>
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
          <video key={a.url} src={a.url} controls preload="metadata" playsInline onPlay={(e) => claimMedia(e.currentTarget)} className="max-h-64 w-full rounded-[10px] bg-black/20" title={a.name} />
        ) : isImageAttachment(a) ? (
          <a key={a.url} href={a.url} target="_blank" rel="noopener" className="block overflow-hidden rounded-[10px]" aria-label={`${a.name} — rasmni ochish`}>
            <SafeImage src={a.url} alt={a.name} width={360} height={240} className="h-auto max-h-56 w-full object-cover" />
          </a>
        ) : (
          <a
            key={a.url}
            href={a.url}
            target="_blank"
            rel="noopener"
            download={a.name}
            className={cn("flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] font-semibold transition", mine ? "bg-ink-fg/10 hover:bg-ink-fg/15" : "bg-fg/5 hover:bg-fg/8")}
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[9.5px] font-bold tracking-wide", mine ? "bg-ink-fg/15" : "bg-surface")}>{attachmentExt(a)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{a.name}</span>
              {a.size > 0 && <span className={cn("block text-[11px] font-normal", mine ? "text-ink-fg/60" : "text-fg-4")}>{formatBytes(a.size)}</span>}
            </span>
          </a>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matn: havolalar bosiladigan + birinchi havola kartasi                */
/* ------------------------------------------------------------------ */
const URL_RE = /(https?:\/\/[^\s<>"'()]+)/g;

/** Matndagi http(s) havolalarni bosiladigan qilish (boshqa hech qanday HTML yo'q); uzun havola 390px'da sinadi */
export function Linkified({ text, mine }: { text: string; mine?: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className={cn("break-all underline decoration-1 underline-offset-2", mine ? "text-ink-fg" : "text-fg")}>
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const previewCache = new Map<string, Promise<LinkPreviewView | null>>();
function getPreview(url: string): Promise<LinkPreviewView | null> {
  let p = previewCache.get(url);
  if (!p) {
    p = fetch(`/api/chat/preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((j) => (j?.ok ? (j.data.preview as LinkPreviewView | null) : null))
      .catch(() => null);
    previewCache.set(url, p);
  }
  return p;
}

/** Havola kartasi — server OG prevyusi bo'lsa ko'rinadi, bo'lmasa hech narsa */
export function LinkCard({ url, mine }: { url: string; mine: boolean }) {
  const [p, setP] = useState<LinkPreviewView | null>(null);
  useEffect(() => {
    let on = true;
    void getPreview(url).then((v) => on && setP(v));
    return () => {
      on = false;
    };
  }, [url]);
  if (!p) return null;
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn("expand-in mt-1.5 flex max-w-[320px] items-stretch gap-2.5 overflow-hidden rounded-[10px] border-l-[3px] px-2.5 py-2 text-left transition", mine ? "border-ink-fg/40 bg-ink-fg/10 hover:bg-ink-fg/15" : "border-fg/30 bg-fg/5 hover:bg-fg/8")}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[11px] font-semibold uppercase tracking-wide", mine ? "text-ink-fg/60" : "text-fg-4")}>{p.site}</span>
        <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug">{p.title}</span>
        {p.description && <span className={cn("line-clamp-2 text-[12px] leading-snug", mine ? "text-ink-fg/70" : "text-fg-3")}>{p.description}</span>}
      </span>
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[8px] object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
      )}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Reaksiyalar                                                          */
/* ------------------------------------------------------------------ */
/** Xabar ostidagi reaksiya chiplari — bosilsa o'zimniki qo'shiladi/olinadi */
export function ReactionChips({ reactions, mine, onToggle }: { reactions: ReactionSummary[]; mine: boolean; onToggle?: (emoji: string) => void }) {
  if (!reactions.length) return null;
  return (
    <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")} aria-label="Reaksiyalar">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle?.(r.emoji)}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? " — sizniki" : ""}`}
          className={cn(
            "press inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[12px] leading-none transition",
            r.mine ? "border-fg bg-surface text-fg" : "border-line bg-surface text-fg-2 hover:border-fg",
          )}
        >
          <span key={r.count} className="animate-badge-pop">
            {r.emoji}
          </span>
          {r.count > 1 && <span className="font-semibold tabular-nums">{r.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Reaksiya tanlash qatori (menyu ichida) */
export function ReactionPicker({ current, onPick }: { current?: string | null; onPick: (emoji: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-1" role="group" aria-label="Reaksiya tanlash">
      {DM_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          aria-label={e}
          aria-pressed={current === e}
          className={cn("press flex h-9 w-9 items-center justify-center rounded-full text-[18px] transition hover:bg-fg/8 focus-visible:outline-2 focus-visible:outline-fg", current === e && "bg-fg/8")}
        >
          {e}
        </button>
      ))}
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
      className={cn("mb-1.5 flex w-full min-w-0 max-w-full items-stretch gap-2 rounded-[10px] border-l-[3px] border-accent px-2.5 py-1.5 text-left transition", mine ? "bg-ink-fg/10 hover:bg-ink-fg/15" : "bg-accent-soft/70 hover:bg-accent-soft", className)}
      title="Asl xabarga o'tish"
    >
      <span className="block min-w-0 flex-1 overflow-hidden">
        {q.senderName && <span className={cn("block truncate text-[11.5px] font-bold", mine ? "text-ink-fg" : "text-accent-text")}>{q.senderName}</span>}
        <span className={cn("flex min-w-0 items-center gap-1 text-[12.5px]", mine ? "text-ink-fg/80" : "text-fg-2")}>
          {Icon && <Icon size={12} className="shrink-0" />}
          <span className="block min-w-0 flex-1 truncate">{q.body || "…"}</span>
        </span>
      </span>
    </button>
  );
}

/** Kompozitor ustidagi "Javob:" paneli (chiqish animatsiyasi uchun `closing`) */
export function ReplyBar({ q, onCancel, closing }: { q: QuoteView; onCancel: () => void; closing?: boolean }) {
  const Icon = KIND_ICON[q.kind];
  return (
    <div className={cn(closing ? "expand-out" : "expand-in", "mb-2 flex items-center gap-2 rounded-[12px] border-l-[3px] border-accent bg-accent-soft/60 py-1.5 pl-3 pr-1")} role="status">
      <CornerUpLeft size={14} className="shrink-0 text-accent" />
      <span className="block min-w-0 flex-1 overflow-hidden">
        <span className="block truncate text-[11.5px] font-bold text-accent-text">{q.senderName ? `Javob: ${q.senderName}` : "Javob"}</span>
        <span className="flex min-w-0 items-center gap-1 text-[12.5px] text-fg-2">
          {Icon && <Icon size={12} className="shrink-0" />}
          <span className="block min-w-0 flex-1 truncate">{q.body || "…"}</span>
        </span>
      </span>
      <button type="button" onClick={onCancel} aria-label="Javobni bekor qilish" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/8 hover:text-fg focus-visible:outline-2 focus-visible:outline-fg">
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
/* Kun ajratuvchisi (yopishqoq pill) va "Yozmoqda…"                     */
/* ------------------------------------------------------------------ */
export function DayPill({ label }: { label: string }) {
  return (
    <div className="pointer-events-none sticky top-0 z-[1] flex justify-center py-1" role="separator" aria-label={label}>
      <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-fg-3">{label}</span>
    </div>
  );
}

export function TypingDots({ label, closing }: { label: string; closing?: boolean }) {
  return (
    <p className={cn(closing ? "expand-out" : "expand-in", "flex items-center gap-2 px-1 text-[12.5px] font-medium text-fg-3")} role="status">
      <span className="typing-dots inline-flex items-center gap-[3px] rounded-full bg-fg/6 px-2 py-1.5 text-fg-3" aria-hidden>
        <span />
        <span />
        <span />
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

/* ------------------------------------------------------------------ */
/* Yordamchi hook: nisbiy vaqtlar yangilanib turishi uchun tik          */
/* ------------------------------------------------------------------ */
export function useNowTick(ms = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
