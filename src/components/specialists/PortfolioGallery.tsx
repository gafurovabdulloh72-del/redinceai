"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, ImageIcon, Images, Link2, Maximize2, Play, X } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { SafeImage } from "./SafeImage";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cn, hashHue, youtubeId } from "@/lib/utils";

export interface GalleryItem {
  id: string;
  title: string;
  type: "image" | "video" | "link";
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
}

function thumbFor(item: GalleryItem) {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (item.type === "image") return item.url;
  if (item.type === "video") {
    const id = youtubeId(item.url);
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Rasm yuklanmasa gradient + ikonka ko'rsatadigan plitka tasviri */
function Thumb({ item, className }: { item: GalleryItem; className?: string }) {
  const src = thumbFor(item);
  const hue = hashHue(item.id);
  const Icon = item.type === "video" ? Play : item.type === "link" ? Link2 : ImageIcon;

  // Rasm yo'q/yuklanmadi: tinch neytral yuza + nozik rangli nur (rang-barang gradient o'rniga)
  const fallback = (
    <div
      className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-3 transition duration-700 group-hover:scale-105", className)}
      aria-hidden
    >
      <span className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-40 blur-2xl" style={{ background: `hsl(${hue} 70% 60%)` }} />
      <span className="card flex h-12 w-12 items-center justify-center !rounded-[16px] text-fg-2">
        <Icon size={20} />
      </span>
    </div>
  );

  if (!src) return fallback;
  return (
    <SafeImage
      src={src}
      alt={item.title}
      loading="lazy"
      fallback={fallback}
      className={cn("h-full w-full object-cover transition duration-700 group-hover:scale-105", className)}
    />
  );
}

export function PortfolioGallery({ items }: { items: GalleryItem[] }) {
  const viewable = useMemo(() => items.filter((i) => i.type !== "link"), [items]);
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = openId ? viewable.findIndex((i) => i.id === openId) : -1;

  if (items.length === 0) {
    return <EmptyState icon={Images} title="Portfolio hali bo'sh" description="Mutaxassis ishlarini tez orada joylaydi." />;
  }

  return (
    <>
      {/* Bir xil nisbatli (4:3) grid — bo'sh joysiz, tartibli */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {items.map((item) => {
          const tileCls = "card card-hover group relative block w-full overflow-hidden !rounded-[20px] p-0 text-left";
          const inner = (
            <>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[inherit] bg-surface-3">
                <Thumb item={item} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-90 transition group-hover:opacity-100" />

                {item.type === "video" && (
                  <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg shadow-[var(--shadow-2)] transition group-hover:scale-110">
                    <Play size={18} className="ml-0.5 fill-current" />
                  </span>
                )}
                {item.type === "link" && (
                  <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-fg shadow-[var(--shadow-1)]">
                    <ArrowUpRight size={15} />
                  </span>
                )}
                {item.type !== "link" && (
                  <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition group-hover:opacity-100">
                    <Maximize2 size={14} />
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-white drop-shadow">{item.title}</p>
                  {item.type === "link" && <p className="mt-0.5 truncate text-[11px] text-white/75">{hostOf(item.url)}</p>}
                </div>
              </div>
            </>
          );

          if (item.type === "link") {
            return (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer noopener" className={tileCls} aria-label={`${item.title} — yangi oynada ochiladi`}>
                {inner}
              </a>
            );
          }
          return (
            <button key={item.id} type="button" onClick={() => setOpenId(item.id)} className={tileCls} aria-label={`${item.title} — kattalashtirish`}>
              {inner}
            </button>
          );
        })}
      </div>

      {openIndex >= 0 && (
        <Lightbox
          items={viewable}
          index={openIndex}
          onClose={() => setOpenId(null)}
          onNavigate={(i) => setOpenId(viewable[i]?.id ?? null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Lightbox — butun ekranli shisha qatlam                              */
/* ------------------------------------------------------------------ */
function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const item = items[index];
  const total = items.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [broken, setBroken] = useState(false);

  const prev = useCallback(() => onNavigate((index - 1 + total) % total), [index, total, onNavigate]);
  const next = useCallback(() => onNavigate((index + 1) % total), [index, total, onNavigate]);

  // Fokus dialog ichida qoladi (Tab aylanadi), yopilganda avvalgi elementga qaytadi
  useFocusTrap(dialogRef, mounted, closeRef);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => setBroken(false), [item?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && total > 1) prev();
      else if (e.key === "ArrowRight" && total > 1) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next, total]);

  if (!mounted || !item) return null;

  const ytId = item.type === "video" ? youtubeId(item.url) : null;

  const node = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="card-elevated fixed inset-0 z-[100] flex flex-col !rounded-none !border-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Yuqori panel */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <span className="card pill px-3 py-1 text-[12px] font-semibold tabular-nums text-fg-2">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          {item.type === "video" && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="card pill card-hover hidden h-10 items-center gap-1.5 px-4 text-[13px] font-semibold text-fg sm:inline-flex"
            >
              YouTube'da ochish <ArrowUpRight size={14} />
            </a>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Yopish (Esc)"
            className="card pill card-hover flex h-10 w-10 items-center justify-center text-fg"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Kontent */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-20" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Oldingi"
              className="card pill card-hover absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg sm:left-6"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Keyingi"
              className="card pill card-hover absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg sm:right-6"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        <div key={item.id} className="animate-fade-up flex max-h-full w-full max-w-5xl items-center justify-center" style={{ animationDuration: "0.35s" }}>
          {item.type === "video" && ytId ? (
            <div className="card aspect-video w-full overflow-hidden !rounded-[22px] !bg-black/80">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : item.type === "video" ? (
            <a href={item.url} target="_blank" rel="noreferrer noopener" className="card card-hover flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-3 !rounded-[22px] text-fg">
              <span className="btn-ink flex h-14 w-14 items-center justify-center rounded-full">
                <Play size={22} className="ml-0.5 fill-current" />
              </span>
              <span className="text-[14px] font-semibold">Videoni yangi oynada ochish</span>
            </a>
          ) : broken ? (
            <div className="card flex aspect-[4/3] w-full max-w-2xl flex-col items-center justify-center gap-2 !rounded-[22px] text-fg-3">
              <ImageIcon size={36} />
              <span className="text-[13px]">Rasm yuklanmadi</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.title}
              onError={() => setBroken(true)}
              className="max-h-[calc(100dvh-220px)] w-auto max-w-full rounded-[22px] object-contain shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
            />
          )}
        </div>
      </div>

      {/* Izoh */}
      <div className="px-4 pb-5 pt-3 sm:px-6" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="card mx-auto max-w-2xl px-5 py-3.5 !rounded-[20px]">
          <p className="text-[15px] font-semibold text-fg">{item.title}</p>
          {item.description && <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-fg-2">{item.description}</p>}
          {total > 1 && <p className="mt-1.5 hidden text-[11px] text-fg-4 sm:block">← → tugmalari bilan o'ting · Esc — yopish</p>}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
