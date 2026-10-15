"use client";

import { useEffect, useId, useRef, type CSSProperties, type MutableRefObject } from "react";
import { MAP_VIEWBOX, REGION_SHAPES } from "./regions-geo";
import { MAP_ANCHORS, MESH_EDGES, MESH_NODES } from "./map-mesh";
import { cn } from "@/lib/utils";

/**
 * Xaritaning vizual qatlami — "neon tarmoq":
 * - orqada sekin aylanuvchi globus to'ri (faqat hero)
 * - O'zbekiston: to'q plita, tashqi konturi neon chiziq bo'lib chizilib chiqadi (tunda — nur sochadi)
 * - ichida low-poly tarmoq: chegara va ichki tugunlar, Delaunay qirralari (map-mesh.ts — oldindan hisoblangan)
 * - hudud rangi mutaxassislar soniga qarab coral tus oladi, pin ostida "shahar chirog'i"
 * - hero: eng ko'p hududdan boshqalariga oqib turuvchi yoylar; ba'zi tugunlar miltillaydi
 * Pinlar (bosiladigan) UzbekistanMap'ning yuqori SVG'sida. Uch qatlam: globus (orqa), plita (statik
 * filtrlar) va yorug'lik (miltillash/yoylar) — har biri alohida kompozit qatlam, bir-birini qayta chizdirmaydi.
 */

export type MapView = { k: number; x: number; y: number };
export type MapBox = { x: number; y: number; w: number; h: number };
export type Ripple = { x: number; y: number; t: number };
export { MAP_ANCHORS };

const GLOBE = { cx: MAP_VIEWBOX.width / 2, cy: MAP_VIEWBOX.height / 2 + 10, r: 360 };
const MERIDIANS = 9; // har 20° — 180° qamrab oladi (λ va λ+180° ellipsi bir xil)
const PARALLELS = [-60, -30, 0, 30, 60];
/** Miltillovchi tugunlar: deterministik tanlov (har 4-tugun) */
const TWINKLE = MESH_NODES.filter((n, i) => n[2] !== 2 && i % 4 === 1).map(([x, y], i) => ({ x, y, dur: 2.6 + ((i * 37) % 23) / 10, delay: -((i * 53) % 40) / 10 }));

interface Props {
  vb: MapBox;
  view: MapView;
  /** Zoom yoqilgan (panel) — transform silliq o'tadi, k>1 da qatlam kesiladi */
  zoom: boolean;
  dragging: boolean;
  counts: Record<string, number>;
  max: number;
  hover: string | null;
  selected: string | null;
  hero: boolean;
  motion: boolean;
  ripple: MutableRefObject<Ripple | null>;
}

export function NeonMap({ vb, view, zoom, dragging, counts, max, hover, selected, hero, motion, ripple }: Props) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `${uid}-${s}`;
  const ref = (s: string) => `url(#${uid}-${s})`;
  const href = (slug: string) => `#${uid}-p-${slug}`;
  const globeRef = useRef<SVGGElement>(null);
  const lightsRef = useRef<SVGSVGElement>(null);
  const rippleRef = useRef<SVGCircleElement>(null);

  const onSet = new Set([hover, selected].filter(Boolean) as string[]);
  const tOf = (n: number) => (n > 0 ? Math.min(1, (n / Math.max(1, max)) ** 0.6) : 0);
  const ranked = REGION_SHAPES.map((r) => r.slug)
    .filter((s) => (counts[s] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  const hub = ranked[0];
  /* Hero yoylari: eng ko'p hududdan keyingi 6 tasiga */
  const arcs = hero && hub
    ? ranked.slice(1, 7).map((slug, i) => {
        const a = MAP_ANCHORS[hub];
        const b = MAP_ANCHORS[slug];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const cx = (a.x + b.x) / 2;
        const cy = Math.min(a.y, b.y) - d * 0.32;
        return { slug, d: `M${a.x} ${a.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`, delay: i * 0.55 };
      })
    : [];

  const clip = zoom && view.k > 1;
  const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  const layer = cn("pointer-events-none absolute inset-0 h-full w-full", clip ? "overflow-hidden rounded-card" : "overflow-visible");
  const zoomProps = {
    className: cn(zoom && "map-zoom-layer"),
    "data-dragging": dragging || undefined,
    style: zoom ? ({ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transformBox: "view-box" } as CSSProperties) : undefined,
  };
  /** Zoom'da chiziqlar ekranda haddan tashqari qalinlashmasin */
  const zs = zoom ? 1 / view.k ** 0.7 : 1;

  /* Globus sekin aylanadi; bosish to'lqini kengayib so'nadi. Faqat ko'rinib turganda ishlaydi */
  useEffect(() => {
    const svg = lightsRef.current;
    const rip = rippleRef.current;
    if (!svg || !rip) return;
    const meridians = globeRef.current ? [...globeRef.current.querySelectorAll<SVGEllipseElement>("ellipse[data-m]")] : [];
    let raf = 0;
    let visible = true;
    let last = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (motion && meridians.length && now - last > 33) {
        last = now;
        const rot = ((now - t0) / 1000) * 0.05; // ~3°/s
        meridians.forEach((m, i) => m.setAttribute("rx", (GLOBE.r * Math.abs(Math.sin(rot + (i * Math.PI) / MERIDIANS))).toFixed(1)));
      }
      const rp = ripple.current;
      if (rp) {
        const e = (now - rp.t) / 900;
        if (e >= 1 || e < 0 || !motion) {
          ripple.current = null;
          rip.setAttribute("opacity", "0");
        } else {
          rip.setAttribute("cx", String(rp.x));
          rip.setAttribute("cy", String(rp.y));
          rip.setAttribute("r", (6 + (1 - (1 - e) ** 3) * 110).toFixed(1));
          rip.setAttribute("opacity", ((1 - e) * 0.8).toFixed(3));
        }
      }
      // Hero'da globus aylanadi; panelda tsikl faqat to'lqin paytida ishlaydi (keyin to'xtaydi)
      if ((motion && meridians.length) || ripple.current) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      start();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", start);
    svg.addEventListener("map-ripple", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
      svg.removeEventListener("map-ripple", start);
    };
  }, [motion, ripple]);

  const allPaths = (props: Record<string, unknown>) => REGION_SHAPES.map((r) => <use key={r.slug} href={href(r.slug)} {...props} />);

  return (
    <>
      {/* 1) Globus to'ri (orqa fon, faqat hero) */}
      {hero && (
        <svg viewBox={vbStr} className={cn(layer, "will-change-transform")} aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id={id("gfade")} cx="50%" cy="46%" r="50%">
              <stop offset="0.55" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id={id("gmask")} maskUnits="userSpaceOnUse" x={GLOBE.cx - GLOBE.r - 4} y={GLOBE.cy - GLOBE.r - 4} width={GLOBE.r * 2 + 8} height={GLOBE.r * 2 + 8}>
              <circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r + 2} fill={ref("gfade")} />
            </mask>
            <radialGradient id={id("aura")} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="var(--map-aura)" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx={GLOBE.cx} cy={GLOBE.cy} rx={560} ry={340} fill={ref("aura")} />
          <g ref={globeRef} className={cn(motion && "neon-globe-in")} mask={ref("gmask")} fill="none" stroke="var(--map-globe)" strokeWidth={1}>
            <circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r} />
            {Array.from({ length: MERIDIANS }, (_, i) => (
              <ellipse key={i} data-m="" cx={GLOBE.cx} cy={GLOBE.cy} rx={(GLOBE.r * Math.abs(Math.sin((i * Math.PI) / MERIDIANS))).toFixed(1)} ry={GLOBE.r} />
            ))}
            {PARALLELS.map((lat) => {
              const rad = (lat * Math.PI) / 180;
              const w = GLOBE.r * Math.cos(rad);
              return <ellipse key={lat} cx={GLOBE.cx} cy={(GLOBE.cy - GLOBE.r * Math.sin(rad)).toFixed(1)} rx={w.toFixed(1)} ry={(w * 0.14).toFixed(1)} />;
            })}
          </g>
        </svg>
      )}

      {/* 2) Plita: kontur, to'r, hudud ranglari */}
      <svg viewBox={vbStr} className={layer} aria-hidden="true" focusable="false">
        <defs>
          {REGION_SHAPES.map((r) => (
            // pathLength — kontur "chizilib chiqish" animatsiyasi uchun (use klonlariga ham o'tadi; boshqa joyda dasharray yo'q)
            <path key={r.slug} id={id(`p-${r.slug}`)} d={r.d} fillRule="evenodd" pathLength={1} />
          ))}
          <linearGradient id={id("land")} gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="880" y2="662">
            <stop offset="0" stopColor="var(--map-land-1)" />
            <stop offset="1" stopColor="var(--map-land-2)" />
          </linearGradient>
          <radialGradient id={id("city")}>
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <filter id={id("glow")} x="-10%" y="-10%" width="120%" height="125%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id={id("shadow")} x="-10%" y="-10%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        <g {...zoomProps}>
          {/* Soya (kunduz) va tashqi nur (tun) — ichki yarmi keyin plita bilan yopiladi, faqat tashqi kontur qoladi */}
          <g className={cn(motion && "neon-land-in")}>
            <g filter={ref("shadow")} transform="translate(0 18)" fill="var(--map-shadow)">
              {allPaths({})}
            </g>
            <g filter={ref("glow")} fill="none" stroke="var(--map-outline-glow)" strokeWidth={16 * zs} strokeLinejoin="round">
              {allPaths({})}
            </g>
          </g>
          <g fill="none" stroke="var(--map-outline)" strokeWidth={4 * zs} strokeLinejoin="round">
            {REGION_SHAPES.map((r, i) => (
              <use
                key={r.slug}
                href={href(r.slug)}
                className={cn(motion && "map-draw")}
                style={motion ? { animationDelay: `${0.05 + i * 0.05}s`, animationDuration: "1.5s" } : undefined}
              />
            ))}
          </g>

          <g className={cn(motion && "neon-land-in")}>
            <g fill={ref("land")}>{allPaths({})}</g>
            {/* Hudud rangi: mutaxassislar soniga qarab coral tus */}
            {REGION_SHAPES.map((r) => {
              const n = counts[r.slug] ?? 0;
              const on = onSet.has(r.slug);
              const a = (n > 0 ? 0.08 + 0.44 * tOf(n) : 0) + (on ? 0.18 : 0);
              return a > 0 ? (
                <use key={r.slug} href={href(r.slug)} className="neon-tint" fill="var(--accent)" style={{ fillOpacity: `calc(var(--map-tint-k, 1) * ${a.toFixed(3)})` }} />
              ) : null;
            })}
          </g>

          {/* Low-poly tarmoq: qirralar va tugunlar */}
          <g className={cn(motion && "neon-mesh-in")}>
            {REGION_SHAPES.map((r) =>
              MESH_EDGES[r.slug] ? (
                <path key={r.slug} d={MESH_EDGES[r.slug]} className={cn("neon-mesh", onSet.has(r.slug) && "is-on")} fill="none" strokeWidth={0.9 * zs} strokeLinecap="round" />
              ) : null,
            )}
            <g fill="none" stroke="var(--map-border)" strokeWidth={1.1 * zs} strokeLinejoin="round">
              {allPaths({})}
            </g>
            <g fill="var(--map-node)">
              {MESH_NODES.map(([x, y, kind], i) => (kind === 2 ? null : <circle key={i} cx={x} cy={y} r={(kind === 1 ? 1.9 : 1.5) * zs} />))}
            </g>
          </g>

          {/* Faol hudud: aniq coral kontur */}
          {[...onSet].map((slug) => (
            <use key={`on-${slug}`} href={href(slug)} className="neon-active" fill="none" stroke="var(--accent)" strokeWidth={2.2 * zs} strokeLinejoin="round" />
          ))}

          {/* Shahar chiroqlari — pin uchi ostida */}
          <g className={cn(motion && "neon-mesh-in")}>
            {ranked.map((slug) => {
              const a = MAP_ANCHORS[slug];
              const t = tOf(counts[slug] ?? 0);
              return a ? <circle key={slug} cx={a.x} cy={a.y} r={(18 + 22 * t) * zs} fill={ref("city")} /> : null;
            })}
          </g>
        </g>
      </svg>

      {/* 3) Yorug'lik: miltillovchi tugunlar, yoylar, bosish to'lqini */}
      <svg ref={lightsRef} viewBox={vbStr} className={cn(layer, "will-change-transform")} aria-hidden="true" focusable="false" data-map-lights="">
        <defs>
          <radialGradient id={id("halo")}>
            <stop offset="0" stopColor="var(--map-twinkle)" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g {...zoomProps}>
          {motion && (
            <g className="neon-lights-in">
              {TWINKLE.map((n, i) => (
                <circle
                  key={i}
                  className="neon-twinkle"
                  cx={n.x}
                  cy={n.y}
                  r={6 * zs}
                  fill={ref("halo")}
                  style={{ "--tw": `${n.dur}s`, "--td": `${n.delay}s` } as CSSProperties}
                />
              ))}
            </g>
          )}
          {arcs.length > 0 && (
            <g className={cn(motion && "neon-lights-in")} fill="none" strokeLinecap="round">
              {arcs.map((a) => (
                <g key={a.slug}>
                  <path d={a.d} stroke="var(--map-arc)" strokeOpacity={0.32} strokeWidth={1.1} strokeDasharray="2 5" />
                  {motion && <path d={a.d} pathLength={1} className="map-arc-flow" stroke="var(--map-arc)" strokeWidth={1.8} style={{ animationDelay: `${a.delay}s` }} />}
                </g>
              ))}
            </g>
          )}
          <circle ref={rippleRef} r={0} fill="none" stroke="var(--accent)" strokeWidth={1.6} opacity={0} />
        </g>
      </svg>
    </>
  );
}
