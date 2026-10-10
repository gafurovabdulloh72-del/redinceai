import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Avatar, Stars } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORIES, REGIONS, type Category } from "@/lib/constants";
import type { RegionStat, SpecialistListItem } from "@/lib/queries";

/**
 * "Kim kerak?" — yo'nalishlar bento'si. Birinchi (katta) plitka haqiqiy kontent bilan
 * to'ldirilgan: shu yo'nalishdagi eng yuqori reytingli 3 kishi va hududlar bo'yicha taqsimot.
 */
export function CategoryBento({
  categoryStats,
  regionStats,
  leadTop,
}: {
  categoryStats: Record<string, number>;
  regionStats: Record<string, RegionStat>;
  /** Birinchi yo'nalish bo'yicha eng yaxshi 3 mutaxassis */
  leadTop: SpecialistListItem[];
}) {
  const [lead, ...rest] = CATEGORIES;
  const leadRegions = REGIONS.map((r) => ({ r, n: regionStats[r.slug]?.byCategory[lead.slug] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4);
  const leadMax = Math.max(1, ...leadRegions.map((x) => x.n));

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {/* ---------- Katta plitka ---------- */}
      <Link href={`/mutaxassislar?category=${lead.slug}`} className="card card-hover group relative col-span-2 flex flex-col overflow-hidden p-5 sm:p-6 lg:row-span-2">
        <Glow accent={lead.accent} />
        <Arrow />
        <IconBox c={lead} size={48} />
        <h3 className="mt-5 font-display text-[24px] font-semibold text-fg sm:text-[30px]">{lead.name}</h3>
        <p className="mt-1.5 max-w-md text-[13px] leading-snug text-fg-3 sm:text-[14px]">{lead.description}</p>

        {leadTop.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Eng yuqori reytinglilar</p>
            <ul className="mt-2.5 divide-y divide-line">
              {leadTop.map((sp) => (
                <li key={sp.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={sp.user.name} src={sp.user.avatarUrl} size={34} decorative />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{sp.user.name}</span>
                    <span className="block truncate text-[12px] text-fg-3">{sp.city}</span>
                  </span>
                  <Stars value={sp.rating} count={sp.reviewCount} size={11} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {leadRegions.length > 0 && (
          <div className="mt-5 hidden lg:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Hududlar bo'yicha</p>
            <ul className="mt-2.5 space-y-2">
              {leadRegions.map(({ r, n }) => (
                <li key={r.slug} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-24 shrink-0 truncate font-medium text-fg-2">{r.short}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/8" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: `${(n / leadMax) * 100}%`, background: lead.accent }} />
                  </span>
                  <span className="w-6 shrink-0 text-right font-semibold tabular-nums text-fg">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Count n={categoryStats[lead.slug] ?? 0} className="mt-auto pt-6" />
      </Link>

      {/* ---------- Kichik plitkalar ---------- */}
      {rest.map((c) => (
        <Link key={c.slug} href={`/mutaxassislar?category=${c.slug}`} className="card card-hover group relative overflow-hidden p-5 sm:p-6">
          <Glow accent={c.accent} />
          <Arrow />
          <IconBox c={c} size={48} />
          <h3 className="mt-5 pr-6 font-display text-[17px] font-semibold text-fg">{c.name}</h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-fg-3">{c.description}</p>
          <Count n={categoryStats[c.slug] ?? 0} className="mt-5" />
        </Link>
      ))}
    </div>
  );
}

function Glow({ accent }: { accent: string }) {
  return (
    <span
      className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-[0.14] blur-3xl transition-opacity duration-500 group-hover:opacity-30"
      style={{ background: accent }}
    />
  );
}

function Arrow() {
  return (
    <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-fg-3 transition group-hover:border-fg group-hover:text-fg" aria-hidden>
      <ArrowUpRight size={15} />
    </span>
  );
}

function IconBox({ c, size }: { c: Category; size: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[14px] text-white transition-transform duration-500 group-hover:-rotate-6"
      style={{ width: size, height: size, background: c.accent, boxShadow: `0 12px 28px -12px ${c.accent}` }}
    >
      <CategoryIcon icon={c.icon} size={Math.round(size * 0.46)} />
    </span>
  );
}

function Count({ n, className }: { n: number; className?: string }) {
  return (
    <span className={`block ${className ?? ""}`}>
      <span className="font-display text-[22px] font-semibold leading-none text-fg">{n}</span>
      <span className="ml-1.5 text-[12px] font-medium text-fg-3">mutaxassis</span>
    </span>
  );
}
