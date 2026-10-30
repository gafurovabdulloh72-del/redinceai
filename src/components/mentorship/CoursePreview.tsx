"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, GraduationCap, Play } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { formatDuration } from "@/lib/mentorship/format";

export type PreviewVideo = { lessonId: string; title: string; url: string; durationMin: number };

/**
 * Kurs sahifasi hero (Udemy «Preview this course»): muqova ustida «Kursni ko'rib chiqish» tugmasi — bosilganda
 * birinchi bepul namuna darsining videosi shu yerning o'zida o'ynaydi (sahifa almashmaydi), ostida darsga havola.
 * Namuna video bo'lmasa — oddiy muqova.
 */
export function CoursePreview({ coverUrl, title, preview }: { coverUrl: string | null; title: string; preview: PreviewVideo | null }) {
  const [playing, setPlaying] = useState(false);

  if (playing && preview) {
    return (
      <div className="card overflow-hidden">
        <div className="relative aspect-video bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={preview.url} controls autoPlay playsInline controlsList="nodownload" className="h-full w-full bg-black" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
          <span className="min-w-0 truncate text-fg-2">
            <span className="font-semibold text-fg">Bepul namuna:</span> {preview.title}
          </span>
          <Link href={`/mentorlik/dars/${preview.lessonId}`} className="inline-flex shrink-0 items-center gap-1 font-semibold text-fg underline-offset-2 hover:underline">
            Darsga o&apos;tish <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video bg-surface-2">
        {coverUrl ? (
          <SafeImage src={coverUrl} alt={title} width={900} height={506} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-fg/5">
            <GraduationCap size={40} className="text-fg-4" />
          </div>
        )}
        {preview && (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Kursni ko'rib chiqish — ${preview.title}`} className="group absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/30 text-white transition hover:bg-black/40">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105 group-active:scale-95">
              <Play size={26} className="ml-1 fill-current" />
            </span>
            <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold backdrop-blur-sm">
              Kursni ko&apos;rib chiqish{preview.durationMin > 0 ? ` · ${formatDuration(preview.durationMin)}` : ""}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
