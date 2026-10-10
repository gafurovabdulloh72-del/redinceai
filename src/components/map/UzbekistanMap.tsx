"use client";

import { useId, useMemo, useState, type MouseEvent } from "react";
import { MapPin } from "lucide-react";
import { MAP_VIEWBOX, REGION_SHAPES } from "./regions-geo";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Label siljishlari (markaz nuqtadan), bir-birining ustiga tushmasligi uchun */
const LABEL_OFFSET: Record<string, [number, number]> = {
  "toshkent-viloyati": [46, -44],
  "toshkent-shahri": [-14, 34],
  sirdaryo: [-6, 30],
  jizzax: [-10, 10],
  namangan: [0, -14],
  andijon: [6, 12],
  fargona: [6, 16],
  xorazm: [-10, 10],
  surxondaryo: [10, 6],
  qashqadaryo: [0, 8],
  samarqand: [8, -4],
};

export interface UzbekistanMapProps {
  stats?: Record<string, RegionStat>;
  selected?: string | null;
  onSelect?: (slug: string | null) => void;
  className?: string;
  /** Hudud bosilganda sahifaga o'tish (onSelect o'rniga) */
  hrefFor?: (slug: string) => string;
  showLabels?: boolean;
  compact?: boolean;
}

export function UzbekistanMap({ stats, selected, onSelect, className, hrefFor, showLabels = true, compact = false }: UzbekistanMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const gradId = useId();

  const max = useMemo(() => Math.max(1, ...Object.values(stats ?? {}).map((s) => s.total)), [stats]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const active = hover ?? selected ?? null;
  const activeStat = active ? stats?.[active] : undefined;
  const activeRegion = active ? REGION_BY_SLUG[active] : undefined;

  return (
    <div className={cn("relative select-none", className)}>
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        className="h-auto w-full overflow-visible"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
        role="img"
        aria-label="O'zbekiston hududlari xaritasi"
      >
        <defs>
          {/* Shisha yuzasi: yuqoridan tushayotgan yorug'lik */}
          <linearGradient id={`${gradId}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id={`${gradId}-sel`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--tint)" />
            <stop offset="100%" stopColor="var(--tint-2)" />
          </linearGradient>
          <filter id={`${gradId}-shadow`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="var(--glass-shadow-strong)" floodOpacity="0.6" />
          </filter>
          <clipPath id={`${gradId}-clip`}>
            {REGION_SHAPES.map((r) => (
              <path key={r.slug} d={r.d} />
            ))}
          </clipPath>
        </defs>

        {/* Pastki soya (butun mamlakat) */}
        <g filter={`url(#${gradId}-shadow)`} opacity="0.9">
          {REGION_SHAPES.map((r) => (
            <path key={r.slug} d={r.d} fill="var(--glass)" />
          ))}
        </g>

        {/* Hududlar */}
        <g>
          {REGION_SHAPES.map((r) => {
            const n = stats?.[r.slug]?.total ?? 0;
            const t = n / max; // 0..1
            const isSel = selected === r.slug;
            const isHov = hover === r.slug;
            const fill = isSel ? `url(#${gradId}-sel)` : `color-mix(in srgb, var(--tint) ${Math.round(10 + t * 55)}%, var(--glass-strong))`;
            const content = (
              <path
                d={r.d}
                className={cn("region-path", (isSel || isHov) && "is-active")}
                fill={fill}
                stroke={isSel ? "#fff" : "var(--glass-border)"}
                strokeWidth={isSel ? 2.2 : 1.2}
                strokeLinejoin="round"
                opacity={active && !isSel && !isHov ? 0.82 : 1}
                onMouseEnter={() => setHover(r.slug)}
                onClick={() => onSelect?.(selected === r.slug ? null : r.slug)}
                tabIndex={0}
                role="button"
                aria-label={`${r.name}: ${n} ta mutaxassis`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(selected === r.slug ? null : r.slug);
                  }
                }}
              />
            );
            return hrefFor ? (
              <a key={r.slug} href={hrefFor(r.slug)}>
                {content}
              </a>
            ) : (
              <g key={r.slug}>{content}</g>
            );
          })}
        </g>

        {/* Shisha yorug'lik qatlami (bosilmaydi) */}
        <g clipPath={`url(#${gradId}-clip)`} pointerEvents="none">
          <rect width={MAP_VIEWBOX.width} height={MAP_VIEWBOX.height} fill={`url(#${gradId}-sheen)`} style={{ mixBlendMode: "soft-light" }} />
        </g>

        {/* Mutaxassislar soni — nuqta va label */}
        {showLabels && (
          <g pointerEvents="none">
            {REGION_SHAPES.map((r) => {
              const n = stats?.[r.slug]?.total ?? 0;
              const [ox, oy] = LABEL_OFFSET[r.slug] ?? [0, 0];
              const x = r.cx + ox;
              const y = r.cy + oy;
              const isSel = selected === r.slug;
              const isCity = r.slug === "toshkent-shahri";
              return (
                <g key={r.slug} className="transition-opacity duration-300">
                  {n > 0 && (
                    <>
                      <circle cx={r.cx} cy={r.cy} r={isCity ? 5 : 6 + Math.sqrt(n) * 2.2} fill="var(--tint)" opacity="0.18" />
                      <circle cx={r.cx} cy={r.cy} r={isCity ? 3.5 : 4} fill={isSel ? "#fff" : "var(--tint)"} stroke="#fff" strokeWidth="1.5" />
                    </>
                  )}
                  {!compact && (
                    <g transform={`translate(${x}, ${y})`}>
                      <rect
                        x={-((REGION_BY_SLUG[r.slug]?.short.length ?? 6) * 3.9 + 14)}
                        y={-11}
                        width={(REGION_BY_SLUG[r.slug]?.short.length ?? 6) * 7.8 + 28}
                        height={22}
                        rx={11}
                        fill="var(--glass-strong)"
                        stroke="var(--glass-border-soft)"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={12}
                        fontWeight={600}
                        fill="var(--fg)"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {REGION_BY_SLUG[r.slug]?.short}
                        {n > 0 && (
                          <tspan fill="var(--tint)" fontWeight={700}>
                            {" "}
                            {n}
                          </tspan>
                        )}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Glass tooltip */}
      {tip && activeRegion && hover && (
        <div
          className="glass-strong pointer-events-none absolute z-10 w-56 !rounded-[20px] p-3.5 animate-fade-up"
          style={{ left: Math.min(tip.x + 16, (tip.x > 0 ? 9999 : 0)), top: tip.y + 16, animationDuration: "0.2s" }}
        >
          <div className="flex items-center gap-2">
            <span className="glass-tint flex h-7 w-7 items-center justify-center rounded-[9px]">
              <MapPin size={14} />
            </span>
            <div>
              <p className="text-[14px] font-semibold leading-tight text-fg">{activeRegion.name}</p>
              <p className="text-[11px] text-fg-3">Markaz: {activeRegion.capital}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[13px] text-fg-2">
            <span className="text-lg font-bold text-tint">{activeStat?.total ?? 0}</span> ta mutaxassis
          </p>
          {activeStat && activeStat.total > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {Object.entries(activeStat.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([cat, n]) => (
                  <li key={cat} className="flex justify-between text-[12px] text-fg-3">
                    <span>{CATEGORY_BY_SLUG[cat]?.plural ?? cat}</span>
                    <span className="font-semibold text-fg-2">{n}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
