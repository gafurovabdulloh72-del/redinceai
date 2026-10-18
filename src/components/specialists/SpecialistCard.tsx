import Link from "next/link";
import { ArrowUpRight, Award, MapPin } from "lucide-react";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CoverPattern } from "@/components/ui/CoverPattern";
import { SafeImage } from "./SafeImage";
import { FavoriteButton } from "./FavoriteButton";
import { CompareButton } from "./CompareButton";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG, TOP_RATED_RULE } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { KARTA, priceFromLabel, priceRangeLabel } from "@/lib/i18n/dict/catalog";
import { formatPrice, isRecent } from "@/lib/utils";
import type { SpecialistListItem } from "@/lib/queries";

/** Narx BIR qatorda: diapazon juda uzun bo'lsa — "… dan" ko'rinishi */
function priceLine(til: Locale, from: number, to?: number | null) {
  const full = priceRangeLabel(til, from, to);
  if (full.length <= 20) return full;
  if (from) return priceFromLabel(til, formatPrice(from, { compact: true }));
  return full;
}

/**
 * Katalog kartasi (v3 «Tinch»): muqova + ism, kasb, hudud, narx va reyting — boshqa hech narsa.
 * Ko'nikma chiplari, soyali pill'lar olib tashlangan; «Top» — ism yonida belgi, «Yangi» — mayda matn.
 * Karta — article: "cho'zilgan" havola butun kartani qoplaydi (fokus halqasi .card-link orqali), yurak/taqqoslash tugmalari o'zi bosiladi.
 */
export async function SpecialistCard({
  sp,
  priority = false,
  showCompare = false,
}: {
  sp: SpecialistListItem;
  priority?: boolean;
  /** "Taqqoslash" tugmasi (F54) — faqat taqqoslash paneli bor sahifalarda */
  showCompare?: boolean;
}) {
  const til = await getLocale();
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const place = region && region.slug !== "toshkent-shahri" && sp.city !== region.short ? `${sp.city} · ${region.short}` : sp.city;
  const isNew = isRecent(sp.createdAt, 7);

  return (
    <article className="card card-hover card-link group img-zoom overflow-hidden">
      <Link href={`/mutaxassislar/${sp.slug}`} aria-label={`${sp.user.name} — ${sp.title}`} className="absolute inset-0 z-0 rounded-[inherit]" />
      <div className="pointer-events-none relative">
        {/* Muqova: haqiqiy rasm telefonda 16:10, sm+ da 4:3; rasm yo'q bo'lsa past naqsh tasmasi */}
        <div className={`relative overflow-hidden bg-surface-3 sm:aspect-[4/3] ${sp.coverUrl ? "aspect-[16/10]" : "h-28"}`}>
          <SafeImage
            src={sp.coverUrl ?? undefined}
            alt=""
            priority={priority}
            className="absolute inset-0 h-full w-full object-cover"
            fallback={<CoverPattern category={sp.category} seed={sp.slug} />}
            overlayClassName="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/0"
          />
          {/* Faqat kategoriya (hairline, soyasiz) va — kerak bo'lsa — «Band» */}
          <div className="absolute left-3 right-14 top-3 flex items-start justify-between gap-2">
            {cat ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11px] font-semibold text-fg">
                <CategoryIcon icon={cat.icon} size={12} className="text-fg-3" />
                {cat.name}
              </span>
            ) : (
              <span />
            )}
            {!sp.isAvailable && <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-line bg-surface px-2.5 text-[11px] font-semibold text-fg-2">{tr(til, KARTA.busy)}</span>}
          </div>
          <span className="hover-reveal absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-fg transition duration-300">
            <ArrowUpRight size={16} />
          </span>
        </div>

        <div className="px-4 pb-4 pt-3.5">
          <div className="flex items-start gap-3">
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={44} decorative className="-mt-9 !ring-surface" />
            <div className="min-w-0 flex-1 pt-0.5">
              {/* h2: ro'yxat sahifasida h1'dan keyin karta nomi ikkinchi daraja */}
              <h2 className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-fg">
                {sp.user.name}
                {sp.isVerified && <VerifiedBadge size={15} className="ml-1 inline-block align-[-2px]" />}
                {sp.topRated && (
                  <span className="ml-1 inline-block align-[-2px] text-accent" title={KARTA.topHint[til](TOP_RATED_RULE.minRating, TOP_RATED_RULE.minReviews)}>
                    <Award size={14} aria-hidden="true" />
                    <span className="sr-only">{tr(til, KARTA.top)}</span>
                  </span>
                )}
                {isNew && <span className="ml-1.5 align-[1px] text-[11px] font-semibold text-accent-text">{tr(til, KARTA.new)}</span>}
              </h2>
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-fg-3">
                <MapPin size={11} className="shrink-0" /> <span className="truncate">{place}</span>
              </p>
            </div>
          </div>

          <p className="mt-3 line-clamp-1 text-[14px] text-fg-2">{sp.title}</p>

          {/* Narx va reyting — bitta qatorda */}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="min-w-0 truncate font-display text-[14.5px] font-semibold text-fg" title={priceRangeLabel(til, sp.priceFrom, sp.priceTo)}>
              {priceLine(til, sp.priceFrom, sp.priceTo)}
            </p>
            <Stars value={sp.rating} count={sp.reviewCount} size={12} />
          </div>
        </div>
      </div>
      <FavoriteButton specialistId={sp.id} variant="overlay" className="absolute right-2 top-2 z-10" />
      {showCompare && <CompareButton item={{ id: sp.id, name: sp.user.name, avatarUrl: sp.user.avatarUrl }} variant="overlay" className="absolute right-2 top-12 z-10" />}
    </article>
  );
}

export function SpecialistCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[16/10] !rounded-none sm:aspect-[4/3]" />
      <div className="px-4 pb-4 pt-3.5">
        <div className="flex items-start gap-3">
          <div className="-mt-9 h-11 w-11 shrink-0 rounded-full skeleton ring-2 ring-surface" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-2/3 skeleton" />
            <div className="h-3 w-1/3 skeleton" />
          </div>
        </div>
        <div className="mt-3 h-3.5 w-full skeleton" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-3.5 w-24 skeleton" />
          <div className="h-3 w-16 skeleton" />
        </div>
      </div>
    </div>
  );
}
