"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import type { LentaItem } from "@/lib/lenta";

/**
 * Bosh sahifadagi "Ishlar lentasi" tasmasi: gorizontal aylanadigan 9:16 video kartalar.
 * Hover'da (ko'rsatkichli qurilma) yoki kartaning ~70% i ko'rinishda bo'lsa (touch) muted preview;
 * prefers-reduced-motion'da faqat poster. Bosilganda /lenta ochiladi.
 */
export function HomeLentaStrip({ items }: { items: LentaItem[] }) {
  const [reduced, setReduced] = useState(true);
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hv = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      setReduced(rm.matches);
      setCanHover(hv.matches);
    };
    sync();
    rm.addEventListener("change", sync);
    hv.addEventListener("change", sync);
    return () => {
      rm.removeEventListener("change", sync);
      hv.removeEventListener("change", sync);
    };
  }, []);

  return (
    <ScrollRow label="Ishlar lentasi — video ishlar" rowClassName="flex gap-3 pb-1 sm:gap-4">
      {items.map((item) => (
        <StripCard key={item.id} item={item} reduced={reduced} hoverPlay={canHover} />
      ))}
    </ScrollRow>
  );
}

function StripCard({ item, reduced, hoverPlay }: { item: LentaItem; reduced: boolean; hoverPlay: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const cat = CATEGORY_BY_SLUG[item.specialist.category];
  const price = item.specialist.priceFrom > 0 ? `${formatPrice(item.specialist.priceFrom, { compact: true })} dan` : "Narx kelishiladi";

  const play = () => videoRef.current?.play().catch(() => undefined);
  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      /* metadata hali yuklanmagan bo'lsa — e'tiborsiz */
    }
  };

  /* Touch qurilmalar: karta ko'rinishga kirganda preview, chiqsa to'xtaydi */
  useEffect(() => {
    if (hoverPlay || reduced) return;
    const el = linkRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? play() : stop())), { threshold: 0.7 });
    io.observe(el);
    return () => io.disconnect();
  }, [hoverPlay, reduced]);

  return (
    <Link
      ref={linkRef}
      href="/lenta"
      onMouseEnter={hoverPlay && !reduced ? play : undefined}
      onMouseLeave={hoverPlay && !reduced ? stop : undefined}
      onFocus={hoverPlay && !reduced ? play : undefined}
      onBlur={hoverPlay && !reduced ? stop : undefined}
      aria-label={`${item.specialist.name} — ${item.title ?? "video ish"} (lentani ochish)`}
      className="group relative block aspect-[9/16] w-[168px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-line bg-[#121213] shadow-[var(--shadow-1)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-2)] sm:w-[196px]"
    >
      <video
        ref={videoRef}
        src={item.videoUrl}
        poster={item.posterUrl ?? undefined}
        preload="metadata"
        playsInline
        loop
        muted
        tabIndex={-1}
        className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
      />

      {/* Play chip — bu video ekanini bildiradi */}
      <span
        aria-hidden="true"
        className="absolute left-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-sm"
      >
        <Play size={12} className="ml-px fill-white" />
      </span>

      {/* Pastki gradient + ma'lumot */}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-10">
        <span className="truncate text-[12.5px] font-semibold text-white">{item.specialist.name}</span>
        <span className="truncate text-[11px] text-white/70">
          {cat?.name ?? item.specialist.category} · {price}
        </span>
      </span>
    </Link>
  );
}
