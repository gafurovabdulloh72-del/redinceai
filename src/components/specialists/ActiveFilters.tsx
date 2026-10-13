import Link from "next/link";
import { BadgeCheck, Briefcase, CheckCircle2, Clapperboard, Clock3, MapPin, Search, Sparkles, UserRound, Wallet, Wrench, X, type LucideIcon } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, GENDERS, REGION_BY_SLUG, WORK_TYPE_BY_SLUG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { buildHref } from "./Pagination";

export interface ActiveFilterValues {
  q?: string;
  category?: string;
  region?: string;
  priceMin?: number;
  priceMax?: number;
  experience?: string;
  verified?: "1" | "0";
  gender?: "male" | "female";
  available?: "1";
  /** Ko'nikma (F50) va jihoz (F51) */
  skill?: string;
  equipment?: string;
  /** Ish turi (F52) va "Hozir ochiq" (F42) */
  workType?: string;
  openNow?: "1";
}

interface ChipDef {
  /** Olib tashlanadigan URL kalitlari (narx oralig'i — ikkita) */
  keys: string[];
  label: string;
  icon?: LucideIcon;
  node?: React.ReactNode;
}

const short = (n: number) => formatPrice(n, { compact: true }).replace(" so'm", "");

export function ActiveFilters({
  filter,
  query,
  basePath = "/mutaxassislar",
  className,
}: {
  filter: ActiveFilterValues;
  /** Joriy URL parametrlari — chip olib tashlanganda qolganlari saqlanadi */
  query: Record<string, string | undefined>;
  basePath?: string;
  className?: string;
}) {
  const chips: ChipDef[] = [];

  if (filter.q) chips.push({ keys: ["q"], label: `“${filter.q}”`, icon: Search });
  if (filter.category) {
    const c = CATEGORY_BY_SLUG[filter.category];
    chips.push({
      keys: ["category"],
      label: c?.name ?? filter.category,
      node: c ? <CategoryIcon icon={c.icon} size={13} className="text-fg-3" /> : undefined,
    });
  }
  if (filter.region) chips.push({ keys: ["region"], label: REGION_BY_SLUG[filter.region]?.name ?? filter.region, icon: MapPin });
  const min = filter.priceMin && filter.priceMin > 0 ? filter.priceMin : 0;
  const max = filter.priceMax && filter.priceMax > 0 ? filter.priceMax : 0;
  if (min || max) {
    const label = min && max ? `${short(min)} – ${short(max)} so'm` : min ? `${short(min)} so'mdan` : `${short(max)} so'mgacha`;
    chips.push({ keys: ["priceMin", "priceMax"], label, icon: Wallet });
  }
  if (filter.experience) {
    const e = EXPERIENCE_LEVELS.find((l) => l.value === filter.experience);
    chips.push({ keys: ["experience"], label: e?.label ?? filter.experience, icon: Briefcase });
  }
  if (filter.gender) chips.push({ keys: ["gender"], label: GENDERS.find((g) => g.value === filter.gender)?.label ?? filter.gender, icon: UserRound });
  if (filter.verified === "1") chips.push({ keys: ["verified"], label: "Tasdiqlangan", icon: BadgeCheck });
  if (filter.available === "1") chips.push({ keys: ["available"], label: "Hozir bo'sh", icon: CheckCircle2 });
  if (filter.skill) chips.push({ keys: ["skill"], label: `Ko'nikma: ${filter.skill}`, icon: Sparkles });
  if (filter.equipment) chips.push({ keys: ["equipment"], label: `Jihoz: ${filter.equipment}`, icon: Wrench });
  if (filter.workType) chips.push({ keys: ["workType"], label: WORK_TYPE_BY_SLUG[filter.workType]?.label ?? filter.workType, icon: Clapperboard });
  if (filter.openNow === "1") chips.push({ keys: ["openNow"], label: "Hozir ochiq", icon: Clock3 });

  if (chips.length === 0) return null;

  const removeHref = (keys: string[]) => buildHref(basePath, { ...query, ...Object.fromEntries(keys.map((k) => [k, undefined])), page: undefined });
  const clearHref = buildHref(basePath, { sort: query.sort, limit: query.limit, view: query.view });

  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-2" aria-label="Faol filtrlar">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.keys.join("+")}>
              <Link
                href={removeHref(c.keys)}
                scroll={false}
                aria-label={`${c.label} filtrini olib tashlash`}
                className="card card-hover group inline-flex h-9 items-center gap-1.5 !rounded-full pl-3 pr-1.5 text-[13px] font-medium text-fg"
              >
                {Icon ? <Icon size={13} className="text-fg-3" /> : c.node}
                <span className="max-w-[180px] truncate">{c.label}</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fg/6 text-fg-3 transition group-hover:bg-danger-soft group-hover:text-danger-text">
                  <X size={12} />
                </span>
              </Link>
            </li>
          );
        })}
        {chips.length > 1 && (
          <li>
            <Link href={clearHref} scroll={false} className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-semibold text-accent-text transition hover:bg-accent-soft">
              Hammasini tozalash
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
