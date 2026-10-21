"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Clapperboard, Play, Star, Volume2, VolumeX } from "lucide-react";
import { Avatar, Spinner, VerifiedBadge } from "@/components/ui";
import { ShareButton } from "@/components/specialists/ShareButton";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { loadMoreLenta } from "@/app/lenta/actions";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { tr } from "@/lib/i18n";
import { priceFromLabel } from "@/lib/i18n/dict/catalog";
import { LENTA } from "@/lib/i18n/dict/lenta";
import { FEED } from "@/lib/i18n/dict/feed";
import { showToast } from "@/components/ui/toast";
import { formatPrice } from "@/lib/utils";
import type { LentaItem } from "@/lib/lenta";

/**
 * Reels-uslubidagi vertikal lenta: har bir ish — ekran bo'yi slayd (scroll-snap y mandatory).
 * - Video faqat ko'rinishda (IntersectionObserver, threshold 0.6) muted holda o'ynaydi, chiqsa pauza.
 * - Bosganda ovoz yoqiladi/o'chadi (ovoz holati butun lenta uchun bitta — Reels odati).
 * - prefers-reduced-motion'da autoplay yo'q — markazda play tugmasi.
 * - Oxirida kursorli "Yana yuklash" slaydi (yaqinlashganda o'zi ham yuklaydi).
 */
export function LentaFeed({ initialItems, initialCursor }: { initialItems: LentaItem[]; initialCursor: string | null }) {
  const til = useLocale();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initialItems[0]?.id ?? null);

  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(initialCursor);
  const loadingRef = useRef(false);
  cursorRef.current = cursor;

  /* Harakatni kamaytirish — autoplay o'rniga play tugmasi */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Qaysi slayd ko'rinishda — faqat o'shanisi o'ynaydi */
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.lentaId;
          if (id && e.isIntersecting) setActiveId(id);
        }
      },
      { root, threshold: 0.6 },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-lenta-id]")) io.observe(el);
    return () => io.disconnect();
  }, [items.length]);

  const loadNext = useCallback(async () => {
    if (loadingRef.current || !cursorRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = await loadMoreLenta(cursorRef.current);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      // Tarmoq xatosi — tugma qoladi, foydalanuvchi qayta bosadi; sababi toast bilan aytiladi (ilgari jim edi)
      showToast(tr(til, FEED.loadFailed), "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [til]);

  /* Scroll oxiriga yaqinlashganda keyingi sahifa o'zi yuklanadi */
  useEffect(() => {
    const root = containerRef.current;
    const el = sentinelRef.current;
    if (!root || !el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadNext(), {
      root,
      rootMargin: "120% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, items.length, loadNext]);

  return (
    <div
      ref={containerRef}
      className="h-[100svh] snap-y snap-mandatory overflow-y-auto no-scrollbar bg-bg"
      aria-label={tr(til, LENTA.feedAria)}
    >
      {items.map((item) => (
        <LentaSlide
          key={item.id}
          item={item}
          active={item.id === activeId}
          reduced={reduced}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((v) => !v)}
        />
      ))}

      {/* Oxirgi slayd: yana yuklash / lenta tugadi */}
      <div ref={sentinelRef} className="flex h-[100svh] snap-start flex-col items-center justify-center gap-5 px-6 text-center">
        {cursor ? (
          <button
            type="button"
            onClick={loadNext}
            disabled={loading}
            className="btn-accent inline-flex h-13 items-center gap-2.5 rounded-full px-7 text-[15px] font-semibold disabled:opacity-60"
          >
            {loading ? (
              <>
                <Spinner /> {tr(til, LENTA.loading)}
              </>
            ) : (
              <>
                {tr(til, LENTA.loadMore)} <ArrowRight size={18} />
              </>
            )}
          </button>
        ) : (
          <>
            <span className="icon-tile icon-tile-lg" aria-hidden="true">
              <Clapperboard size={24} />
            </span>
            <div>
              <p className="font-display text-[20px] font-semibold text-fg">{tr(til, LENTA.endTitle)}</p>
              <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-fg-3">{tr(til, LENTA.endDesc)}</p>
            </div>
            <Link
              href="/mutaxassislar"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4"
            >
              {tr(til, LENTA.openCatalog)} <ArrowRight size={16} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bitta slayd                                                         */
/* ------------------------------------------------------------------ */
function LentaSlide({
  item,
  active,
  reduced,
  soundOn,
  onToggleSound,
}: {
  item: LentaItem;
  active: boolean;
  reduced: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  const til = useLocale();
  const sp = item.specialist;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];

  /* Ovoz holati — video elementiga darhol qo'llanadi */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !soundOn;
  }, [soundOn]);

  /* Ko'rinishda — o'ynat (reduced-motion'da emas); chiqsa — pauza */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active && !reduced) {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [active, reduced]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const priceLabel = sp.priceFrom > 0 ? priceFromLabel(til, formatPrice(sp.priceFrom, { compact: true })) : tr(til, LENTA.priceNegotiable);

  return (
    <section data-lenta-id={item.id} className="relative flex h-[100svh] snap-start items-center justify-center md:px-6 md:pb-10 md:pt-24">
      {/* Karta: mobil — butun ekran; desktop — markazlashgan 9:16 karta */}
      <div className="relative h-full w-full overflow-hidden bg-[#121213] md:aspect-[9/16] md:h-full md:max-h-[860px] md:w-auto md:rounded-[28px] md:border md:border-white/10 md:shadow-[var(--shadow-3)]">
        <video
          ref={videoRef}
          src={item.videoUrl}
          poster={item.posterUrl ?? undefined}
          preload="metadata"
          playsInline
          loop
          muted
          onClick={() => (playing ? onToggleSound() : togglePlay())}
          className="h-full w-full cursor-pointer object-cover"
          aria-label={item.title ?? LENTA.workOf[til](sp.name)}
        />

        {/* Ustki yumshoq soya — mobil navbar ostida kontrast uchun */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent md:hidden" aria-hidden="true" />

        {/* Ovoz tugmasi */}
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={soundOn ? tr(til, LENTA.soundOff) : tr(til, LENTA.soundOn)}
          className="absolute right-4 top-[calc(env(safe-area-inset-top)+4.25rem)] z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 md:top-4"
        >
          {soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>

        {/* Pauza holati (reduced-motion yoki autoplay bloklangan) — markazda play */}
        {!playing && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={tr(til, LENTA.play)}
            className="absolute left-1/2 top-1/2 z-10 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/60"
          >
            <Play size={30} className="ml-1 fill-white" />
          </button>
        )}

        {/* O'ng amal ustuni (TikTok uslubi): ijodkor profili (+) va ulashish — bosh barmoq zonasida */}
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+13rem)] right-3 z-10 flex flex-col items-center gap-4 md:bottom-44">
          <Link href={`/mutaxassislar/${sp.slug}`} aria-label={LENTA.profileOf[til](sp.name)} className="press relative block">
            <span className="story-ring"><span className="story-gap !bg-black/60"><Avatar name={sp.name} src={sp.avatarUrl} size={46} decorative className="!ring-0" /></span></span>
            <span aria-hidden="true" className="absolute -bottom-1.5 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-accent text-[14px] font-bold leading-none text-white ring-2 ring-black/60">+</span>
          </Link>
          <ShareButton variant="glass" iconOnly size="lg" url={typeof window !== "undefined" ? `${window.location.origin}/mutaxassislar/${sp.slug}` : undefined} title={sp.name} className="!rounded-full" />
        </div>

        {/* Pastki overlay: gradient + mutaxassis ma'lumoti + CTA */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pb-[calc(env(safe-area-inset-bottom)+5.25rem)] pt-24 md:pb-5">
          <div className="flex flex-col gap-3.5 px-4 sm:px-5">
            {item.title && <p className="line-clamp-2 text-[14px] font-medium leading-snug text-white/90">{item.title}</p>}

            <Link href={`/mutaxassislar/${sp.slug}`} className="group flex items-center gap-3" aria-label={LENTA.profileOf[til](sp.name)}>
              <Avatar name={sp.name} src={sp.avatarUrl} size={44} decorative className="!ring-white/30" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-display text-[16px] font-semibold text-white group-hover:underline group-hover:decoration-white/50 group-hover:underline-offset-4">
                    {sp.name}
                  </span>
                  {sp.isVerified && <VerifiedBadge size={16} />}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-white/70">
                  {cat?.name ?? sp.category}
                  {region ? ` · ${region.name}` : ""}
                </span>
              </span>
            </Link>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-display text-[15px] font-semibold text-white">{priceLabel}</span>
              {sp.reviewCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-white/85">
                  <Star size={13} className="fill-[#f0b43c] text-[#f0b43c]" aria-hidden="true" />
                  {sp.rating.toFixed(1)}
                  <span className="font-normal text-white/55">({sp.reviewCount})</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href={`/mutaxassislar/${sp.slug}`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-white/30 bg-white/10 text-[14px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {tr(til, LENTA.profile)}
              </Link>
              <Link
                href={`/buyurtma/${sp.id}`}
                className="btn-accent inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold"
              >
                {tr(til, LENTA.order)} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
