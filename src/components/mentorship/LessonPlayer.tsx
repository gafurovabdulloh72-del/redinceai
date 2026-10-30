"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/components/motion/haptics";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Video tugagach keyingi darsga avto-o'tish sanog'i (soniya) — Udemy/YouTube odati */
const AUTONEXT_SEC = 6;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Dars videosi: tezlik tanlash (eslab qoladi), vaqt belgilari (bosilsa shu joyga o'tadi), to'xtagan joydan davom etish,
 *  tugagach «Keyingi dars» sanog'i (bekor qilish mumkin; o'chirilsa eslab qoladi) */
export function LessonPlayer({ lessonId, videoUrl, chapters, next = null }: { lessonId: string; videoUrl: string | null; chapters: Array<{ t: number; title: string }>; next?: { id: string; title: string } | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const [speed, setSpeed] = useState(1);
  const [now, setNow] = useState(0);
  const [left, setLeft] = useState<number | null>(null); // avto-o'tish sanog'i (null — ko'rinmaydi)
  const [autoNext, setAutoNext] = useState(true);
  const posKey = `kasb_pos_${lessonId}`;

  useEffect(() => {
    try {
      if (localStorage.getItem("kasb_autonext") === "0") setAutoNext(false);
    } catch {
      /* noop */
    }
  }, []);
  // Sanoq: har soniya kamayadi, 0 bo'lganda keyingi darsga o'tadi
  useEffect(() => {
    if (left === null || !next) return;
    if (left <= 0) {
      router.push(`/mentorlik/dars/${next.id}`);
      return;
    }
    const t = setTimeout(() => setLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, next, router]);

  function onEnded() {
    try {
      localStorage.removeItem(posKey); // qayta ochilganda boshidan
    } catch {
      /* noop */
    }
    if (next && autoNext) setLeft(AUTONEXT_SEC);
  }
  function cancelAuto(remember: boolean) {
    setLeft(null);
    if (remember) {
      setAutoNext(false);
      try {
        localStorage.setItem("kasb_autonext", "0");
      } catch {
        /* noop */
      }
    }
  }

  useEffect(() => {
    try {
      const sp = Number(localStorage.getItem("kasb_speed"));
      if (SPEEDS.includes(sp)) setSpeed(sp);
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);

  function onLoaded() {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = speed;
    try {
      const p = Number(localStorage.getItem(posKey));
      if (p > 5 && p < v.duration - 5) v.currentTime = p;
    } catch {
      /* noop */
    }
  }
  const lastSave = useRef(0);
  function onTime() {
    const v = ref.current;
    if (!v) return;
    setNow(Math.floor(v.currentTime));
    if (Date.now() - lastSave.current > 4000) {
      lastSave.current = Date.now();
      try {
        localStorage.setItem(posKey, String(Math.floor(v.currentTime)));
      } catch {
        /* noop */
      }
    }
  }
  function seek(t: number) {
    const v = ref.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => undefined);
  }
  const activeIdx = chapters.reduce((a, c, i) => (now >= c.t ? i : a), -1);

  if (!videoUrl) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-[16px] bg-fg/5">
        <PlayCircle size={34} className="text-fg-4" />
      </div>
    );
  }
  return (
    <div>
      <div className="relative overflow-hidden rounded-[16px] bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={ref} src={videoUrl} controls={left === null} controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} playsInline onLoadedMetadata={onLoaded} onTimeUpdate={onTime} onEnded={onEnded} onPlay={() => setLeft(null)} className="aspect-video w-full bg-black" />
        {left !== null && next && (
          /* Video tugadi — keyingi dars kartasi (sanoq halqasi + bekor qilish). Parda bg-black/.. — bg-ink qorong'uda krem bo'ladi */
          <div className={cn("absolute inset-0 grid place-items-center bg-black/70 p-3 text-white sm:p-4", !prefersReducedMotion() && "pop-in")} role="status" aria-live="polite">
            <div className="w-full max-w-[320px] text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60 sm:text-[11.5px]">Keyingi dars</p>
              <p className="mt-0.5 line-clamp-1 text-[14px] font-bold leading-snug sm:mt-1 sm:line-clamp-2 sm:text-[15px]">{next.title}</p>
              <button type="button" onClick={() => setLeft(0)} aria-label={`Keyingi darsga o'tish — ${left} soniya`} className="relative mx-auto mt-2 grid h-12 w-12 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 sm:mt-4 sm:h-16 sm:w-16">
                <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 29} strokeDashoffset={(2 * Math.PI * 29 * (AUTONEXT_SEC - left)) / AUTONEXT_SEC} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
                </svg>
                <SkipForward size={20} className="fill-current" />
              </button>
              <p className="mt-1.5 text-[12px] tabular-nums text-white/70 sm:mt-2 sm:text-[12.5px]">{left} soniyadan keyin</p>
              <div className="mt-2 flex items-center justify-center gap-2 text-[12.5px] sm:mt-3">
                <button type="button" onClick={() => cancelAuto(false)} className="inline-flex h-8 items-center gap-1 rounded-full border border-white/25 px-3 font-semibold transition hover:bg-white/10 sm:h-9 sm:px-3.5">
                  <X size={14} /> Bekor qilish
                </button>
                <button type="button" onClick={() => cancelAuto(true)} className="h-8 rounded-full px-2.5 text-white/60 transition hover:text-white sm:h-9 sm:px-3">
                  Avto-o&apos;tishni o&apos;chirish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[12.5px] text-fg-3">
        <span className="font-semibold">Tezlik:</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSpeed(s);
              try {
                localStorage.setItem("kasb_speed", String(s));
              } catch {
                /* noop */
              }
            }}
            className={cn("rounded-md px-2 py-1 font-semibold tabular-nums transition", speed === s ? "bg-fg text-bg" : "bg-fg/6 text-fg-2 hover:bg-fg/10")}
          >
            {s}×
          </button>
        ))}
      </div>
      {chapters.length > 0 && (
        <ol className="mt-3 divide-y divide-line rounded-[14px] border border-line">
          {chapters.map((c, i) => (
            <li key={`${c.t}-${i}`}>
              <button type="button" onClick={() => seek(c.t)} className={cn("flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] transition hover:bg-fg/[0.04]", i === activeIdx && "bg-accent-soft/50")}>
                <span className="w-11 shrink-0 font-semibold tabular-nums text-accent-text">{fmt(c.t)}</span>
                <span className={cn("min-w-0 flex-1 truncate", i === activeIdx ? "font-semibold text-fg" : "text-fg-2")}>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
