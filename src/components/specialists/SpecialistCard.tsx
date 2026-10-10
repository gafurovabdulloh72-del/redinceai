import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { Avatar, Badge, Stars } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { formatPriceRange, hashHue } from "@/lib/utils";
import type { SpecialistListItem } from "@/lib/queries";

export function SpecialistCard({ sp, priority = false }: { sp: SpecialistListItem; priority?: boolean }) {
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const hue = hashHue(sp.slug);

  return (
    <Link href={`/mutaxassislar/${sp.slug}`} className="glass glass-hover group block overflow-hidden">
      {/* Muqova */}
      <div className="relative h-28 overflow-hidden rounded-t-[inherit]">
        {sp.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sp.coverUrl}
            alt=""
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full transition duration-700 group-hover:scale-105"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 85% 72%), ${cat?.accent ?? "#7c5cff"} 60%, hsl(${(hue + 60) % 360} 80% 65%))`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {cat && (
            <span className="glass-strong glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-fg">
              <CategoryIcon icon={cat.icon} size={12} style={{ color: cat.accent }} />
              {cat.name}
            </span>
          )}
        </div>
        {!sp.isAvailable && (
          <span className="glass-strong glass-pill absolute right-3 top-3 px-2.5 py-1 text-[11px] font-semibold text-fg-2">Band</span>
        )}
      </div>

      {/* Tana */}
      <div className="relative px-4 pb-4 pt-0">
        <div className="-mt-7 mb-2.5 flex items-end justify-between">
          <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={56} className="ring-4 !ring-[var(--glass-strong)]" />
          <Stars value={sp.rating} count={sp.reviewCount} size={12} />
        </div>

        <h3 className="flex items-center gap-1.5 text-[16px] font-semibold leading-tight text-fg">
          <span className="truncate">{sp.user.name}</span>
          {sp.isVerified && <BadgeCheck size={16} className="shrink-0 fill-ios-blue text-white" aria-label="Tasdiqlangan" />}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-fg-2">{sp.title}</p>

        <p className="mt-2 flex items-center gap-1 text-[12px] text-fg-3">
          <MapPin size={12} className="text-tint" />
          {sp.city}
          {region && sp.city !== region.capital && <span>· {region.short}</span>}
          {region && sp.city === region.capital && region.slug !== "toshkent-shahri" && <span>· {region.short}</span>}
        </p>

        {sp.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sp.skills.slice(0, 3).map((s) => (
              <Badge key={s} tone="neutral" className="!py-0.5 text-[11px] font-medium">
                {s}
              </Badge>
            ))}
            {sp.skills.length > 3 && <span className="text-[11px] text-fg-4">+{sp.skills.length - 3}</span>}
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-between border-t border-hairline pt-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-fg-4">Narx</p>
            <p className="text-[14px] font-semibold text-fg">{formatPriceRange(sp.priceFrom, sp.priceTo)}</p>
          </div>
          <span className="glass-tint inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-semibold opacity-90 transition group-hover:opacity-100">
            Profil
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SpecialistCardSkeleton() {
  return (
    <div className="glass overflow-hidden">
      <div className="skeleton h-28 !rounded-none" />
      <div className="px-4 pb-4">
        <div className="-mt-7 mb-3 h-14 w-14 rounded-full skeleton" />
        <div className="h-4 w-2/3 skeleton" />
        <div className="mt-2 h-3 w-full skeleton" />
        <div className="mt-4 h-3 w-1/2 skeleton" />
      </div>
    </div>
  );
}
