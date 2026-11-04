import Link from "next/link";
import { Activity, ArrowDown, ArrowUp, Minus, Sparkles } from "lucide-react";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { CATEGORIES, CATEGORY_BY_SLUG, CATEGORY_GROUPS, REGIONS, REGION_BY_SLUG } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { TOP, TOP_LIVE } from "@/lib/i18n/dict/social";
import type { LiveLeaderboard as LiveData, LivePeriod } from "@/lib/leaderboard";
import { cn, compactCount } from "@/lib/utils";

/** Davr tabining havolasi — filtrlarni saqlaydi */
function hrefFor(period: LivePeriod, kasb: string | null, hudud: string | null): string {
  const q = new URLSearchParams();
  if (period !== "hafta") q.set("davr", period);
  if (kasb) q.set("kasb", kasb);
  if (hudud) q.set("hudud", hudud);
  const s = q.toString();
  return `/top${s ? `?${s}` : ""}#jonli`;
}

function Move({ move, til }: { move: number | null; til: Locale }) {
  if (move === null)
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent-text" title={tr(til, TOP_LIVE.newEntry)}>
        <Sparkles size={10} aria-hidden="true" /> {tr(til, TOP_LIVE.newEntry)}
      </span>
    );
  if (move === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[11.5px] tabular-nums text-fg-4" title={tr(til, TOP_LIVE.same)}>
        <Minus size={12} aria-hidden="true" />
      </span>
    );
  const up = move > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-bold tabular-nums", up ? "text-success-text" : "text-danger-text")} title={up ? TOP_LIVE.up[til](move) : TOP_LIVE.down[til](-move)}>
      {up ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}
      {Math.abs(move)}
    </span>
  );
}

/**
 * «Hafta faollari» — jonli reyting bo'limi (/top). Tablar `?davr=hafta|oy`, filtrlar `?kasb=&hudud=` (GET forma,
 * tanlash = yuborish). Telefonda qatorlar `m-plain` (karta ichida karta yo'q). `me` — kirgan mutaxassisning id'si:
 * TOP-10 dan tashqarida bo'lsa pastda «Siz: N-o'rin» qatori.
 */
export function LiveLeaderboard({ data, til, me }: { data: LiveData; til: Locale; me: { id: string; name: string; avatarUrl: string | null } | null }) {
  const { period, kasb, hudud, rows } = data;
  const myRank = me ? (data.ranks[me.id] ?? null) : null;
  const meInTop = myRank !== null && myRank <= rows.length;
  const hasFilter = Boolean(kasb || hudud);

  return (
    <section id="jonli" className="mt-8 scroll-mt-20" aria-labelledby="jonli-title">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="jonli-title" className="flex items-center gap-2 font-display text-[18px] font-bold text-fg">
            <Activity size={18} className="text-accent" aria-hidden="true" /> {tr(til, period === "oy" ? TOP_LIVE.titleMonth : TOP_LIVE.title)}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-fg-3">{tr(til, TOP_LIVE.lead)}</p>
        </div>
        {/* Davr tablari */}
        <div className="flex gap-1 rounded-full border border-line p-0.5" role="tablist" aria-label={tr(til, TOP_LIVE.title)}>
          {(["hafta", "oy"] as const).map((p) => (
            <Link key={p} href={hrefFor(p, kasb, hudud)} role="tab" aria-selected={period === p} scroll={false} className={cn("rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition", period === p ? "bg-fg text-bg" : "text-fg-2 hover:text-fg")}>
              {tr(til, p === "oy" ? TOP_LIVE.month : TOP_LIVE.week)}
            </Link>
          ))}
        </div>
      </div>

      {/* Filtrlar: kasb + hudud (GET, tanlash = yuborish) */}
      <form action="/top#jonli" method="get" className="mb-3 flex flex-wrap items-center gap-2">
        {period !== "hafta" && <input type="hidden" name="davr" value={period} />}
        <AutoSubmitSelect name="kasb" defaultValue={kasb ?? ""} aria-label={tr(til, TOP_LIVE.craft)} className="field h-9 min-w-0 flex-1 text-[13px] sm:max-w-[240px]">
          <option value="">{tr(til, TOP_LIVE.allCrafts)}</option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.slug} label={g.name}>
              {CATEGORIES.filter((c) => c.group === g.slug).map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="hudud" defaultValue={hudud ?? ""} aria-label={tr(til, TOP_LIVE.region)} className="field h-9 min-w-0 flex-1 text-[13px] sm:max-w-[220px]">
          <option value="">{tr(til, TOP_LIVE.allRegions)}</option>
          {REGIONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.short}
            </option>
          ))}
        </AutoSubmitSelect>
        {hasFilter && (
          <Link href={hrefFor(period, null, null)} scroll={false} className="text-[12.5px] font-semibold text-fg-3 hover:text-fg">
            {tr(til, TOP_LIVE.reset)}
          </Link>
        )}
        <noscript>
          <button type="submit" className="btn-ink h-9 rounded-full px-3 text-[12.5px]">
            OK
          </button>
        </noscript>
      </form>

      {rows.length === 0 ? (
        <p className="card m-flat px-4 py-8 text-center text-[13.5px] text-fg-3">{tr(til, TOP_LIVE.empty)}</p>
      ) : (
        <ol className="card divide-y divide-line max-sm:!rounded-none max-sm:!border-x-0 max-sm:!bg-transparent max-sm:border-y max-sm:border-line">
          {rows.map((r) => {
            const mine = me?.id === r.author.id;
            return (
              <li key={r.author.id} className={cn("m-plain flex items-center gap-3 px-4 py-2.5", mine && "!bg-accent-soft/40")}>
                <span className={cn("w-7 shrink-0 text-center font-display text-[15px] font-bold tabular-nums", r.rank <= 3 ? "text-fg" : "text-fg-3")}>{r.rank}</span>
                <Avatar name={r.author.name} src={r.author.avatarUrl} size={40} decorative />
                <span className="min-w-0 flex-1">
                  <Link href={r.author.slug ? `/mutaxassislar/${r.author.slug}` : "#"} className="flex items-center gap-1 text-[14px] font-semibold text-fg hover:underline">
                    <span className="truncate">{r.author.name}</span>
                    {r.author.isVerified && <VerifiedBadge size={14} />}
                  </Link>
                  <span className="block truncate text-[12px] text-fg-3">
                    {[r.author.category ? CATEGORY_BY_SLUG[r.author.category]?.name : null, r.author.regionSlug ? REGION_BY_SLUG[r.author.regionSlug]?.short : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Move move={r.move} til={til} />
                <span className="w-14 shrink-0 text-right">
                  <span className="block font-display text-[15px] font-bold tabular-nums text-fg">{compactCount(r.score)}</span>
                  <span className="block text-[10.5px] uppercase tracking-wider text-fg-4">{tr(til, TOP.points)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Kirgan mutaxassis TOP-10 dan tashqarida — o'z o'rni */}
      {me && !meInTop && (
        <div className="mt-2 flex items-center gap-3 rounded-card border border-dashed border-line-2 px-3 py-2.5 text-[13px] sm:px-4">
          <Avatar name={me.name} src={me.avatarUrl} size={32} decorative />
          {myRank !== null ? (
            <span className="min-w-0 flex-1 text-fg">
              <b>{TOP_LIVE.you[til](myRank)}</b> <span className="text-fg-3">· {TOP_LIVE.of[til](data.total)}</span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 text-fg-3">{tr(til, TOP_LIVE.youOut)}</span>
          )}
        </div>
      )}
    </section>
  );
}
