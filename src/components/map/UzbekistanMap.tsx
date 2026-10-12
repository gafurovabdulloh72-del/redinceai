"use client";

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
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
 * - Pulsatsiya qiluvchi markerlar, tooltip (sichqoncha: hover, sensor: bosish)
 * - variant="hero": perspektiva bilan qiyshaytirilgan, sichqonchaga ergashadi
 * - Yorliqlar: oddiy kollziya tekshiruvi (ustma-ust tushsa pastga suriladi), 640px'dan tor xaritada yashirin
 * - A11y: <svg> ichidagi har bir hudud role="button" (svg'ning o'zi role="img" EMAS — ichidagi tugmalar AT uchun ochiq)
 * - Bosish maydoni: kichik hududlar (Toshkent sh., Sirdaryo) ekranda <32px bo'lsa, markazida ko'rinmas
 *   ≥40px disk; hero'dagi son pill'lari va yorliqlar ham o'z hududini tanlaydi (qo'shni hududni emas)
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

/** Yorliqlar ustma-ust tushmasligi uchun: oldingi qutilar bilan kesishsa 16px pastga suriladi */
function layoutLabels(items: { slug: string; x: number; y: number; w: number; h: number }[]) {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const out: Record<string, { x: number; y: number }> = {};
  for (const it of items) {
    let y = it.y;
    let guard = 0;
    const hits = (yy: number) =>
      placed.some((p) => it.x - it.w / 2 < p.x + p.w / 2 && it.x + it.w / 2 > p.x - p.w / 2 && yy - it.h / 2 < p.y + p.h / 2 && yy + it.h / 2 > p.y - p.h / 2);
    while (hits(y) && guard < 6) {
      y += 16;
      guard++;
    }
    placed.push({ x: it.x, y, w: it.w, h: it.h });
    out[it.slug] = { x: it.x, y };
  }
  return out;
}

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
const LABEL_MIN_WIDTH = 640; // shu kenglikdan tor xaritada yorliqlar yashiriladi (px)
const HIT_MIN_PX = 32; // hudud ekranda shundan kichik bo'lsa — qo'shimcha bosish diski
const HIT_DISC_PX = 40; // diskning ekrandagi diametri (px)

/** Har bir hudud konturining kichik tomoni (viewBox birligida) — yo'l nuqtalaridan bir marta hisoblanadi */
const REGION_SIZE: Record<string, number> = Object.fromEntries(
  REGION_SHAPES.map((r) => {
    const nums = r.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]);
      maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]);
      maxY = Math.max(maxY, nums[i + 1]);
    }
    return [r.slug, nums.length ? Math.min(maxX - minX, maxY - minY) : Infinity];
  }),
);

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
  const [width, setWidth] = useState<number>(0);
  const wrap = useRef<HTMLDivElement>(null);
  const touchTip = useRef(false);
  const suppressClick = useRef(false);
  const armedSlug = useRef<string | null>(null);
  const uid = useId().replace(/:/g, "");
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

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

  /* Xarita kengligini kuzatamiz — yorliqlar faqat yetarli kenglikda */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /* Sensorli qurilmada: tooltip ochiq bo'lsa, xaritadan tashqariga bosilganda yopiladi */
  useEffect(() => {
    if (!tip || !touchTip.current) return;
    const onDown = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setHover(null);
        setTip(null);
        touchTip.current = false;
        armedSlug.current = null;
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [tip]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (touchTip.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onWrapMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isHero || !wrap.current || e.pointerType === "touch") return;
    const r = wrap.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: px, y: py });
  };
  const onRegionPointerDown = (e: PointerEvent<SVGElement>, slug: string) => {
    if (e.pointerType !== "touch") return;
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    touchTip.current = true;
    setHover(slug);
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
    /* Sahifaga o'tuvchi rejimda: 1-bosish — tooltip, 2-bosish (shu hudud) — o'tish */
    if (!onSelect && armedSlug.current !== slug) {
      armedSlug.current = slug;
      suppressClick.current = true;
    }
  };
  const onRegionClick = (slug: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    pick(slug);
  };

  const pick = (slug: string) => {
    if (onSelect) onSelect(selected === slug ? null : slug);
    else if (hrefFor) router.push(hrefFor(slug));
    else if (linkTo === "xarita") router.push(`/xarita?region=${slug}`);
    else router.push(`/mutaxassislar?region=${slug}`);
  };

  const vb = `-24 -24 ${MAP_VIEWBOX.width + 48} ${MAP_VIEWBOX.height + 48 + SLAB}`;
  const labelsOn = showLabels && !isHero && !compact && width >= LABEL_MIN_WIDTH;

  /* Ekran piksel / viewBox birligi — kichik hududlar uchun bosish diski o'lchami */
  const pxPerUnit = width > 0 ? width / (MAP_VIEWBOX.width + 48) : 0.6;
  const hitR = HIT_DISC_PX / 2 / pxPerUnit;
  const smallRegions = REGION_SHAPES.filter((r) => REGION_SIZE[r.slug] * pxPerUnit < HIT_MIN_PX);

  /** Pill/yorliq uchun: hover + sensor + bosish (yo'l bilan bir xil oqim) */
  const hitProps = (slug: string) => ({
    pointerEvents: "all" as const,
    className: "cursor-pointer",
    onMouseEnter: () => {
      if (!touchTip.current) setHover(slug);
    },
    onPointerDown: (e: PointerEvent<SVGElement>) => onRegionPointerDown(e, slug),
    onClick: () => onRegionClick(slug),
  });
  /** Disklar ustma-ust tushsa (Farg'ona vodiysi, mobil) — bosilgan nuqtaga markazi eng yaqin disk tanlanadi */
  const discSlugAt = (e: { clientX: number; clientY: number }, fallback: string) => {
    if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") return fallback;
    let best = fallback;
    let bestD = Infinity;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const slug = el instanceof SVGCircleElement ? el.dataset.slug : undefined;
      if (!slug || !wrap.current?.contains(el)) continue;
      const r = el.getBoundingClientRect();
      const d = (r.left + r.width / 2 - e.clientX) ** 2 + (r.top + r.height / 2 - e.clientY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = slug;
      }
    }
    return best;
  };
  const discProps = (slug: string) => ({
    pointerEvents: "all" as const,
    className: "cursor-pointer",
    "data-slug": slug,
    onMouseEnter: (e: MouseEvent<SVGCircleElement>) => {
      if (!touchTip.current) setHover(discSlugAt(e, slug));
    },
    onPointerDown: (e: PointerEvent<SVGCircleElement>) => onRegionPointerDown(e, discSlugAt(e, slug)),
    onClick: (e: MouseEvent<SVGCircleElement>) => onRegionClick(discSlugAt(e, slug)),
  });

  /* Yorliq joylashuvi (kollziya tekshiruvi bilan) */
  const labels = useMemo(() => {
    if (!labelsOn) return null;
    const items = REGION_SHAPES.map((r) => {
      const n = count(r.slug);
      const [ox, oy] = LABEL_OFFSET[r.slug] ?? [0, 0];
      const label = REGION_BY_SLUG[r.slug]?.short ?? r.name;
      const w = label.length * 7.4 + (n > 0 ? String(n).length * 8 + 18 : 14);
      return { slug: r.slug, label, n, w, h: 22, x: r.cx + ox, y: r.cy + oy + (n > 0 ? 18 : 0) };
    });
    const pos = layoutLabels(items);
    return items.map((it) => ({ ...it, ...pos[it.slug] }));
  }, [labelsOn, stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const tipW = 224;
  const tipLeft = tip ? Math.max(0, Math.min(tip.x + 16, (wrap.current?.clientWidth ?? 600) - tipW - 8)) : 0;

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
            if (touchTip.current) return;
            setHover(null);
            setTip(null);
          }}
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title id={titleId}>O'zbekiston hududlari xaritasi</title>
          <desc id={descId}>
            14 ta hudud. Har bir hudud — tugma: bosilganda yoki Enter tugmasida o'sha hududdagi {unitLabel}lar ro'yxati ochiladi. Jami {total} ta.
          </desc>
          <defs>
            <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" style={{ stopOpacity: "var(--map-sheen)" }} />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-sel`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="#ff3d6e" />
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
          {isHero && <ellipse cx={MAP_VIEWBOX.width / 2} cy={MAP_VIEWBOX.height / 2 + 40} rx={560} ry={300} fill={`url(#${uid}-glow)`} aria-hidden="true" />}

          {/* Plita (qalinlik): bir nechta qatlam pastga siljitilgan */}
          <g filter={`url(#${uid}-shadow)`} aria-hidden="true">
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

          {/* Ustki yuzalar — har biri tugma */}
          <g role="group" aria-label="Hududlar">
            {REGION_SHAPES.map((r) => {
              const n = count(r.slug);
              const t = n / max;
              const isSel = selected === r.slug;
              const isHov = hover === r.slug;
              const pct = Math.round(8 + Math.pow(t, 0.7) * 78);
              const fill = isSel ? `url(#${uid}-sel)` : `color-mix(in srgb, var(--accent) ${pct}%, var(--map-fill-0))`;
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
                  onMouseEnter={() => {
                    if (!touchTip.current) setHover(r.slug);
                  }}
                  onPointerDown={(e) => onRegionPointerDown(e, r.slug)}
                  onClick={() => onRegionClick(r.slug)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${r.name}: ${n} ta ${unitLabel}`}
                  aria-pressed={onSelect ? isSel : undefined}
                  onFocus={() => setHover(r.slug)}
                  onBlur={() => {
                    if (!touchTip.current) setHover(null);
                  }}
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
          <g clipPath={`url(#${uid}-clip)`} pointerEvents="none" aria-hidden="true">
            <rect x={-24} y={-24} width={MAP_VIEWBOX.width + 48} height={MAP_VIEWBOX.height + 48} fill={`url(#${uid}-sheen)`} style={{ mixBlendMode: "soft-light" }} />
          </g>

          {/* Markerlar */}
          <g pointerEvents="none" aria-hidden="true">
            {REGION_SHAPES.map((r, i) => {
              const n = count(r.slug);
              if (n === 0) return null;
              const t = n / max;
              const base = (isHero ? 7 : 5) + Math.sqrt(t) * (isHero ? 10 : 7);
              const isSel = selected === r.slug;
              const pillW = String(n).length * 10 + 20;
              return (
                <g key={r.slug} transform={`translate(${r.cx}, ${r.cy})`}>
                  <circle r={base} className="map-pulse" fill="var(--accent)" style={{ animationDelay: `${(i % 5) * 0.45}s` }} />
                  <circle r={base} className="map-pulse" fill="var(--accent)" style={{ animationDelay: `${(i % 5) * 0.45 + 1.2}s` }} />
                  <circle r={base * 0.55} fill={isSel ? "#fff" : "var(--accent)"} stroke="var(--map-base)" strokeWidth={2} />
                  {isHero && topSlugs.includes(r.slug) && (
                    <g transform={`translate(${(LABEL_OFFSET[r.slug]?.[0] ?? 0) + base + 6}, ${(LABEL_OFFSET[r.slug]?.[1] ?? 0) * 0.6})`} {...hitProps(r.slug)}>
                      <rect x={0} y={-14} width={pillW} height={28} rx={14} fill="var(--ink)" />
                      <text x={pillW / 2} y={0} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="var(--ink-fg)" fontFamily="var(--font-display)">
                        {n}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Yorliqlar (panel rejimida, yetarli kenglikda) */}
          {labels && (
            <g pointerEvents="none" aria-hidden="true">
              {labels.map((l) => (
                <g key={l.slug} transform={`translate(${l.x}, ${l.y})`} {...hitProps(l.slug)}>
                  <rect x={-l.w / 2} y={-11} width={l.w} height={22} rx={11} fill="var(--map-label-bg)" stroke="var(--line-2)" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={600} fill="var(--fg)" style={{ letterSpacing: "-0.01em" }}>
                    {l.label}
                    {l.n > 0 && (
                      <tspan fill="var(--accent)" fontWeight={800}>
                        {" "}
                        {l.n}
                      </tspan>
                    )}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Kichik hududlar uchun ko'rinmas bosish disklari (yo'llar o'zi AT uchun tugma bo'lib qoladi) */}
          {smallRegions.length > 0 && (
            <g aria-hidden="true">
              {smallRegions.map((r) => (
                <circle key={r.slug} cx={r.cx} cy={r.cy} r={hitR} fill="transparent" {...discProps(r.slug)} />
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tip && activeRegion && hover && (
        <div
          className="card-floating pointer-events-none absolute z-10 w-56 p-3.5 animate-fade-up"
          role="status"
          style={{ left: tipLeft, top: Math.max(0, tip.y - 110), animationDuration: "0.18s" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="icon-tile icon-tile-sm">
              <MapPin size={14} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight text-fg">{activeRegion.name}</p>
              <p className="text-[11px] text-fg-3">Markaz: {activeRegion.capital}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[13px] text-fg-2">
            <span className="font-display text-[20px] font-semibold text-accent">{count(activeRegion.slug)}</span> ta {unitLabel}
            {total > 0 && count(activeRegion.slug) > 0 && <span className="text-fg-3"> · {Math.round((count(activeRegion.slug) / total) * 100)}%</span>}
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
          <p className="mt-2 text-[11px] font-semibold text-accent">
            {onSelect ? (selected === hover ? "Tanlangan · yana bosing → bekor" : "Bosing → tanlash") : touchTip.current ? "Yana bosing → ro'yxat" : "Bosing → ro'yxat"}
          </p>
        </div>
      )}
    </div>
  );
}
