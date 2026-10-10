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
  if (full.length <= 24) return full;
  if (from) return `${formatPrice(from, { compact: true })} dan`;
  return full;
}

export function SpecialistCard({ sp, priority = false }: { sp: SpecialistListItem; priority?: boolean }) {
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const hue = hashHue(sp.slug);
  const place = region && region.slug !== "toshkent-shahri" && sp.city !== region.short ? `${sp.city} · ${region.short}` : sp.city;
  /* Rasm yo'q muqova: past to'yinganlikdagi, palitraga mos ohang (sun'iy rang-barang gradient emas) */
  const fallbackBg = `linear-gradient(135deg, hsl(${hue} 22% 30%), ${cat?.accent ?? "#df7a5a"}cc 120%)`;

  return (
    <Link href={`/mutaxassislar/${sp.slug}`} className="card card-hover group block overflow-hidden">
      {/* Muqova 4:3 — rasm yuklanmasa yumshoq fon (buzilgan rasm belgisi ko'rinmaydi) */}
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-3">
        <SafeImage
          src={sp.coverUrl ?? undefined}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          fallback={<div className="absolute inset-0 grain transition duration-700 ease-out group-hover:scale-[1.04]" style={{ background: fallbackBg }} />}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/0" />

        {/* Chiplar: kategoriya — qattiq yuza; "Band" — neytral */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {cat ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-2.5 text-[11px] font-semibold text-fg shadow-[var(--shadow-1)]">
              <CategoryIcon icon={cat.icon} size={12} style={{ color: cat.accent }} />
              {cat.name}
            </span>
          ) : (
            <span />
          )}
          {!sp.isAvailable && <span className="inline-flex h-7 items-center rounded-full bg-surface-3 px-2.5 text-[11px] font-semibold text-fg-2">Band</span>}
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
            <h3 className="font-display text-[15px] font-semibold leading-tight text-fg">
              <span className="line-clamp-2">{sp.user.name}</span>
              {sp.isVerified && <VerifiedBadge size={15} className="ml-1 inline-block align-[-2px]" />}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-fg-3">
              <MapPin size={11} className="shrink-0" /> <span className="truncate">{place}</span>
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-1 text-[14px] font-medium text-fg-2">{sp.title}</p>

        {sp.skills.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-hidden">
            {sp.skills.slice(0, 3).map((s) => (
              <span key={s} className="truncate rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-fg-2">
                {s}
              </span>
            ))}
            {sp.skills.length > 3 && (
              <span className="shrink-0 self-center text-[11px] text-fg-3" title={sp.skills.slice(3).join(", ")}>
                +{sp.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-3.5 border-t border-line pt-3">
          <p className="truncate whitespace-nowrap font-display text-[15px] font-semibold text-fg" title={formatPriceRange(sp.priceFrom, sp.priceTo)}>
            {priceLine(sp.priceFrom, sp.priceTo)}
          </p>
          <div className="mt-1.5">
            <Stars value={sp.rating} count={sp.reviewCount} size={12} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SpecialistCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3] !rounded-none" />
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
