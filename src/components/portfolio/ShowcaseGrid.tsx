"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { useScrollLock } from "@/components/motion/useScrollLock";

export interface ShowcaseItem {
  id: string;
  title: string;
  type: "image" | "video" | "link";
  url: string;
  thumbnailUrl: string | null;
}

function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}
const isFile = (url: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || url.startsWith("/uploads/") || /blob\.vercel-storage\.com|r2\.dev|\/api\/media\//.test(url);

function thumbOf(it: ShowcaseItem): string | null {
  if (it.thumbnailUrl) return it.thumbnailUrl;
  if (it.type === "image") return it.url;
  const yt = it.type === "video" ? youtubeId(it.url) : null;
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

/** Plitka: tik ish — 9:16, gorizontal ish (rasm/video o'lchami yuklanganda aniqlanadi) — ikki ustun kenglikda, balandligi bir xil.
 *  Video — sichqoncha ustida ovozsiz o'ynaydi; ustiga borganda marjon ramka va ish nomi */
function Tile({ it, onOpen, index }: { it: ShowcaseItem; onOpen: () => void; index: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [wide, setWide] = useState(false);
  const [failed, setFailed] = useState(false);
  const thumb = failed ? null : thumbOf(it);
  const playable = it.type === "video" && isFile(it.url);
  const ytThumb = it.type === "video" && !playable && Boolean(youtubeId(it.url)) && !it.thumbnailUrl;
  const play = () => void ref.current?.play().catch(() => undefined);
  const stop = () => {
    const v = ref.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };
  const measure = (w: number, h: number) => w > 0 && h > 0 && setWide(w / h > 1.15);
  // Rasm gidratsiyadan OLDIN yuklanib (yoki yiqilib) bo'lgan bo'lsa onLoad/onError ishlamaydi — holatni o'zimiz o'qiymiz
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const im = imgRef.current;
    if (!im || !im.complete) return;
    if (im.naturalWidth === 0) setFailed(true);
    else measure(im.naturalWidth, im.naturalHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={playable ? play : undefined}
      onMouseLeave={playable ? stop : undefined}
      onFocus={playable ? play : undefined}
      onBlur={playable ? stop : undefined}
      className={`group relative animate-fade-up overflow-hidden rounded-[12px] bg-white/[0.05] text-left outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_2px_#ff5a36,0_20px_40px_-20px_rgba(255,90,54,0.6)] focus-visible:shadow-[0_0_0_2px_#ff5a36] ${wide || ytThumb ? "col-span-2 aspect-[18/16]" : "aspect-[9/16]"}`}
      style={{ animationDelay: `${Math.min(index, 18) * 40}ms` }}
      aria-label={it.title}
    >
      {playable ? (
        <video
          ref={ref}
          src={`${it.url}${it.url.includes("#") ? "" : "#t=0.1"}`}
          poster={thumb ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => measure(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={imgRef} src={thumb} alt="" loading="lazy" onError={() => setFailed(true)} onLoad={(e) => measure(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        // Rasm yo'q yoki ochilmadi — iliq gradient va ish nomi (buzilgan rasm belgisi ko'rinmasin)
        <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#3a2416_0%,#1e140d_70%)] p-3 text-center text-[13px] font-bold leading-snug text-[#f6ebe0]/80" data-no-auto>
          {it.title}
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-[13px] font-bold leading-tight text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="line-clamp-2" data-no-auto>
          {it.title}
        </span>
      </span>
    </button>
  );
}

/** Katta ko'rish oynasi: video (fayl yoki YouTube), rasm, havola; ← → bilan almashtirish, Esc — yopish */
function Viewer({ items, index, onClose, onMove }: { items: ShowcaseItem[]; index: number; onClose: () => void; onMove: (d: 1 | -1) => void }) {
  const it = items[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onMove]);
  useScrollLock(true);
  const yt = it.type === "video" ? youtubeId(it.url) : null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={it.title} className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Yopish">
        <X size={18} />
      </button>
      {items.length > 1 && (
        <>
          <button type="button" onClick={(e) => (e.stopPropagation(), onMove(-1))} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Oldingi">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={(e) => (e.stopPropagation(), onMove(1))} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Keyingi">
            <ChevronRight size={20} />
          </button>
        </>
      )}
      <figure key={it.id} className="flex max-h-full max-w-full flex-col items-center gap-3 animate-modal-in" onClick={(e) => e.stopPropagation()}>
        {it.type === "video" && yt ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`} title={it.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="aspect-video w-[min(92vw,1100px)] rounded-[12px] bg-black" />
        ) : it.type === "video" && isFile(it.url) ? (
          <video src={it.url} poster={it.thumbnailUrl ?? undefined} controls autoPlay playsInline className="max-h-[82vh] max-w-[92vw] rounded-[12px] bg-black" />
        ) : it.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.url} alt={it.title} className="max-h-[82vh] max-w-[92vw] rounded-[12px] object-contain" />
        ) : (
          <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-full bg-[#ff5a36] px-6 py-3 font-semibold text-white">
            Ochish <ExternalLink size={16} />
          </a>
        )}
        <figcaption className="max-w-[92vw] text-center text-[14px] font-semibold text-white/85" data-no-auto>
          {it.title}
          <span className="ml-2 font-normal text-white/45">
            {index + 1} / {items.length}
          </span>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}

export function ShowcaseGrid({ items }: { items: ShowcaseItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const move = useCallback((d: 1 | -1) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);
  const close = useCallback(() => setOpen(null), []);
  return (
    <>
      <div className="grid grid-flow-dense grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:gap-3.5">
        {items.map((it, i) => (
          <Tile key={it.id} it={it} index={i} onOpen={() => setOpen(i)} />
        ))}
      </div>
      {open !== null && <Viewer items={items} index={open} onClose={close} onMove={move} />}
    </>
  );
}
