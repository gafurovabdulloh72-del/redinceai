"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ChevronLeft, ChevronRight, ChevronsLeftRight, ImageIcon, Images, Link2, Maximize2, Play, X } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { SafeImage } from "./SafeImage";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { tr } from "@/lib/i18n";
import { GALEREYA, RF_X } from "@/lib/i18n/dict/profile";
import { usePresence } from "@/components/motion/usePresence";
import { cn, hashHue, vimeoId, youtubeId } from "@/lib/utils";

export interface GalleryItem {
  id: string;
  title: string;
  type: "image" | "video" | "link";
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  /** Teglar (F61) — galereya ustida filtr chiplari */
  tags?: string[];
  /** Oldin/keyin juftligi (F63): "oldin" rasmi; url — "keyin" */
  beforeUrl?: string | null;
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
      <span className="card flex h-12 w-12 items-center justify-center !rounded-[var(--r-md)] text-fg-2">
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

export function PortfolioGallery({ items: all }: { items: GalleryItem[] }) {
  const til = useLocale();
  // Teglar (F61): ko'p uchraydiganlari birinchi; bitta ham teg bo'lmasa — chiplar ko'rinmaydi
  const tags = useMemo(() => {
    const counts = new Map<string, { label: string; n: number }>();
    for (const it of all) {
      for (const t of it.tags ?? []) {
        const k = t.toLowerCase();
        const prev = counts.get(k);
        counts.set(k, { label: prev?.label ?? t, n: (prev?.n ?? 0) + 1 });
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label)).map(([key, v]) => ({ key, ...v }));
  }, [all]);
  const [tag, setTag] = useState<string | null>(null);
  const items = useMemo(() => (tag ? all.filter((i) => (i.tags ?? []).some((t) => t.toLowerCase() === tag)) : all), [all, tag]);
  const viewable = useMemo(() => items.filter((i) => i.type !== "link"), [items]);
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = openId ? viewable.findIndex((i) => i.id === openId) : -1;
  const lb = usePresence(openIndex >= 0, 200);
  const [lastIndex, setLastIndex] = useState(0);
  useEffect(() => {
    if (openIndex >= 0) setLastIndex(openIndex);
  }, [openIndex]);

  if (all.length === 0) {
    return <EmptyState icon={Images} title={tr(til, GALEREYA.emptyTitle)} description={tr(til, GALEREYA.emptyDesc)} />;
  }

  return (
    <>
      {tags.length > 0 && (
        <div className="no-scrollbar -mx-1 mb-3 overflow-x-auto px-1">
          <div className="flex w-max gap-1.5" role="group" aria-label={tr(til, GALEREYA.tagsAria)}>
            {[{ key: null as string | null, label: tr(til, GALEREYA.all), n: all.length }, ...tags].map((t) => {
              const on = tag === t.key;
              return (
                <button
                  key={t.key ?? "_all"}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTag(t.key)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-[0.97]",
                    on ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
                  )}
                >
                  {t.key ? `#${t.label}` : t.label}
                  <span className={cn("text-[11px] tabular-nums", on ? "opacity-80" : "text-fg-4")}>{t.n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bir xil nisbatli (4:3) grid — bo'sh joysiz, tartibli */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {items.map((item) => {
          const tileCls = "card card-hover group relative block w-full overflow-hidden !rounded-[var(--r-md)] p-0 text-left";
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
                {item.type === "image" && item.beforeUrl && (
                  <span className="absolute left-2.5 top-2.5 inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-[11px] font-semibold text-fg shadow-[var(--shadow-1)]">
                    <ChevronsLeftRight size={12} aria-hidden="true" /> {tr(til, GALEREYA.beforeAfter)}
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
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer noopener" className={tileCls} aria-label={GALEREYA.opensNewWindow[til](item.title)}>
                {inner}
              </a>
            );
          }
          return (
            <button key={item.id} type="button" onClick={() => setOpenId(item.id)} className={tileCls} aria-label={GALEREYA.zoom[til](item.title)}>
              {inner}
            </button>
          );
        })}
      </div>

      {/* Chiqish animatsiyasi: yopilganda oxirgi ish 200 ms ko'rinib turadi (usePresence) */}
      {lb.mounted && (
        <Lightbox
          items={viewable}
          index={openIndex >= 0 ? openIndex : Math.min(lastIndex, Math.max(0, viewable.length - 1))}
          closing={lb.closing}
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
  closing = false,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[];
  index: number;
  /** Yopilish animatsiyasi davom etmoqda (usePresence) */
  closing?: boolean;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const til = useLocale();
  const item = items[index];
  const total = items.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [broken, setBroken] = useState(false);

  const prev = useCallback(() => onNavigate((index - 1 + total) % total), [index, total, onNavigate]);
  const next = useCallback(() => onNavigate((index + 1) % total), [index, total, onNavigate]);

  // Fokus dialog ichida qoladi (Tab aylanadi), yopilganda avvalgi elementga qaytadi
  useFocusTrap(dialogRef, mounted && !closing, closeRef);

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
  const vmId = item.type === "video" && !ytId ? vimeoId(item.url) : null;
  const pair = item.type === "image" && item.beforeUrl ? item.beforeUrl : null;

  const node = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className={cn("card-elevated fixed inset-0 z-[100] flex flex-col !rounded-none !border-0", closing ? "overlay-out" : "overlay-in")}
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
              {ytId ? tr(til, GALEREYA.openOnYoutube) : vmId ? tr(til, GALEREYA.openOnVimeo) : tr(til, GALEREYA.openSource)} <ArrowUpRight size={14} />
            </a>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={tr(til, GALEREYA.close)}
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
              aria-label={tr(til, GALEREYA.prev)}
              className="card pill card-hover absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg sm:left-6"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={tr(til, GALEREYA.next)}
              className="card pill card-hover absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg sm:right-6"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        <div key={item.id} className={cn("flex max-h-full w-full max-w-5xl items-center justify-center", closing ? "pop-out" : "pop-in")}>
          {item.type === "video" && (ytId || vmId) ? (
            <div className="card aspect-video w-full overflow-hidden !rounded-[var(--r-lg)] !bg-black/80">
              {/* YouTube — cookie'siz domen; Vimeo — dnt=1 (kuzatuvsiz). CSP frame-src ikkalasiga ruxsat beradi */}
              <iframe
                src={ytId ? `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${vmId}?autoplay=1&dnt=1`}
                title={item.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full"
              />
            </div>
          ) : pair ? (
            <BeforeAfter before={pair} after={item.url} title={item.title} />
          ) : item.type === "video" ? (
            <a href={item.url} target="_blank" rel="noreferrer noopener" className="card card-hover flex aspect-video w-full max-w-2xl flex-col items-center justify-center gap-3 !rounded-[var(--r-lg)] text-fg">
              <span className="btn-ink flex h-14 w-14 items-center justify-center rounded-full">
                <Play size={22} className="ml-0.5 fill-current" />
              </span>
              <span className="text-[14px] font-semibold">{tr(til, GALEREYA.openVideoNew)}</span>
            </a>
          ) : broken ? (
            <div className="card flex aspect-[4/3] w-full max-w-2xl flex-col items-center justify-center gap-2 !rounded-[var(--r-lg)] text-fg-3">
              <ImageIcon size={36} />
              <span className="text-[13px]">{tr(til, GALEREYA.imageFailed)}</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.title}
              onError={() => setBroken(true)}
              className="max-h-[calc(100dvh-220px)] w-auto max-w-full rounded-[var(--r-lg)] object-contain shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
            />
          )}
        </div>
      </div>

      {/* Izoh */}
      <div className="px-4 pb-5 pt-3 sm:px-6" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="card mx-auto max-w-2xl px-5 py-3.5 !rounded-[var(--r-lg)]">
          <p className="text-[15px] font-semibold text-fg">{item.title}</p>
          {item.description && <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-fg-2">{item.description}</p>}
          {total > 1 && <p className="mt-1.5 hidden text-[11px] text-fg-4 sm:block">{tr(til, RF_X.lightboxHint)}</p>}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

/* ------------------------------------------------------------------ */
/* Oldin / keyin taqqoslash slayderi (F63)                             */
/* ------------------------------------------------------------------ */
/**
 * "Keyin" rasmi to'liq, ustida "oldin" rasmi chap tomondan kesilgan (clip-path). Tutqichni sudrash (sichqoncha/barmoq)
 * yoki klaviatura: ← → (5%), Shift bilan 10%, Home/End. role="slider" — ekran o'quvchi foizni eshitadi.
 */
export function BeforeAfter({ before, after, title }: { before: string; after: string; title: string }) {
  const til = useLocale();
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromClientX = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    fromClientX(e.clientX);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) fromClientX(e.clientX);
  };
  const stop = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 5;
    let next: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = pos - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = pos + step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 100;
    if (next == null) return;
    // Lightbox'ning ←/→ (keyingi ish) tugmalari bilan to'qnashmasin
    e.preventDefault();
    e.stopPropagation();
    setPos(Math.min(100, Math.max(0, next)));
  };

  return (
    <div
      ref={boxRef}
      className="relative aspect-[4/3] max-h-[calc(100dvh-220px)] w-full max-w-4xl touch-none select-none overflow-hidden rounded-[var(--r-lg)] bg-surface-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${title} — keyin`} draggable={false} className="absolute inset-0 h-full w-full object-cover text-transparent" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt={`${title} — oldin`}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover text-transparent"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{tr(til, GALEREYA.before)}</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">{tr(til, GALEREYA.after)}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" style={{ left: `${pos}%` }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label={tr(til, GALEREYA.compareAria)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={GALEREYA.compareValue[til](Math.round(pos), 100 - Math.round(pos))}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-[#121213] shadow-[var(--shadow-2)] outline-none focus-visible:ring-4 focus-visible:ring-accent/60"
        style={{ left: `${pos}%` }}
      >
        <ChevronsLeftRight size={18} aria-hidden="true" />
      </div>
    </div>
  );
}
