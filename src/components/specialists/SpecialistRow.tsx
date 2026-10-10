import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SafeImage } from "./SafeImage";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { formatPrice, formatPriceRange, hashHue } from "@/lib/utils";
import type { SpecialistListItem } from "@/lib/queries";

/** Narx BIR qatorda: diapazon juda uzun bo'lsa — "… dan" ko'rinishi */
function priceLine(from: number, to?: number | null) {
  const full = formatPriceRange(from, to);
  if (full.length <= 22) return full;
  if (from) return `${formatPrice(from, { compact: true })} dan`;
  return full;
}

/** Ro'yxat ko'rinishi — ixcham qator (muqova mini, ism, sarlavha, narx bir qatorda) */
export function SpecialistRow({ sp }: { sp: SpecialistListItem }) {
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const hue = hashHue(sp.slug);
  const place = region && region.slug !== "toshkent-shahri" && sp.city !== region.short ? `${sp.city} · ${region.short}` : sp.city;
  const fallbackBg = `linear-gradient(135deg, hsl(${hue} 22% 30%), ${cat?.accent ?? "#df7a5a"}cc 120%)`;

  return (
    <Link href={`/mutaxassislar/${sp.slug}`} className="card card-hover group flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5">
      {/* Mini muqova 4:3 */}
      <span className="relative hidden h-[66px] w-[88px] shrink-0 overflow-hidden rounded-[10px] bg-surface-3 sm:block">
        <SafeImage
          src={sp.coverUrl ?? undefined}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          fallback={<span className="absolute inset-0 grain" style={{ background: fallbackBg }} />}
        />
      </span>
      <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={44} decorative className="sm:hidden" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-[15px] font-semibold leading-tight text-fg">{sp.user.name}</span>
          {sp.isVerified && <VerifiedBadge size={15} />}
          {!sp.isAvailable && <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">Band</span>}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-fg-2">{sp.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-fg-3">
          {cat && (
            <span className="inline-flex items-center gap-1">
              <CategoryIcon icon={cat.icon} size={12} />
              {cat.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} /> {place}
          </span>
          <span className="sm:hidden">
            <Stars value={sp.rating} count={sp.reviewCount} size={11} />
          </span>
        </span>
      </span>

      <span className="hidden w-[150px] shrink-0 flex-col items-end gap-1 text-right sm:flex">
        <span className="whitespace-nowrap font-display text-[14px] font-semibold text-fg" title={formatPriceRange(sp.priceFrom, sp.priceTo)}>
          {priceLine(sp.priceFrom, sp.priceTo)}
        </span>
        <Stars value={sp.rating} count={sp.reviewCount} size={11} />
      </span>
      <span className="flex flex-col items-end gap-1 sm:hidden">
        <span className="whitespace-nowrap font-display text-[13px] font-semibold text-fg">{priceLine(sp.priceFrom, sp.priceTo)}</span>
      </span>

      <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg sm:flex">
        <ArrowUpRight size={15} />
      </span>
    </Link>
  );
}

export function SpecialistRowSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-3.5" aria-hidden="true">
      <div className="hidden h-[66px] w-[88px] shrink-0 skeleton !rounded-[10px] sm:block" />
      <div className="h-11 w-11 shrink-0 skeleton !rounded-full sm:hidden" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 skeleton" />
        <div className="h-3 w-2/3 skeleton" />
        <div className="h-3 w-1/2 skeleton" />
      </div>
      <div className="hidden w-[150px] space-y-2 sm:block">
        <div className="ml-auto h-3.5 w-24 skeleton" />
        <div className="ml-auto h-3 w-16 skeleton" />
      </div>
    </div>
  );
}
