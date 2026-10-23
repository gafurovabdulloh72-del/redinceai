"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Dars videosi: tezlik tanlash (eslab qoladi), vaqt belgilari (bosilsa shu joyga o'tadi), to'xtagan joydan davom etish */
export function LessonPlayer({ lessonId, videoUrl, chapters }: { lessonId: string; videoUrl: string | null; chapters: Array<{ t: number; title: string }> }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const [now, setNow] = useState(0);
  const posKey = `kasb_pos_${lessonId}`;

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
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={ref} src={videoUrl} controls controlsList="nodownload noremoteplayback" disablePictureInPicture onContextMenu={(e) => e.preventDefault()} playsInline onLoadedMetadata={onLoaded} onTimeUpdate={onTime} className="aspect-video w-full rounded-[16px] bg-black" />
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
