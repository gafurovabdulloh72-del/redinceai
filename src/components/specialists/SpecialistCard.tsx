import Link from "next/link";
import { ArrowUpRight, Award, MapPin } from "lucide-react";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CoverPattern } from "@/components/ui/CoverPattern";
import { SafeImage } from "./SafeImage";
import { FavoriteButton } from "./FavoriteButton";
import { CompareButton } from "./CompareButton";
import { SkillChips } from "./SkillChips";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG, TOP_RATED_RULE } from "@/lib/constants";
import { formatPrice, formatPriceRange, isRecent } from "@/lib/utils";
import type { SpecialistListItem } from "@/lib/queries";

/** Narx BIR qatorda: diapazon juda uzun bo'lsa — "… dan" ko'rinishi */
function priceLine(from: number, to?: number | null) {
  const full = formatPriceRange(from, to);
  if (full.length <= 24) return full;
  if (from) return `${formatPrice(from, { compact: true })} dan`;
  return full;
}

export function SpecialistCard({
  sp,
  priority = false,
  showCompare = false,
}: {
  sp: SpecialistListItem;
  priority?: boolean;
  /** "Taqqoslash" tugmasi (F54) — faqat taqqoslash paneli bor sahifalarda */
  showCompare?: boolean;
}) {
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const place = region && region.slug !== "toshkent-shahri" && sp.city !== region.short ? `${sp.city} · ${region.short}` : sp.city;
  const isNew = isRecent(sp.createdAt, 7);

  return (
    /*
     * Karta — article: "cho'zilgan" havola butun kartani qoplaydi (fokus halqasi .card-link orqali), mazmun uning ustida
     * pointer-events-none — bosish havolaga o'tadi; ko'nikma chiplari va yurak tugmasi esa o'zi bosiladi (E97).
     */
    <article className="card card-hover card-link group overflow-hidden">
      <Link href={`/mutaxassislar/${sp.slug}`} aria-label={`${sp.user.name} — ${sp.title}`} className="absolute inset-0 z-0 rounded-[inherit]" />
      <div className="pointer-events-none relative">
        {/* Muqova: telefonda 16:10 (karta ixchamroq, ekranga ko'proq sig'adi), sm+ da 4:3 — rasm yuklanmasa yo'nalish naqshi */}
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-3 sm:aspect-[4/3]">
          <SafeImage
            src={sp.coverUrl ?? undefined}
            alt=""
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
            fallback={<CoverPattern category={sp.category} seed={sp.slug} className="transition duration-700 ease-out group-hover:scale-[1.04]" />}
            // Qoraytiruvchi gradient faqat haqiqiy rasm ustida — och naqsh loyqa bo'lib qolmasin
            overlayClassName="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/0"
          />

          {/* Chiplar: kategoriya — qattiq yuza; "Yangi" (7 kun ichida qo'shilgan) — yuza + accent-text (AA, muqova ustida); "Band" — neytral; o'ngda yurak uchun joy */}
          <div className="absolute left-3 right-14 top-3 flex items-start justify-between gap-2">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {cat && (
                <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-2.5 text-[11px] font-semibold text-fg shadow-[var(--shadow-1)]">
                  <CategoryIcon icon={cat.icon} size={12} style={{ color: cat.accent }} />
                  {cat.name}
                </span>
              )}
              {isNew && <span className="inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-[11px] font-semibold text-accent-text shadow-[var(--shadow-1)]">Yangi</span>}
              {sp.topRated && (
                // Tooltip ko'rinsin va bosish baribir profilga olib borsin — xuddi shu manzilga havola (fokusdan tashqarida)
                <Link
                  href={`/mutaxassislar/${sp.slug}`}
                  tabIndex={-1}
                  title={`Top mutaxassis: reyting ${TOP_RATED_RULE.minRating}+ va kamida ${TOP_RATED_RULE.minReviews} ta sharh`}
                  className="pointer-events-auto inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-[11px] font-semibold text-fg shadow-[var(--shadow-1)]"
                >
                  <Award size={12} className="text-accent" /> Top
                </Link>
              )}
            </span>
            {!sp.isAvailable && <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-surface-3 px-2.5 text-[11px] font-semibold text-fg-2">Band</span>}
          </div>

          {/* Strelka diski — faqat ko'rsatkichli qurilmalarda, hover'da */}
          <span className="hover-reveal absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-fg shadow-[var(--shadow-1)] transition duration-300">
            <ArrowUpRight size={16} />
          </span>
        </div>

        {/* Tana */}
        <div className="px-4 pb-4 pt-3.5">
          <div className="flex items-start gap-3">
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={44} decorative className="-mt-9 !ring-surface" />
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-fg">
                {sp.user.name}
                {sp.isVerified && <VerifiedBadge size={15} className="ml-1 inline-block align-[-2px]" />}
              </h3>
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-fg-3">
                <MapPin size={11} className="shrink-0" /> <span className="truncate">{place}</span>
              </p>
            </div>
          </div>

          <p className="mt-3 line-clamp-1 text-[14px] font-medium text-fg-2">{sp.title}</p>

          <SkillChips skills={sp.skills} max={3} className="mt-2.5" />

          <div className="mt-3.5 border-t border-line pt-3">
            <p className="truncate whitespace-nowrap font-display text-[15px] font-semibold text-fg" title={formatPriceRange(sp.priceFrom, sp.priceTo)}>
              {priceLine(sp.priceFrom, sp.priceTo)}
            </p>
            <div className="mt-1.5">
              <Stars value={sp.rating} count={sp.reviewCount} size={12} />
            </div>
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
        <div className="mt-4 h-3 w-1/2 skeleton" />
      </div>
    </div>
  );
}
