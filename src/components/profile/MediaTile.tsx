import { Heart, Images, MessageCircle, Play, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kvadrat plitka (Instagram katagi): rasm / video / faqat matn; burchakda video va "bir nechta" belgilari, hover'da like/izoh sonlari */
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
}

const PLAYABLE = /\.(?:mp4|webm|mov)(?:$|\?)/i;

export function MediaTile({ d, className, rounded = true }: { d: MediaTileData; className?: string; rounded?: boolean }) {
  const playable = Boolean(d.videoUrl && PLAYABLE.test(d.videoUrl));
  return (
    <div className={cn("group/tile relative aspect-square w-full overflow-hidden bg-surface-3", rounded && "rounded-[10px] sm:rounded-[14px]", className)}>
      {d.textOnly ? (
        <div className="flex h-full w-full flex-col justify-between bg-ink p-3 text-left text-ink-fg sm:p-4">
          <Quote size={16} className="shrink-0 text-accent" aria-hidden />
          <p className="line-clamp-5 text-[13px] leading-snug sm:text-[14px]">{d.caption}</p>
        </div>
      ) : d.thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.thumbUrl} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover text-transparent transition-transform duration-500 group-hover/tile:scale-[1.04]" />
      ) : playable ? (
        <video src={d.videoUrl ?? undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-fg-3">
          <Play size={28} aria-hidden />
        </div>
      )}
      {!d.textOnly && (d.isVideo || d.count > 1) && (
        <div className="absolute right-2 top-2 flex gap-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" aria-hidden>
          {d.isVideo && <Play size={16} className="fill-current" />}
          {d.count > 1 && <Images size={16} />}
        </div>
      )}
      {(d.likes !== undefined || d.comments !== undefined) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-4 bg-ink/45 text-[14px] font-bold text-white opacity-0 transition-opacity duration-200 group-hover/tile:opacity-100" aria-hidden>
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
