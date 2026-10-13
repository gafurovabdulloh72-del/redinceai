"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import type { AdminAnalytics as AnalyticsData, FunnelStep, RankRow } from "@/app/admin/analytics";
import { cn, formatNumber, formatPrice } from "@/lib/utils";

/*
 * Admin analitikasi (F86) — kutubxonasiz inline SVG grafiklar.
 * dataviz qoidalari: ingichka belgilar (ustun ≤ 24px, 4px yumaloq uchi, asosi to'g'ri), 2px chiziq, ≥ 8px nuqta + 2px yuza halqasi,
 * segmentlar orasida 2px yuza oralig'i, nozik to'r, ≥ 2 seriyada legenda, matn — matn tokenlarida (seriya rangida emas),
 * hover/fokusda tooltip, har bir grafikning jadval ko'rinishi. Ranglar: --chart-1 / --chart-2 (ikkala rejim uchun tekshirilgan).
 */

const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const dayLabel = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${d}-${MONTHS_SHORT[(m ?? 1) - 1]}`;
};

/** O'q yorliqlari uchun ixcham summa: 1,2 mln · 500 ming · 900 */
function compactMoney(n: number): string {
  if (n >= 1_000_000) return `${String(Math.round(n / 100_000) / 10).replace(".", ",")} mln`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} ming`;
  return formatNumber(n);
}

/** "Chiroyli" qadam: max'ni 3–4 ta toza bo'lakka bo'ladi; sonlar uchun qadam kamida 1 */
function niceScale(max: number, integer: boolean): { top: number; ticks: number[] } {
  if (max <= 0) return { top: integer ? 4 : 1, ticks: integer ? [0, 2, 4] : [0] };
  const rough = max / 3;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  if (integer) step = Math.max(1, Math.ceil(step));
  const top = step * Math.ceil(max / step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

/** Konteyner kengligi (SSR'da taxminiy qiymat, keyin o'lchanadi) */
function useWidth<T extends HTMLElement>(fallback = 520) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(240, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Faqat yuqori burchaklari yumaloq ustun (asosi to'g'ri) */
function topRounded(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Tooltip faol belgining yonida — uni yopmaydi: o'ng yarmida chapga, chap yarmida o'ngga ochiladi */
function tipStyle(x: number, width: number): CSSProperties {
  return x > width / 2 ? { right: Math.max(0, width - x + 12) } : { left: x + 12 };
}

interface Series {
  key: string;
  name: string;
  color: string;
}

function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-2">
      {series.map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

function ChartCard({ title, subtitle, figure, legend, children, className }: { title: string; subtitle: string; figure?: ReactNode; legend?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("card m-0 min-w-0 p-4 sm:p-5", className)}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <span className="min-w-0">
          <span className="block font-display text-[16px] font-semibold text-fg">{title}</span>
          <span className="block text-[12px] text-fg-3">{subtitle}</span>
        </span>
        {figure && <span className="font-display text-[20px] font-semibold leading-tight text-fg">{figure}</span>}
      </figcaption>
      {legend && <div className="mt-3">{legend}</div>}
      <div className="mt-3">{children}</div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Ustunli grafik (stacked yoki grouped) — vaqt bo'yicha               */
/* ------------------------------------------------------------------ */
interface ColumnPoint {
  key: string;
  label: string;
  values: number[];
}

function ColumnChart({
  points,
  series,
  mode,
  money,
  title,
  desc,
  xLabel,
}: {
  points: ColumnPoint[];
  series: Series[];
  mode: "stacked" | "grouped";
  money: boolean;
  title: string;
  desc: string;
  xLabel: (p: ColumnPoint) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const uid = useId();
  const H = 200;
  const padL = money ? 52 : 30;
  const padR = 6;
  const padT = 10;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = H - padT - padB;
  const n = points.length;
  const slot = plotW / Math.max(1, n);
  const totals = points.map((p) => (mode === "stacked" ? p.values.reduce((s, v) => s + v, 0) : Math.max(0, ...p.values)));
  const { top, ticks } = niceScale(Math.max(0, ...totals), !money);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const fmt = money ? compactMoney : (v: number) => formatNumber(v);
  const empty = totals.every((t) => t === 0);

  const k = series.length;
  const groupW = mode === "stacked" ? Math.min(24, slot * 0.66) : Math.min(24 * k + 2 * (k - 1), slot * 0.78);
  const barW = mode === "stacked" ? groupW : Math.max(1, (groupW - 2 * (k - 1)) / k);

  // X o'qi: kenglikka qarab 3–6 ta yorliq (ustma-ust tushmasin)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(plotW / 64))));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const tip = active != null ? points[active] : null;
  const tipX = active != null ? padL + slot * active + slot / 2 : 0;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
        className="block max-w-full rounded-[var(--r-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <title id={`${uid}-t`}>{title}</title>
        <desc id={`${uid}-d`}>{desc}</desc>
        {/* To'r va Y o'qi */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--fg-3)" className="tabular-nums">
              {fmt(t)}
            </text>
          </g>
        ))}
        {/* Ustunlar */}
        {points.map((p, i) => {
          const cx = padL + slot * i + slot / 2;
          const dim = active != null && active !== i;
          if (mode === "stacked") {
            let base = y(0);
            let drawn = 0;
            const lastIdx = p.values.reduce((li, v, si) => (v > 0 ? si : li), -1);
            return (
              <g key={p.key} opacity={dim ? 0.45 : 1}>
                {p.values.map((v, si) => {
                  if (v <= 0) return null;
                  const gap = drawn > 0 ? 2 : 0;
                  const h = Math.max(2, (v / top) * plotH) - gap;
                  const yTop = base - gap - h;
                  const d = si === lastIdx ? topRounded(cx - barW / 2, yTop, barW, h) : `M${cx - barW / 2},${yTop}h${barW}v${h}h${-barW}Z`;
                  base = yTop;
                  drawn++;
                  return <path key={series[si].key} d={d} fill={series[si].color} />;
                })}
              </g>
            );
          }
          return (
            <g key={p.key} opacity={dim ? 0.45 : 1}>
              {p.values.map((v, si) => {
                if (v <= 0) return null;
                const h = Math.max(2, (v / top) * plotH);
                const x = cx - groupW / 2 + si * (barW + 2);
                return <path key={series[si].key} d={topRounded(x, y(0) - h, barW, h)} fill={series[si].color} />;
              })}
            </g>
          );
        })}
        {/* Asos chizig'i */}
        <line x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} stroke="var(--line-2)" strokeWidth={1} shapeRendering="crispEdges" />
        {/* X yorliqlari */}
        {/* Oxiridan hisoblanadi — eng so'nggi kun/hafta doim yorliqli */}
        {points.map((p, i) =>
          (n - 1 - i) % labelEvery === 0 ? (
            <text key={p.key} x={padL + slot * i + slot / 2} y={H - 6} textAnchor={i === n - 1 ? "end" : "middle"} dx={i === n - 1 ? slot / 2 : 0} fontSize={10.5} fill="var(--fg-3)">
              {xLabel(p)}
            </text>
          ) : null,
        )}
        {/* Hover/bosish nishonlari — ustundan kattaroq (butun slot) */}
        {points.map((p, i) => (
          <rect key={p.key} x={padL + slot * i} y={padT} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />
        ))}
        {empty && (
          <text x={padL + plotW / 2} y={padT + plotH / 2} textAnchor="middle" fontSize={12.5} fill="var(--fg-3)">
            Bu davrda ma&apos;lumot yo&apos;q
          </text>
        )}
      </svg>
      {tip && (
        <div
          role="status"
          className="card-floating pointer-events-none absolute top-0 z-10 whitespace-nowrap px-3 py-2 text-[12px]"
          style={tipStyle(tipX, width)}
        >
          <p className="font-semibold text-fg">{tip.label}</p>
          <ul className="mt-1 space-y-0.5">
            {series.map((s, si) => (
              <li key={s.key} className="flex items-center justify-between gap-3 text-fg-2">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-semibold text-fg tabular-nums">{money ? formatPrice(tip.values[si]) : formatNumber(tip.values[si])}</span>
              </li>
            ))}
          </ul>
          {mode === "stacked" && series.length > 1 && (
            <p className="mt-1 flex justify-between gap-3 border-t border-line pt-1 text-fg-2">
              Jami <span className="font-semibold text-fg tabular-nums">{money ? formatPrice(tip.values.reduce((a, b) => a + b, 0)) : formatNumber(tip.values.reduce((a, b) => a + b, 0))}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chiziqli grafik (bitta seriya) — kunlik buyurtmalar                  */
/* ------------------------------------------------------------------ */
function LineChart({ points, title, desc, color }: { points: { key: string; label: string; value: number }[]; title: string; desc: string; color: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const uid = useId();
  const H = 200;
  const padL = 30;
  const padR = 28;
  const padT = 14;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = H - padT - padB;
  const n = points.length;
  const { top, ticks } = niceScale(Math.max(0, ...points.map((p) => p.value)), true);
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(plotW / 64))));
  const last = n - 1;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };
  const tip = active != null ? points[active] : null;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-labelledby={`${uid}-t ${uid}-d`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
        className="block max-w-full rounded-[var(--r-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <title id={`${uid}-t`}>{title}</title>
        <desc id={`${uid}-d`}>{desc}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
            <text x={padL - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--fg-3)" className="tabular-nums">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={color} fillOpacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          (n - 1 - i) % labelEvery === 0 ? (
            <text key={p.key} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"} fontSize={10.5} fill="var(--fg-3)">
              {dayLabel(p.key)}
            </text>
          ) : null,
        )}
        {/* Oxirgi qiymat — to'g'ridan-to'g'ri yorliq */}
        {n > 0 && active == null && (
          <g>
            <circle cx={x(last)} cy={y(points[last].value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
            <text x={x(last) + 8} y={y(points[last].value)} dy="0.32em" fontSize={11} fontWeight={600} fill="var(--fg)" className="tabular-nums">
              {points[last].value}
            </text>
          </g>
        )}
        {/* Kursor chizig'i + faol nuqta */}
        {active != null && tip && (
          <g pointerEvents="none">
            <line x1={x(active)} x2={x(active)} y1={padT} y2={y(0)} stroke="var(--line-2)" strokeWidth={1} />
            <circle cx={x(active)} cy={y(tip.value)} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        {points.map((p, i) => {
          const half = n <= 1 ? plotW / 2 : plotW / (n - 1) / 2;
          return <rect key={p.key} x={x(i) - half} y={padT} width={half * 2} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} />;
        })}
      </svg>
      {tip && active != null && (
        <div role="status" className="card-floating pointer-events-none absolute top-0 z-10 whitespace-nowrap px-3 py-2 text-[12px]" style={tipStyle(x(active), width)}>
          <p className="font-semibold text-fg">{tip.label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-fg-2">
            <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: color }} />
            <span className="font-semibold text-fg tabular-nums">{tip.value}</span> ta buyurtma
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gorizontal ustunlar (reyting) va voronka                            */
/* ------------------------------------------------------------------ */
function RankBars({ rows, unit, color }: { rows: RankRow[]; unit: string; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.orders));
  if (!rows.length) return <p className="rounded-[var(--r-sm)] bg-surface-2 px-4 py-6 text-center text-[13px] text-fg-3">Bu davrda ma&apos;lumot yo&apos;q</p>;
  return (
    <ol className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-[13px] sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]">
          <span className="truncate text-fg-2" title={r.label}>
            {r.label}
          </span>
          <span className="block h-3 min-w-0" aria-hidden="true">
            <span className="block h-3 rounded-r-[4px]" style={{ width: `${Math.max(2, (r.orders / max) * 100)}%`, background: color }} />
          </span>
          <span className="text-right font-semibold text-fg tabular-nums">
            {r.orders}
            <span className="sr-only"> {unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Funnel({ steps, color }: { steps: FunnelStep[]; color: string }) {
  const first = steps[0]?.value ?? 0;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = first > 0 ? Math.round((s.value / first) * 100) : 0;
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev != null && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.key} className="text-[13px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg-2">
                <span className="mr-1.5 font-semibold text-fg-3 tabular-nums">{i + 1}.</span>
                {s.label}
              </span>
              <span className="shrink-0 text-right">
                <span className="font-semibold text-fg tabular-nums">{s.value}</span>
                <span className="text-fg-3 tabular-nums"> · {pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-3 rounded-r-[4px] bg-surface-3" aria-hidden="true">
              <div className="h-3 rounded-r-[4px]" style={{ width: `${first > 0 ? Math.max(s.value > 0 ? 2 : 0, pct) : 0}%`, background: color }} />
            </div>
            {conv != null && <p className="mt-1 text-[11.5px] text-fg-3">oldingi bosqichdan {conv}% o&apos;tdi</p>}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Jadval ko'rinishi                                                   */
/* ------------------------------------------------------------------ */
function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="max-h-[300px] overflow-auto rounded-[var(--r-sm)] border border-line">
      <table className="w-full text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn("whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-3", i === 0 ? "text-left" : "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={cn("whitespace-nowrap px-3 py-1.5", ci === 0 ? "text-left text-fg-2" : "text-right font-medium text-fg tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bo'lim                                                              */
/* ------------------------------------------------------------------ */
export function AdminAnalytics({ data }: { data: AnalyticsData }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const c1 = "var(--chart-1)";
  const c2 = "var(--chart-2)";
  const revenueSeries: Series[] = [
    { key: "commission", name: "Komissiya (yakunlangan)", color: c1 },
    { key: "subscription", name: "Obuna to'lovlari", color: c2 },
  ];
  const signupSeries: Series[] = [
    { key: "specialists", name: "Mutaxassislar", color: c1 },
    { key: "clients", name: "Mijozlar", color: c2 },
  ];
  const { totals, windows } = data;
  const t = view === "table";

  const revenuePoints: ColumnPoint[] = data.revenue.map((d) => ({ key: d.day, label: dayLabel(d.day), values: [d.commission, d.subscription] }));
  const signupPoints: ColumnPoint[] = data.signups.map((w) => ({ key: w.week, label: `${dayLabel(w.week)} haftasi`, values: [w.specialists, w.clients] }));
  const orderPoints = data.orders.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d.orders }));
  const bestDay = data.orders.reduce((b, d) => (d.orders > b.orders ? d : b), data.orders[0] ?? { day: "", orders: 0 });

  return (
    <div>
      {/* Boshqaruv qatori: grafik / jadval */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-fg-3">
          Oxirgi {windows.days} kun · haftalik — {windows.weeks} hafta · reyting va voronka — {windows.topDays} kun
        </p>
        <div className="segment" role="group" aria-label="Ko'rinish">
          <button type="button" className="segment-item inline-flex min-h-10 items-center gap-1.5" data-active={!t} aria-pressed={!t} onClick={() => setView("chart")}>
            <BarChart3 size={14} /> Grafik
          </button>
          <button type="button" className="segment-item inline-flex min-h-10 items-center gap-1.5" data-active={t} aria-pressed={t} onClick={() => setView("table")}>
            <Table2 size={14} /> Jadval
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Kunlik daromad"
          subtitle={`Komissiya ${formatPrice(totals.commission30, { compact: true })} · obuna ${formatPrice(totals.subscription30, { compact: true })}`}
          figure={formatPrice(totals.revenue30, { compact: totals.revenue30 >= 10_000_000 })}
          legend={!t && <Legend series={revenueSeries} />}
        >
          {t ? (
            <DataTable
              caption="Kunlik daromad, so'm"
              head={["Kun", "Komissiya", "Obuna", "Jami"]}
              rows={data.revenue.map((d) => [dayLabel(d.day), formatPrice(d.commission), formatPrice(d.subscription), formatPrice(d.commission + d.subscription)])}
            />
          ) : (
            <ColumnChart
              points={revenuePoints}
              series={revenueSeries}
              mode="stacked"
              money
              title="Kunlik daromad, oxirgi 30 kun"
              desc={`Jami ${formatPrice(totals.revenue30)}: yakunlangan to'lovlar komissiyasi ${formatPrice(totals.commission30)}, obuna to'lovlari ${formatPrice(totals.subscription30)}.`}
              xLabel={(p) => p.label}
            />
          )}
        </ChartCard>

        <ChartCard title="Kunlik buyurtmalar" subtitle={bestDay.orders > 0 ? `Eng faol kun: ${dayLabel(bestDay.day)} (${bestDay.orders} ta)` : "Yaratilgan buyurtmalar"} figure={`${totals.orders30} ta`}>
          {t ? (
            <DataTable caption="Kunlik yaratilgan buyurtmalar" head={["Kun", "Buyurtmalar"]} rows={data.orders.map((d) => [dayLabel(d.day), d.orders])} />
          ) : (
            <LineChart points={orderPoints} color={c1} title="Kunlik yaratilgan buyurtmalar, oxirgi 30 kun" desc={`Jami ${totals.orders30} ta buyurtma; eng ko'p — ${bestDay.orders} ta.`} />
          )}
        </ChartCard>

        <ChartCard
          title="Yangi foydalanuvchilar"
          subtitle={`Haftalik ro'yxatdan o'tish · ${windows.weeks} haftada ${totals.specialists12w} mutaxassis, ${totals.clients12w} mijoz`}
          legend={!t && <Legend series={signupSeries} />}
        >
          {t ? (
            <DataTable caption="Haftalik yangi foydalanuvchilar" head={["Hafta", "Mutaxassislar", "Mijozlar"]} rows={data.signups.map((w) => [dayLabel(w.week), w.specialists, w.clients])} />
          ) : (
            <ColumnChart
              points={signupPoints}
              series={signupSeries}
              mode="grouped"
              money={false}
              title="Haftalik yangi mutaxassislar va mijozlar"
              desc={`${windows.weeks} haftada ${totals.specialists12w} ta yangi mutaxassis va ${totals.clients12w} ta yangi mijoz.`}
              xLabel={(p) => dayLabel(p.key)}
            />
          )}
        </ChartCard>

        <ChartCard title="Buyurtma voronkasi" subtitle={`Oxirgi ${windows.topDays} kunda yaratilgan buyurtmalar`}>
          {t ? (
            <DataTable
              caption="Buyurtma voronkasi"
              head={["Bosqich", "Soni", "Ulushi"]}
              rows={data.funnel.map((s) => [s.label, s.value, `${data.funnel[0]?.value ? Math.round((s.value / data.funnel[0].value) * 100) : 0}%`])}
            />
          ) : (
            <Funnel steps={data.funnel} color={c1} />
          )}
        </ChartCard>

        <ChartCard title="Top yo'nalishlar" subtitle={`Buyurtmalar soni · ${windows.topDays} kun`}>
          {t ? (
            <DataTable caption="Yo'nalishlar bo'yicha buyurtmalar" head={["Yo'nalish", "Buyurtmalar"]} rows={data.topCategories.map((r) => [r.label, r.orders])} />
          ) : (
            <RankBars rows={data.topCategories} unit="ta buyurtma" color={c1} />
          )}
        </ChartCard>

        <ChartCard title="Top hududlar" subtitle={`Buyurtmalar soni · ${windows.topDays} kun`}>
          {t ? (
            <DataTable caption="Hududlar bo'yicha buyurtmalar" head={["Hudud", "Buyurtmalar"]} rows={data.topRegions.map((r) => [r.label, r.orders])} />
          ) : (
            <RankBars rows={data.topRegions} unit="ta buyurtma" color={c1} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
