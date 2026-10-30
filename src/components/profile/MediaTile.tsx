import { Eye, Heart, Images, MessageCircle, Pin, Play, Quote } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { POST_OYNA } from "@/lib/i18n/dict/profile";
import { cn, compactCount } from "@/lib/utils";

/** Kvadrat plitka (Instagram katagi): rasm / video / faqat matn; burchakda video, "bir nechta" va qadalgan belgilari, hover'da like/izoh sonlari */
export interface MediaTileData {
  thumbUrl: string | null;
  videoUrl: string | null;
  isVideo: boolean;
  textOnly: boolean;
  /** Media soni (1+ — "bir nechta" belgisi uchun) */
  count: number;
  caption: string;
  likes?: number;
  comments?: number;
  /** Ko'rishlar — plitka pastki chap burchagida (Telegram/Reels uslubi) */
  views?: number;
  /** Profilga qadalgan post */
  pinned?: boolean;
}

const PLAYABLE = /\.(?:mp4|webm|mov)(?:$|\?)/i;

export function MediaTile({ d, className, rounded = true, til = "uz" }: { d: MediaTileData; className?: string; rounded?: boolean; til?: Locale }) {
  const playable = Boolean(d.videoUrl && PLAYABLE.test(d.videoUrl));
  return (
    // img-zoom — hover'da rasm/video yumshoq kattalashadi (token; reduced-motion'da o'chadi)
    <div className={cn("group/tile img-zoom relative aspect-square w-full overflow-hidden bg-surface-3", rounded && "sm:rounded-[var(--r-md)]", className)}>
      {d.textOnly ? (
        <div className="flex h-full w-full flex-col justify-between bg-ink p-3 text-left text-ink-fg sm:p-4">
          <Quote size={16} className="shrink-0 text-accent" aria-hidden />
          <p className="line-clamp-5 text-[13px] leading-snug sm:text-[14px]">{d.caption}</p>
        </div>
      ) : d.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.thumbUrl} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover text-transparent" />
      ) : playable ? (
        <video src={d.videoUrl ? `${d.videoUrl}#t=0.5` : undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-fg-3">
          <Play size={28} aria-hidden />
        </div>
      )}
      {(d.pinned || (!d.textOnly && (d.isVideo || d.count > 1))) && (
        <div className={cn("absolute right-2 top-2 flex gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]", d.textOnly ? "text-ink-fg" : "text-white")}>
          {d.pinned && <Pin size={15} className="fill-current" aria-label={POST_OYNA.pinned[til]} />}
          {!d.textOnly && d.isVideo && <Play size={16} className="fill-current" aria-hidden />}
          {!d.textOnly && d.count > 1 && <Images size={16} aria-hidden />}
        </div>
      )}
      {d.views !== undefined && d.views > 0 && !d.textOnly && (
        <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white" aria-label={POST_OYNA.views[til](d.views)}>
          <Eye size={11} aria-hidden /> {compactCount(d.views)}
        </span>
      )}
      {(d.likes !== undefined || d.comments !== undefined) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 bg-black/45 text-[14px] font-bold text-white opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100" aria-hidden>
          {d.likes !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <Heart size={16} className="fill-current" /> {d.likes}
            </span>
          )}
          {d.comments !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle size={16} className="fill-current" /> {d.comments}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
