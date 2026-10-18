import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { SAHIFALASH } from "@/lib/i18n/dict/catalog";
import { cn } from "@/lib/utils";

/** Query obyektidan to'liq href yasaydi (bo'sh qiymatlar tashlab yuboriladi) */
export function buildHref(basePath: string, query: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** 1 … 4 [5] 6 … 12 ko'rinishidagi sahifa raqamlari */
function pageWindow(page: number, pages: number, delta = 1): Array<number | "…"> {
  const set = new Set<number>([1, pages]);
  for (let p = page - delta; p <= page + delta; p++) if (p >= 1 && p <= pages) set.add(p);
  const sorted = [...set].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev === 2) out.push(prev + 1);
    else if (p - prev > 2) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/* 44px pill — bosish maydoni mobil uchun yetarli */
const pill = "press inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3.5 text-[14px] font-semibold tabular-nums transition";

function PageLink({
  href,
  active,
  disabled,
  label,
  rel,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  label?: string;
  rel?: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled="true" className={cn(pill, "border border-line text-fg-4 opacity-50")}>
        {children}
      </span>
    );
  }
  if (active) {
    return (
      <span aria-current="page" className={cn(pill, "btn-ink")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} aria-label={label} scroll className={cn(pill, "border border-line bg-surface text-fg-2 hover:border-fg hover:text-fg")}>
      {children}
    </Link>
  );
}

export async function Pagination({
  page,
  pages,
  query,
  basePath = "/mutaxassislar",
  className,
}: {
  page: number;
  pages: number;
  /** Joriy filtr parametrlari (page'siz ham bo'lsa bo'ladi — qayta yoziladi) */
  query: Record<string, string | undefined>;
  basePath?: string;
  className?: string;
}) {
  if (pages <= 1) return null;
  const til = await getLocale();

  const href = (p: number) => buildHref(basePath, { ...query, page: p > 1 ? String(p) : undefined });
  const items = pageWindow(page, pages);

  return (
    <nav aria-label={tr(til, SAHIFALASH.navAria)} className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PageLink href={href(page - 1)} disabled={page <= 1} label={tr(til, SAHIFALASH.prev)} rel="prev">
          <ChevronLeft size={18} />
        </PageLink>

        {items.map((it, i) =>
          it === "…" ? (
            <span key={`gap-${i}`} className="w-6 text-center text-fg-4" aria-hidden="true">
              …
            </span>
          ) : (
            <PageLink key={it} href={href(it)} active={it === page} label={SAHIFALASH.pageN[til](it)}>
              {it}
            </PageLink>
          ),
        )}

        <PageLink href={href(page + 1)} disabled={page >= pages} label={tr(til, SAHIFALASH.next)} rel="next">
          <ChevronRight size={18} />
        </PageLink>
      </div>
      {/* "1 / 5 sahifa" matni — faol pill allaqachon ko'rsatadi; ekran o'quvchi uchun saqlanadi */}
      <p className="sr-only">{SAHIFALASH.ofPages[til](page, pages)}</p>
    </nav>
  );
}
