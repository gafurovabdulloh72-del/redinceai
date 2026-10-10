"use client";

import { useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { MAP_VIEWBOX, REGION_SHAPES } from "./regions-geo";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * O'zbekiston xaritasi — premium 2D.
 * - Hudud bo'yicha gradient bo'yoq (mutaxassislar soni)
 * - Ostida qalin "plita" (yengil 3D hissi), hover'da hudud ko'tariladi
 * - Pulsatsiya qiluvchi markerlar, tooltip
 * - variant="hero": perspektiva bilan qiyshaytirilgan, sichqonchaga ergashadi
 */

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
  /** Faqat sonlar kerak bo'lsa (stats o'rniga) */
  counts?: Record<string, number>;
  selected?: string | null;
  onSelect?: (slug: string | null) => void;
  className?: string;
  /** Hudud bosilganda shu sahifaga o'tish (server komponentdan ham berish mumkin) */
  linkTo?: "mutaxassislar" | "xarita";
  hrefFor?: (slug: string) => string;
  showLabels?: boolean;
  compact?: boolean;
  variant?: "panel" | "hero";
  /** Tooltip'dagi birlik: "mutaxassis" (default) yoki masalan "montajor" */
  unitLabel?: string;
}

const SLAB = 18; // plita qalinligi (viewBox birligida)

export function UzbekistanMap({
  stats,
  counts,
  selected,
  onSelect,
  className,
  linkTo,
  hrefFor,
  showLabels = true,
  compact = false,
  variant = "panel",
  unitLabel = "mutaxassis",
}: UzbekistanMapProps) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");

  const count = (slug: string) => counts?.[slug] ?? stats?.[slug]?.total ?? 0;
  const max = useMemo(() => Math.max(1, ...REGION_SHAPES.map((r) => count(r.slug))), [stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => REGION_SHAPES.reduce((a, r) => a + count(r.slug), 0), [stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const isHero = variant === "hero";
  const topSlugs = useMemo(
    () => [...REGION_SHAPES].sort((a, b) => count(b.slug) - count(a.slug)).slice(0, 3).map((r) => r.slug),
    [stats, counts], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const active = hover ?? selected ?? null;
  const activeRegion = active ? REGION_BY_SLUG[active] : undefined;
  const activeStat = active ? stats?.[active] : undefined;

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onWrapMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isHero || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: px, y: py });
  };

  const pick = (slug: string) => {
    if (onSelect) onSelect(selected === slug ? null : slug);
    else if (hrefFor) router.push(hrefFor(slug));
    else if (linkTo === "xarita") router.push(`/xarita?region=${slug}`);
    else router.push(`/mutaxassislar?region=${slug}`);
  };

  const vb = `-24 -24 ${MAP_VIEWBOX.width + 48} ${MAP_VIEWBOX.height + 48 + SLAB}`;

  return (
    <div
      ref={wrap}
      className={cn("relative select-none", isHero && "[perspective:1600px]", className)}
      onPointerMove={onWrapMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div
        className={cn(isHero && "transition-transform duration-700 ease-out will-change-transform")}
        style={
          isHero
            ? { transform: `rotateX(${22 - tilt.y * 6}deg) rotateY(${tilt.x * 8}deg) rotateZ(-4deg)`, transformStyle: "preserve-3d" }
            : undefined
        }
      >
        <svg
          viewBox={vb}
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
            <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-sel`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
            <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy={isHero ? 28 : 14} stdDeviation={isHero ? 26 : 14} floodColor="#000" floodOpacity={isHero ? 0.28 : 0.16} />
            </filter>
            <filter id={`${uid}-lift`} x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="var(--accent)" floodOpacity="0.45" />
            </filter>
            <clipPath id={`${uid}-clip`}>
              {REGION_SHAPES.map((r) => (
                <path key={r.slug} d={r.d} />
              ))}
            </clipPath>
          </defs>

          {/* Orqa nur */}
          {isHero && <ellipse cx={MAP_VIEWBOX.width / 2} cy={MAP_VIEWBOX.height / 2 + 40} rx={560} ry={300} fill={`url(#${uid}-glow)`} />}

          {/* Plita (qalinlik): bir nechta qatlam pastga siljitilgan */}
          <g filter={`url(#${uid}-shadow)`}>
            {Array.from({ length: isHero ? 6 : 3 }).map((_, i, arr) => {
              const n = arr.length;
              const dy = ((n - i) / n) * SLAB;
              const shade = i === n - 1 ? "var(--map-slab-top)" : "var(--map-slab)";
              return (
                <g key={i} transform={`translate(0, ${dy})`}>
                  {REGION_SHAPES.map((r) => (
                    <path key={r.slug} d={r.d} fill={shade} stroke="var(--map-slab-line)" strokeWidth={1} strokeLinejoin="round" />
                  ))}
                </g>
              );
            })}
          </g>

          {/* Ustki yuzalar */}
          <g>
            {REGION_SHAPES.map((r) => {
              const n = count(r.slug);
              const t = n / max;
              const isSel = selected === r.slug;
              const isHov = hover === r.slug;
              const pct = Math.round(8 + Math.pow(t, 0.7) * 78);
              const fill = isSel ? `url(#${uid}-sel)` : `color-mix(in srgb, var(--accent) ${pct}%, var(--map-base))`;
              return (
                <path
                  key={r.slug}
                  d={r.d}
                  className={cn("region-path", (isSel || isHov) && "is-active")}
                  fill={fill}
                  stroke="var(--map-line)"
                  strokeWidth={isSel || isHov ? 2.4 : 1.6}
                  strokeLinejoin="round"
                  filter={isSel || isHov ? `url(#${uid}-lift)` : undefined}
                  style={{ transform: isSel || isHov ? "translateY(-8px)" : undefined }}
                  opacity={active && !isSel && !isHov ? 0.9 : 1}
                  onMouseEnter={() => setHover(r.slug)}
                  onClick={() => pick(r.slug)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${r.name}: ${n} ta mutaxassis`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pick(r.slug);
                    }
                  }}
                />
              );
            })}
          </g>

          {/* Yorug'lik qatlami */}
          <g clipPath={`url(#${uid}-clip)`} pointerEvents="none">
            <rect x={-24} y={-24} width={MAP_VIEWBOX.width + 48} height={MAP_VIEWBOX.height + 48} fill={`url(#${uid}-sheen)`} style={{ mixBlendMode: "soft-light" }} />
          </g>

          {/* Markerlar */}
          <g pointerEvents="none">
            {REGION_SHAPES.map((r, i) => {
              const n = count(r.slug);
              if (n === 0) return null;
              const t = n / max;
              const base = (isHero ? 7 : 5) + Math.sqrt(t) * (isHero ? 10 : 7);
              const isSel = selected === r.slug;
              return (
                <g key={r.slug} transform={`translate(${r.cx}, ${r.cy})`}>
                  <circle r={base} className="map-pulse" fill="var(--accent)" style={{ animationDelay: `${(i % 5) * 0.45}s` }} />
                  <circle r={base} className="map-pulse" fill="var(--accent)" style={{ animationDelay: `${(i % 5) * 0.45 + 1.2}s` }} />
                  <circle r={base * 0.55} fill={isSel ? "#fff" : "var(--accent)"} stroke="var(--map-base)" strokeWidth={2} />
                  {isHero && topSlugs.includes(r.slug) && (
                    <g transform={`translate(${(LABEL_OFFSET[r.slug]?.[0] ?? 0) + base + 6}, ${(LABEL_OFFSET[r.slug]?.[1] ?? 0) * 0.6})`}>
                      <rect x={0} y={-11} width={String(n).length * 8 + 16} height={22} rx={11} fill="var(--ink)" />
                      <text x={8} y={0} dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink-fg)" fontFamily="var(--font-display)">
                        {n}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Yorliqlar (panel rejimida) */}
          {showLabels && !isHero && !compact && (
            <g pointerEvents="none" className="hidden sm:block">
              {REGION_SHAPES.map((r) => {
                const n = count(r.slug);
                const [ox, oy] = LABEL_OFFSET[r.slug] ?? [0, 0];
                const label = REGION_BY_SLUG[r.slug]?.short ?? r.name;
                const w = label.length * 7.4 + (n > 0 ? String(n).length * 8 + 18 : 14);
                return (
                  <g key={r.slug} transform={`translate(${r.cx + ox}, ${r.cy + oy + (n > 0 ? 18 : 0)})`}>
                    <rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill="var(--surface)" stroke="var(--line)" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={600} fill="var(--fg)" style={{ letterSpacing: "-0.01em" }}>
                      {label}
                      {n > 0 && (
                        <tspan fill="var(--accent)" fontWeight={800}>
                          {" "}
                          {n}
                        </tspan>
                      )}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tip && activeRegion && hover && (
        <div
          className="card-elevated pointer-events-none absolute z-10 w-56 !rounded-[18px] p-3.5 animate-fade-up"
          style={{
            left: Math.min(tip.x + 16, (wrap.current?.clientWidth ?? 600) - 232),
            top: Math.max(0, tip.y - 110),
            animationDuration: "0.18s",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="btn-ink flex h-8 w-8 items-center justify-center rounded-[10px]">
              <MapPin size={14} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight text-fg">{activeRegion.name}</p>
              <p className="text-[11px] text-fg-3">Markaz: {activeRegion.capital}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[13px] text-fg-2">
            <span className="font-display text-[20px] font-semibold text-accent">{count(activeRegion.slug)}</span> ta {unitLabel}
            {total > 0 && count(activeRegion.slug) > 0 && <span className="text-fg-4"> · {Math.round((count(activeRegion.slug) / total) * 100)}%</span>}
          </p>
          {!counts && activeStat && activeStat.total > 0 && (
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
          <p className="mt-2 text-[11px] font-semibold text-accent">Bosing → ro'yxat</p>
        </div>
      )}
    </div>
  );
}
