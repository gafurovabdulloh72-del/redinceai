import Link from "next/link";
import { Avatar, Stars, VerifiedBadge } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SafeImage } from "@/components/specialists/SafeImage";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import type { SpecialistListItem } from "@/lib/queries";
import { cn, formatPriceRange, hashHue } from "@/lib/utils";

/**
 * Bosh sahifa hero'sining o'ng ustuni: eng yuqori reytingli 3 ta ijodkor kollaji
 * (chapda baland karta, o'ngda ikkita kichik) + "jonli" hisob pilli.
 */
export function HeroShowcase({ items, total }: { items: SpecialistListItem[]; total: number }) {
  const [a, b, c] = items;
  if (!a) return null;

  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none lg:pl-4">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[90px] dark:bg-accent/20" />

      <div className="grid grid-cols-[1.12fr_1fr] gap-3 sm:gap-4">
        <ShowcaseCard sp={a} tall priority />
        <div className="flex flex-col gap-3 sm:gap-4">
          {b && <ShowcaseCard sp={b} />}
          {c && <ShowcaseCard sp={c} />}
        </div>
      </div>

      {/* Jonli hisob */}
      <div className="pointer-events-none absolute -bottom-4 left-4 sm:-bottom-5 sm:left-6">
        <span className="card flex items-center gap-2 !rounded-full py-2 pl-3 pr-4 text-[12px] font-semibold text-fg-2 shadow-[var(--shadow-2)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-70 animate-pulse-ring" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Jonli: <span className="font-display text-fg">{total}</span> ta ijodkor
        </span>
      </div>
    </div>
  );
}

function ShowcaseCard({ sp, tall = false, priority = false }: { sp: SpecialistListItem; tall?: boolean; priority?: boolean }) {
  const cat = CATEGORY_BY_SLUG[sp.category];
  const hue = hashHue(sp.slug);
  const gradient = `linear-gradient(135deg, hsl(${hue} 60% 62%), ${cat?.accent ?? "#ff5a36"} 70%)`;

  return (
    <Link href={`/mutaxassislar/${sp.slug}`} className="card card-hover group relative flex h-full flex-col overflow-hidden">
      <div className={cn("relative overflow-hidden bg-surface-3", tall ? "min-h-[220px] flex-1 sm:min-h-[280px]" : "aspect-[16/10]")}>
        <SafeImage
          src={sp.coverUrl ?? undefined}
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          fallback={<div className="absolute inset-0 transition duration-700 ease-out group-hover:scale-[1.04]" style={{ background: gradient }} />}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />

        {cat && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-ink/75 px-2 py-1 text-[10.5px] font-semibold text-ink-fg sm:left-3 sm:top-3 sm:text-[11px]">
            <CategoryIcon icon={cat.icon} size={11} />
            {tall ? cat.name : cat.name.split(" ")[0]}
          </span>
        )}

        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center gap-2 sm:inset-x-3 sm:bottom-3">
          <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={tall ? 36 : 28} decorative className="!ring-white/60" />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate font-display text-[12px] font-semibold text-white sm:text-[13px]">
              <span className="truncate">{sp.user.name}</span>
              {sp.isVerified && <VerifiedBadge size={13} />}
            </p>
            {tall && <p className="truncate text-[11px] text-white/80">{sp.city}</p>}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 pt-2.5 sm:px-3.5">
        <p className="line-clamp-1 text-[12.5px] font-medium text-fg sm:text-[13px]">{sp.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Stars value={sp.rating} count={tall ? sp.reviewCount : undefined} size={11} />
          <span className="font-display text-[11.5px] font-semibold text-fg sm:text-[12px]">{formatPriceRange(sp.priceFrom, sp.priceTo)}</span>
        </div>
      </div>
    </Link>
  );
}
