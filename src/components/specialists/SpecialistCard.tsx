import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SafeImage } from "./SafeImage";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { formatPriceRange, hashHue } from "@/lib/utils";
import type { SpecialistListItem } from "@/lib/queries";

export function SpecialistCard({ sp, priority = false }: { sp: SpecialistListItem; priority?: boolean }) {
  const cat = CATEGORY_BY_SLUG[sp.category];
  const region = REGION_BY_SLUG[sp.regionSlug];
  const hue = hashHue(sp.slug);
  const place = region && region.slug !== "toshkent-shahri" && sp.city !== region.short ? `${sp.city} · ${region.short}` : sp.city;
  const gradient = `linear-gradient(135deg, hsl(${hue} 60% 62%), ${cat?.accent ?? "#ff5a36"} 70%)`;

  return (
    <Link href={`/mutaxassislar/${sp.slug}`} className="card card-hover group block overflow-hidden">
      {/* Muqova — rasm yuklanmasa gradient (buzilgan rasm belgisi ko'rinmaydi) */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-3">
        <SafeImage
          src={sp.coverUrl ?? undefined}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          fallback={<div className="absolute inset-0 transition duration-700 ease-out group-hover:scale-[1.04]" style={{ background: gradient }} />}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />

        {/* Kategoriya chip — blur'siz, qattiq yuza */}
        {cat && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-ink-fg">
            <CategoryIcon icon={cat.icon} size={12} />
            {cat.name}
          </span>
        )}
        {!sp.isAvailable && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-ink-fg/90">Band</span>
        )}

        {/* Avatar + ism (muqova ustida) */}
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={40} decorative className="!ring-white/60" />
            <div className="min-w-0">
              <h3 className="flex items-center gap-1 truncate font-display text-[15px] font-semibold text-white">
                <span className="truncate">{sp.user.name}</span>
                {sp.isVerified && <VerifiedBadge size={15} />}
              </h3>
              <p className="flex items-center gap-1 text-[11px] text-white/80">
                <MapPin size={11} /> {place}
              </p>
            </div>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-fg opacity-0 transition duration-300 group-hover:opacity-100">
            <ArrowUpRight size={16} />
          </span>
        </div>
      </div>

      {/* Tana */}
      <div className="px-4 pb-4 pt-3.5">
        <p className="line-clamp-1 text-[14px] font-medium text-fg">{sp.title}</p>

        {sp.skills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {sp.skills.slice(0, 3).map((s) => (
              <span key={s} className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-fg-2">
                {s}
              </span>
            ))}
            {sp.skills.length > 3 && <span className="self-center text-[11px] text-fg-4">+{sp.skills.length - 3}</span>}
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-4">Narx</p>
            <p className="font-display text-[14px] font-semibold text-fg">{formatPriceRange(sp.priceFrom, sp.priceTo)}</p>
          </div>
          <Stars value={sp.rating} count={sp.reviewCount} size={12} />
        </div>
      </div>
    </Link>
  );
}

export function SpecialistCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[16/10] !rounded-none" />
      <div className="px-4 pb-4 pt-3.5">
        <div className="h-4 w-2/3 skeleton" />
        <div className="mt-2 h-3 w-full skeleton" />
        <div className="mt-4 h-3 w-1/2 skeleton" />
      </div>
    </div>
  );
}
