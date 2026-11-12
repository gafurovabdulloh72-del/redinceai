"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, SkipForward, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/components/motion/haptics";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS, secondsTr } from "@/lib/i18n/dict/mentorship";

/** Eslatmalar (LessonNotes) pleyerni shu hodisa bilan kerakli soniyaga o'tkazadi: `detail: { sec }` */
export const LESSON_SEEK_EVENT = "ke:lesson-seek";
/** Pleyer videosi shu atribut bilan belgilanadi — boshqa komponentlar joriy vaqtni o'qiydi */
export const LESSON_VIDEO_ATTR = "data-lesson-video";
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Video tugagach keyingi darsga avto-o'tish sanog'i (soniya) — Udemy/YouTube odati */
const AUTONEXT_SEC = 6;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Dars videosi: tezlik tanlash (eslab qoladi), vaqt belgilari (bosilsa shu joyga o'tadi), to'xtagan joydan davom etish,
 *  tugagach «Keyingi dars» sanog'i (bekor qilish mumkin; o'chirilsa eslab qoladi) */
export function LessonPlayer({ lessonId, videoUrl, next = null, watermark = null }: { lessonId: string; videoUrl: string | null; chapters?: Array<{ t: number; title: string }>; next?: { id: string; title: string } | null; watermark?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const til = useLocale();
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

  // Eslatmadagi vaqt belgisi bosilganda — shu joyga o'tish
  useEffect(() => {
    const on = (e: Event) => {
      const sec = (e as CustomEvent<{ sec: number }>).detail?.sec;
      const v = ref.current;
      if (!v || typeof sec !== "number") return;
      v.currentTime = Math.max(0, sec);
      void v.play().catch(() => undefined);
    };
    window.addEventListener(LESSON_SEEK_EVENT, on);
    return () => window.removeEventListener(LESSON_SEEK_EVENT, on);
  }, []);

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

  function onLoaded() {
    const v = ref.current;
    if (!v) return;
    try {
      // Saqlangan tezlik (LessonControls o'zgartiradi) — video yuklanganda qo'llanadi
      const sp = Number(localStorage.getItem("kasb_speed"));
      if (SPEEDS.includes(sp)) v.playbackRate = sp;
    } catch {
      /* noop */
    }
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
    if (Date.now() - lastSave.current > 4000) {
      lastSave.current = Date.now();
      try {
        localStorage.setItem(posKey, String(Math.floor(v.currentTime)));
      } catch {
        /* noop */
      }
    }
  }
  // SUV BELGISI (2026-11-12): ko'ruvchining ismi va qisman emaili video ustida ~12 s da joy almashtirib suzadi —
  // ekrandan yozib Telegramga «oqizilgan» kurs kimdan chiqqani ko'rinadi. To'liq ekranda ham qolishi uchun video emas,
  // uning qutisi to'liq ekranga chiqariladi (iOS'ning o'z pleyeri bundan mustasno — u yerda belgi ko'rinmaydi).
  const [wm, setWm] = useState({ x: 8, y: 10 });
  useEffect(() => {
    if (!watermark) return;
    const move = () => setWm({ x: 4 + Math.random() * 56, y: 6 + Math.random() * 74 });
    move();
    const t = setInterval(move, 12_000);
    return () => clearInterval(t);
  }, [watermark]);
  useEffect(() => {
    if (!watermark) return;
    const onFs = () => {
      const v = ref.current;
      const box = boxRef.current;
      if (!v || !box || document.fullscreenElement !== v) return;
      void document
        .exitFullscreen()
        .then(() => box.requestFullscreen())
        .catch(() => undefined);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [watermark]);

  if (!videoUrl) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-[16px] bg-fg/5">
        <PlayCircle size={34} className="text-fg-4" />
      </div>
    );
  }
  return (
    /* Telefon/planshet: video yopishqoq — tablar/eslatmalar o'qilganda ham ko'rinib turadi (YouTube/Udemy mobil odati);
       yuqori panel yashiringanda top 0 (globals.css [data-sticky-player]) */
    <div data-sticky-player="" className="max-lg:sticky max-lg:top-[calc(3.5rem+env(safe-area-inset-top))] max-lg:z-20 max-lg:-mx-4 max-lg:bg-bg max-lg:px-4 max-lg:pb-2 transition-[top] duration-200">
      <div ref={boxRef} className="relative overflow-hidden rounded-[16px] bg-black [&:fullscreen]:grid [&:fullscreen]:place-items-center [&:fullscreen]:rounded-none [&:fullscreen_video]:h-full [&:fullscreen_video]:w-full">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={ref} data-lesson-video="" src={videoUrl} controls={left === null} controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} playsInline onLoadedMetadata={onLoaded} onTimeUpdate={onTime} onEnded={onEnded} onPlay={() => setLeft(null)} className="aspect-video w-full bg-black" />
        {watermark && (
          <span
            aria-hidden
            data-no-auto
            className="pointer-events-none absolute z-10 select-none whitespace-nowrap text-[11px] font-semibold text-white/35 transition-[left,top] duration-[1400ms] ease-in-out [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] sm:text-[13px]"
            style={{ left: `${wm.x}%`, top: `${wm.y}%` }}
          >
            {watermark}
          </span>
        )}
        {left !== null && next && (
          /* Video tugadi — keyingi dars kartasi (sanoq halqasi + bekor qilish). Parda bg-black/.. — bg-ink qorong'uda krem bo'ladi */
          <div className={cn("absolute inset-0 grid place-items-center bg-black/70 p-3 text-white sm:p-4", !prefersReducedMotion() && "pop-in")} role="status" aria-live="polite">
            <div className="w-full max-w-[320px] text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60 sm:text-[11.5px]">{tr(til, MS.nextLesson)}</p>
              <p className="mt-0.5 line-clamp-1 text-[14px] font-bold leading-snug sm:mt-1 sm:line-clamp-2 sm:text-[15px]">{next.title}</p>
              <button type="button" onClick={() => setLeft(0)} aria-label={MS.nextIn[til](secondsTr(til, left))} className="relative mx-auto mt-2 grid h-12 w-12 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 sm:mt-4 sm:h-16 sm:w-16">
                <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 29} strokeDashoffset={(2 * Math.PI * 29 * (AUTONEXT_SEC - left)) / AUTONEXT_SEC} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
                </svg>
                <SkipForward size={20} className="fill-current" />
              </button>
              <p className="mt-1.5 text-[12px] tabular-nums text-white/70 sm:mt-2 sm:text-[12.5px]">{MS.afterSeconds[til](secondsTr(til, left))}</p>
              <div className="mt-2 flex items-center justify-center gap-2 text-[12.5px] sm:mt-3">
                <button type="button" onClick={() => cancelAuto(false)} className="inline-flex h-8 items-center gap-1 rounded-full border border-white/25 px-3 font-semibold transition hover:bg-white/10 sm:h-9 sm:px-3.5">
                  <X size={14} /> {tr(til, MS.cancel)}
                </button>
                <button type="button" onClick={() => cancelAuto(true)} className="h-8 rounded-full px-2.5 text-white/60 transition hover:text-white sm:h-9 sm:px-3">
                  {tr(til, MS.autoNextOff)}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tezlik va vaqt belgilari — pleyerdan ALOHIDA komponent (pleyer yopishqoq bo'lishi uchun faqat videoni o'z ichiga oladi).
 * Video elementni `data-lesson-video` orqali topadi; joriy vaqtni `timeupdate` dan o'qiydi.
 */
export function LessonControls({ chapters, hasVideo }: { chapters: Array<{ t: number; title: string }>; hasVideo: boolean }) {
  const til = useLocale();
  const [speed, setSpeed] = useState(1);
  const [now, setNow] = useState(0);
  const video = () => document.querySelector<HTMLVideoElement>(`[${LESSON_VIDEO_ATTR}]`);

  useEffect(() => {
    try {
      const sp = Number(localStorage.getItem("kasb_speed"));
      if (SPEEDS.includes(sp)) setSpeed(sp);
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    const v = video();
    if (!v) return;
    const on = () => setNow(Math.floor(v.currentTime));
    v.addEventListener("timeupdate", on);
    return () => v.removeEventListener("timeupdate", on);
  }, [hasVideo]);

  if (!hasVideo) return null;
  const activeIdx = chapters.reduce((a, c, i) => (now >= c.t ? i : a), -1);
  const pick = (s: number) => {
    setSpeed(s);
    const v = video();
    if (v) v.playbackRate = s;
    try {
      localStorage.setItem("kasb_speed", String(s));
    } catch {
      /* noop */
    }
  };
  return (
    <div>
      <div className="mt-2 flex items-center gap-2 text-[12.5px] text-fg-3">
        <span className="font-semibold">{tr(til, MS.speed)}</span>
        {SPEEDS.map((s) => (
          <button key={s} type="button" onClick={() => pick(s)} aria-pressed={speed === s} className={cn("rounded-md px-2 py-1 font-semibold tabular-nums transition", speed === s ? "bg-fg text-bg" : "bg-fg/6 text-fg-2 hover:bg-fg/10")}>
            {s}×
          </button>
        ))}
      </div>
      {chapters.length > 0 && (
        <ol className="mt-3 divide-y divide-line rounded-[14px] border border-line">
          {chapters.map((c, i) => (
            <li key={`${c.t}-${i}`}>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(LESSON_SEEK_EVENT, { detail: { sec: c.t } }))} className={cn("flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] transition hover:bg-fg/[0.04]", i === activeIdx && "bg-accent-soft/50")}>
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
