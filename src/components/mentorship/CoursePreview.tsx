"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, GraduationCap, Link2, Play } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS, formatDurationTr } from "@/lib/i18n/dict/mentorship";

export type PreviewVideo = { lessonId: string; title: string; url: string; durationMin: number };

/**
 * Kurs sahifasi hero (Udemy «Preview this course»): muqova ustida «Kursni ko'rib chiqish» tugmasi — bosilganda
 * birinchi bepul namuna darsining videosi shu yerning o'zida o'ynaydi (sahifa almashmaydi), ostida darsga havola.
 * Namuna video bo'lmasa — oddiy muqova.
 */
export function CoursePreview({ coverUrl, title, preview }: { coverUrl: string | null; title: string; preview: PreviewVideo | null }) {
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const til = useLocale();

  if (playing && preview) {
    return (
      <div className="card overflow-hidden">
        <div className="relative aspect-video bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={preview.url} controls autoPlay playsInline controlsList="nodownload" className="h-full w-full bg-black" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
          <span className="min-w-0 truncate text-fg-2">
            <span className="font-semibold text-fg">{tr(til, MS.freeSample)}</span> {preview.title}
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            {/* Kamchilik #30: bepul namunani alohida havola bilan ulashish (marketing) */}
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/mentorlik/dars/${preview.lessonId}`;
                navigator.clipboard
                  .writeText(url)
                  .then(() => {
                    setCopied(true);
                    toast(tr(til, MS.sampleCopied), "success");
                    window.setTimeout(() => setCopied(false), 1800);
                  })
                  .catch(() => toast(url, "info"));
              }}
              className="inline-flex items-center gap-1 font-semibold text-fg-3 transition hover:text-fg"
              title={tr(til, MS.copySample)}
            >
              {copied ? <Check size={13} className="text-success-text" /> : <Link2 size={13} />} {tr(til, MS.share)}
            </button>
            <Link href={`/mentorlik/dars/${preview.lessonId}`} className="inline-flex items-center gap-1 font-semibold text-fg underline-offset-2 hover:underline">
              {tr(til, MS.goToLesson)} <ArrowUpRight size={13} />
            </Link>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video bg-surface-2">
        {coverUrl ? (
          <SafeImage optimize={720} src={coverUrl} alt={title} width={900} height={506} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-fg/5">
            <GraduationCap size={40} className="text-fg-4" />
          </div>
        )}
        {preview && (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`${tr(til, MS.previewCourse)} — ${preview.title}`} className="group absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/30 text-white transition hover:bg-black/40">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-lg transition group-hover:scale-105 group-active:scale-95">
              <Play size={26} className="ml-1 fill-current" />
            </span>
            <span className="rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold backdrop-blur-sm">
              {tr(til, MS.previewCourse)}{preview.durationMin > 0 ? ` · ${formatDurationTr(til, preview.durationMin)}` : ""}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
