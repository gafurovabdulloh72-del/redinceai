"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";
import type { PostMusic } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/** Post musiqasi: «♪ nom — ijrochi» chipi, bosilganda chaladi/to'xtatadi (bir vaqtda faqat bitta trek) */
export function MusicChip({ music, className }: { music: PostMusic; className?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const stop = (e: Event) => {
      if ((e as CustomEvent).detail !== ref.current) ref.current?.pause();
    };
    window.addEventListener("ke-music-play", stop);
    return () => window.removeEventListener("ke-music-play", stop);
  }, []);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      window.dispatchEvent(new CustomEvent("ke-music-play", { detail: a }));
      if (music.start && a.currentTime < music.start) a.currentTime = music.start;
      void a.play().catch(() => undefined);
    } else a.pause();
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={playing} aria-label={`${playing ? "To'xtatish" : "Chalish"}: ${music.title}`} className={cn("press inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-2/70 py-1 pl-1 pr-3 text-[12.5px] font-medium text-fg-2 transition hover:border-line-2", className)}>
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-white", playing ? "bg-accent" : "bg-fg/70")}>{playing ? <Pause size={11} /> : <Play size={11} className="ml-px" />}</span>
      <Music2 size={13} className="shrink-0 text-fg-3" aria-hidden="true" />
      <span className="truncate">
        {music.title}
        {music.artist ? ` — ${music.artist}` : ""}
      </span>
      <audio ref={ref} src={music.url} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    </button>
  );
}
