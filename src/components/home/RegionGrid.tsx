import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG, REGIONS } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * 14 ta hudud — plitkalar. Soni bo'yicha saralanadi; eng faol hudud "siyoh" rangda.
 * Har plitkada: nom, markaz, ijodkorlar soni, ulush chizig'i va eng ko'p yo'nalish.
 */
export function RegionGrid({ stats }: { stats: Record<string, RegionStat> }) {
  const rows = REGIONS.map((r) => ({ r, n: stats[r.slug]?.total ?? 0, by: stats[r.slug]?.byCategory ?? {} })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((x) => x.n));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-7">
      {rows.map(({ r, n, by }, i) => {
        const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
        const cat = top ? CATEGORY_BY_SLUG[top[0]] : null;
        const lead = i === 0 && n > 0;
        return (
          <Link
            key={r.slug}
            href={`/mutaxassislar?region=${r.slug}`}
            aria-label={`${r.name}: ${n} ta mutaxassis`}
            className={cn(
              "group relative flex min-h-[156px] flex-col p-4 transition-[transform,box-shadow,border-color] duration-300",
              lead ? "rounded-[24px] bg-ink text-ink-fg shadow-[var(--shadow-2)] hover:-translate-y-[3px]" : "card card-hover",
            )}
          >
            <span
              className={cn(
                "absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border opacity-0 transition group-hover:opacity-100",
                lead ? "border-ink-fg/30 text-ink-fg" : "border-line text-fg-3",
              )}
              aria-hidden
            >
              <ArrowUpRight size={13} />
            </span>

            {lead && <span className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Eng faol</span>}
            <span className={cn("pr-8 text-[13.5px] font-semibold leading-tight", lead ? "text-ink-fg" : "text-fg")}>{r.short}</span>
            <span className={cn("mt-0.5 text-[11px]", lead ? "text-ink-fg/60" : "text-fg-3")}>{r.capital}</span>

            <span className={cn("mt-auto pt-4 font-display text-[30px] font-semibold leading-none", lead ? "text-ink-fg" : "text-fg")}>{n}</span>
            <span className={cn("mt-1 text-[11px]", lead ? "text-ink-fg/60" : "text-fg-3")}>{n === 1 ? "mutaxassis" : "mutaxassis"}</span>

            <span className={cn("mt-3 block h-1 w-full overflow-hidden rounded-full", lead ? "bg-ink-fg/15" : "bg-fg/8")} aria-hidden>
              <span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${n > 0 ? Math.max(8, (n / max) * 100) : 0}%` }} />
            </span>

            {cat && top ? (
              <span className={cn("mt-2.5 inline-flex items-center gap-1 truncate text-[11px] font-medium", lead ? "text-ink-fg/80" : "text-fg-2")}>
                <CategoryIcon icon={cat.icon} size={11} style={{ color: cat.accent }} />
                <span className="truncate">{cat.plural}</span>
                <span className={cn("font-bold", lead ? "text-ink-fg" : "text-fg")}>{top[1]}</span>
              </span>
            ) : (
              <span className="mt-2.5 text-[11px] font-medium text-accent">Birinchi bo'ling →</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
