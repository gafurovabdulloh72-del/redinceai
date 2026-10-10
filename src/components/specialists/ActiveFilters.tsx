import Link from "next/link";
import { BadgeCheck, Briefcase, MapPin, Search, Wallet, X, type LucideIcon } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG, EXPERIENCE_LEVELS, REGION_BY_SLUG } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { buildHref } from "./Pagination";

export interface ActiveFilterValues {
  q?: string;
  category?: string;
  region?: string;
  priceMax?: number;
  experience?: string;
  verified?: "1" | "0";
}

interface ChipDef {
  key: keyof ActiveFilterValues;
  label: string;
  icon?: LucideIcon;
  node?: React.ReactNode;
}

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

  if (filter.q) chips.push({ key: "q", label: `“${filter.q}”`, icon: Search });
  if (filter.category) {
    const c = CATEGORY_BY_SLUG[filter.category];
    chips.push({
      key: "category",
      label: c?.name ?? filter.category,
      node: c ? <CategoryIcon icon={c.icon} size={13} style={{ color: c.accent }} /> : undefined,
    });
  }
  if (filter.region) chips.push({ key: "region", label: REGION_BY_SLUG[filter.region]?.name ?? filter.region, icon: MapPin });
  if (filter.priceMax && filter.priceMax > 0) chips.push({ key: "priceMax", label: `${formatPrice(filter.priceMax, { compact: true })} gacha`, icon: Wallet });
  if (filter.experience) {
    const e = EXPERIENCE_LEVELS.find((l) => l.value === filter.experience);
    chips.push({ key: "experience", label: e?.label ?? filter.experience, icon: Briefcase });
  }
  if (filter.verified === "1") chips.push({ key: "verified", label: "Tasdiqlangan", icon: BadgeCheck });

  if (chips.length === 0) return null;

  const removeHref = (key: string) => buildHref(basePath, { ...query, [key]: undefined, page: undefined });
  const clearHref = buildHref(basePath, { sort: query.sort, limit: query.limit });

  return (
    <div className={className}>
      <ul className="flex flex-wrap items-center gap-2" aria-label="Faol filtrlar">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.key}>
              <Link
                href={removeHref(c.key)}
                scroll={false}
                aria-label={`${c.label} filtrini olib tashlash`}
                className="glass glass-pill glass-hover group inline-flex h-8 items-center gap-1.5 pl-3 pr-2 text-[13px] font-medium text-fg"
              >
                {Icon ? <Icon size={13} className="text-tint" /> : c.node}
                <span className="max-w-[160px] truncate">{c.label}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fg/8 text-fg-3 transition group-hover:bg-ios-red/15 group-hover:text-ios-red">
                  <X size={12} />
                </span>
              </Link>
            </li>
          );
        })}
        {chips.length > 1 && (
          <li>
            <Link href={clearHref} scroll={false} className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold text-tint transition hover:bg-tint-soft">
              Hammasini tozalash
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
