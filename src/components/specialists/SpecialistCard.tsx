import Link from "next/link";
import { Award, Star } from "lucide-react";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { CoverPattern } from "@/components/ui/CoverPattern";
import { SafeImage } from "./SafeImage";
import { FavoriteButton } from "./FavoriteButton";
import { CompareButton } from "./CompareButton";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG, TOP_RATED_RULE } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { KARTA, priceFromLabel, priceRangeLabel, type UsdPrice } from "@/lib/i18n/dict/catalog";
import { formatPrice, isRecent } from "@/lib/utils";
import type { SpecialistListItem } from "@/lib/queries";
import { contactPriceFor } from "@/lib/contacts/unlock";
import { getSettings } from "@/lib/payments/settings";
import { Lock } from "lucide-react";

/** Narx BIR qatorda: diapazon juda uzun bo'lsa — "… dan" ko'rinishi */
function priceLine(til: Locale, from: number, to?: number | null, usd?: UsdPrice) {
  const full = priceRangeLabel(til, from, to, usd);
  if (full.length <= 20) return full;
  if (usd && usd.from > 0) return priceFromLabel(til, `$${usd.from}`);
  if (from) return priceFromLabel(til, formatPrice(from));
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
  // Kontakt sotuvi: narx daraja/maxsus bo'yicha (getSettings — so'rov ichida keshlangan); hidden — «faqat portfolio»
  const settings = await getSettings();
  const contactLine = sp.contactMode === "hidden" ? tr(til, KARTA.portfolioOnly) : `${tr(til, KARTA.contact)} · ${formatPrice(contactPriceFor(sp, settings), { compact: true })}`;
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const place = region && region.slug !== "toshkent-shahri" && sp.city !== region.short ? `${sp.city} · ${region.short}` : sp.city;
  const isNew = isRecent(sp.createdAt, 7);

  return (
    /* Telefonda (max-sm) — ro'yxat qatori: avatar + ism/kasb/narx, muqovasiz va ramkasiz (`m-plain`).
       sm+ da — eski karta: muqova ustida, matn ostida. */
    <article className="card card-hover card-link group img-zoom m-plain flex h-full flex-col overflow-hidden max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:px-4 max-sm:py-2.5">
      <Link href={`/mutaxassislar/${sp.slug}`} aria-label={`${sp.user.name} — ${sp.title}`} className="absolute inset-0 z-0 rounded-[inherit]" />
      <span className="pointer-events-none relative shrink-0 sm:hidden">
        <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={54} decorative />
      </span>
      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col">
        {/* Barcha kartalar bir xil balandlikda: rasm bo'lmasa tekis yuza + yo'nalish ikonkasi (katalog to'ri tekis turadi) */}
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-2 max-sm:hidden">
          {sp.coverUrl ? (
            <SafeImage src={sp.coverUrl} alt="" priority={priority} className="absolute inset-0 h-full w-full object-cover" fallback={<CoverPattern category={sp.category} seed={sp.slug} />} />
          ) : (
            <CoverPattern category={sp.category} seed={sp.slug} />
          )}
          {!sp.isAvailable && <span className="absolute bottom-2.5 left-2.5 inline-flex h-6 items-center rounded-md bg-surface px-2 text-[11px] font-semibold text-fg-2">{tr(til, KARTA.busy)}</span>}
        </div>

        <div className="flex flex-1 flex-col p-3 sm:p-4 max-sm:p-0">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
            <span className="max-sm:hidden">
              <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={36} decorative />
            </span>
            <div className="min-w-0 w-full flex-1 max-sm:pr-9 sm:pr-8">
              {/* h2: ro'yxat sahifasida h1'dan keyin karta nomi ikkinchi daraja */}
              <h2 className="line-clamp-1 font-display text-[14px] font-semibold leading-tight text-fg max-sm:text-[15px] sm:text-[15px]">
                {sp.user.name}
                {sp.isVerified && <VerifiedBadge size={14} className="ml-1 inline-block align-[-2px]" />}
                {sp.topRated && (
                  <span className="ml-1 inline-block align-[-2px] text-accent" title={KARTA.topHint[til](TOP_RATED_RULE.minRating, TOP_RATED_RULE.minReviews)}>
                    <Award size={13} aria-hidden="true" />
                    <span className="sr-only">{tr(til, KARTA.top)}</span>
                  </span>
                )}
                {isNew && <span className="ml-1.5 align-[1px] text-[11px] font-semibold text-accent-text">{tr(til, KARTA.new)}</span>}
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-fg-3 sm:text-[12.5px]">
                {cat?.name ? `${cat.name} · ` : ""}
                {place}
                {/* Telefon qatori: kontakt narxi meta qatorining oxirida (sm+ da alohida chip) */}
                <span className="sm:hidden"> · 🔒 {sp.contactMode === "hidden" ? tr(til, KARTA.portfolioOnly) : formatPrice(contactPriceFor(sp, settings), { compact: true })}</span>
              </p>
              <p className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-fg-2 max-sm:hidden">
                <Lock size={10} aria-hidden="true" /> {contactLine}
              </p>
            </div>
          </div>

          <p className="mb-3 mt-2.5 line-clamp-2 min-h-[2.6em] text-[13px] leading-snug text-fg-2 max-sm:mb-0 max-sm:mt-0.5 max-sm:line-clamp-1 max-sm:min-h-0 max-sm:text-[13px] sm:mt-3 sm:text-[14px]">{sp.title}</p>

          <div className="mt-auto flex flex-col items-start gap-1 border-t border-line pt-2.5 max-sm:mt-1 max-sm:flex-row max-sm:items-center max-sm:gap-2.5 max-sm:border-0 max-sm:pt-0 sm:mt-auto sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-3">
            <p className="min-w-0 flex-1 truncate whitespace-nowrap font-display text-[13px] font-semibold text-fg sm:text-[14px]" title={priceRangeLabel(til, sp.priceFrom, sp.priceTo, sp.priceCurrency === "USD" ? { from: sp.priceUsdFrom ?? 0, to: sp.priceUsdTo } : null)}>
              {priceLine(til, sp.priceFrom, sp.priceTo, sp.priceCurrency === "USD" ? { from: sp.priceUsdFrom ?? 0, to: sp.priceUsdTo } : null)}
            </p>
            {sp.reviewCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold tabular-nums text-fg">
                <Star size={12} className="fill-accent text-accent" aria-hidden="true" />
                {sp.rating.toFixed(1)}
                <span className="font-normal text-fg-3">({sp.reviewCount})</span>
              </span>
            ) : (
              <span className="shrink-0 text-[12px] text-fg-4">Yangi</span>
            )}
          </div>
        </div>
      </div>
      <FavoriteButton specialistId={sp.id} variant="overlay" className="absolute right-2 top-2 z-10 max-sm:right-3 max-sm:top-1/2 max-sm:-translate-y-1/2" />
      {showCompare && <CompareButton item={{ id: sp.id, name: sp.user.name, avatarUrl: sp.user.avatarUrl }} variant="overlay" className="absolute right-2 top-12 z-10 max-sm:hidden" />}
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
