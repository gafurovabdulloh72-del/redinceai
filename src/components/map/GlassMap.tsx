"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { MAP_VIEWBOX, REGION_SHAPES } from "./regions-geo";
import { cn } from "@/lib/utils";

/**
 * Xaritaning vizual qatlami — "shisha plitalar" (UzbekistanMap'ning bosish/yorliq SVG'si ostida).
 * Har bir hudud — alohida, aniq kesilgan plita: oralari ingichka (niqob bilan bir xil kenglikda ichkariga
 * surilgan), rangi — mutaxassislar soniga qarab bir tekis shkala (neytral → coral), ustida bitta umumiy
 * yorug'lik manbai (yaltiroq + yuqori-chap qirra), ostida yumshoq stol soyasi.
 * Har hududda bitta aniq nuqta (son ko'p bo'lsa — kattaroq), eng ko'p hududda sokin "ping".
 * Hover/tanlangan plita nusxasi eng ustida ko'tariladi (qo'shni plitalarga chiqib ketsa ham to'g'ri chiziladi),
 * joyida — soya va coral nur qoladi; qolgan plitalar biroz so'nadi.
 * Ikki SVG qatlam: statik plitalar (niqob/filtrlar) va yengil "yorug'lik" qatlami (nuqtalar, ping,
 * sichqoncha yaltirog'i, bosish to'lqini) — alohida kompozit qatlamda, plitalarni qayta chizdirmaydi.
 */

export type MapView = { k: number; x: number; y: number };
export type MapBox = { x: number; y: number; w: number; h: number };
export type Ripple = { x: number; y: number; t: number };

const GAP = 2.8; // plitalar orasidagi chok (xarita birligida)
const RIM = 1.1; // yuqori-chap yorug' qirra
const LINE = 0.7; // tashqi ingichka kontur
const OUTLINE = 1.7; // faol plitaning coral qirrasi
const REST = { x: 330, y: 150 }; // sichqoncha yo'q paytda yaltiroq turadigan joy
const LEAVE_MS = 280;

/* ---------------- Geometriya (modul darajasida, SSR bilan bir xil — deterministik) ---------------- */
const parseRings = (d: string) =>
  d
    .split("M")
    .map((p) => (p.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number))
    .filter((r) => r.length >= 6);
/** Juft-toq qoidasi (anklav — Toshkent viloyati ichidagi shahar — teshik hisoblanadi) */
function inside(rings: number[][], x: number, y: number) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i];
      const yi = r[i + 1];
      const xj = r[j];
      const yj = r[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
function edgeDist(rings: number[][], x: number, y: number) {
  let best = Infinity;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const ax = r[j];
      const ay = r[j + 1];
      const vx = r[i] - ax;
      const vy = r[i + 1] - ay;
      const l = vx * vx + vy * vy;
      const t = l ? Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / l)) : 0;
      best = Math.min(best, (ax + t * vx - x) ** 2 + (ay + t * vy - y) ** 2);
    }
  }
  return Math.sqrt(best);
}
const r1 = (n: number) => Math.round(n * 10) / 10;

interface Shard {
  slug: string;
  d: string;
  /** Nuqta joyi: markaz hudud ichida va chetdan yetarli uzoqda bo'lsa — markaz, aks holda eng "ichki" nuqta */
  ax: number;
  ay: number;
  gap: number;
  delay: number;
}

const SHARDS: Shard[] = REGION_SHAPES.map((r) => {
  const rings = parseRings(r.d);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      minX = Math.min(minX, ring[i]);
      maxX = Math.max(maxX, ring[i]);
      minY = Math.min(minY, ring[i + 1]);
      maxY = Math.max(maxY, ring[i + 1]);
    }
  }
  const size = Math.min(maxX - minX, maxY - minY);
  let ax = r.cx;
  let ay = r.cy;
  if (!inside(rings, ax, ay) || edgeDist(rings, ax, ay) < Math.min(6, size * 0.2)) {
    let best = -1;
    for (let gy = 1; gy < 24; gy++) {
      for (let gx = 1; gx < 24; gx++) {
        const x = minX + ((maxX - minX) * gx) / 24;
        const y = minY + ((maxY - minY) * gy) / 24;
        if (!inside(rings, x, y)) continue;
        const dd = edgeDist(rings, x, y);
        if (dd > best) {
          best = dd;
          ax = x;
          ay = y;
        }
      }
    }
  }
  return {
    slug: r.slug,
    d: r.d,
    ax: r1(ax),
    ay: r1(ay),
    gap: r1(Math.min(GAP, Math.max(1.6, size * 0.12))),
    delay: r1(0.05 + (r.cx / MAP_VIEWBOX.width) * 0.45),
  };
});

/** Hudud nuqtasi joylari (pill/yorliqlar ham shunga qaraydi) */
export const MAP_ANCHORS: Record<string, { x: number; y: number }> = Object.fromEntries(SHARDS.map((s) => [s.slug, { x: s.ax, y: s.ay }]));

/** Rang shkalasi: 0 — neytral plita; 1+ — coral tomon (Noir'da past qiymatlar pushti-coral — jigarrang emas) */
const fillFor = (n: number, t: number) =>
  n === 0
    ? "var(--map-fill-0)"
    : `color-mix(in oklab, color-mix(in oklab, var(--accent) ${Math.round(t * 100)}%, var(--map-tint-lo)) calc(var(--map-mix-floor) + ${t.toFixed(3)} * var(--map-mix-range)), var(--map-fill-0))`;

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
  /** Sichqoncha joyi (zoom'dan oldingi xarita birligida) — yaltiroq shunga ergashadi */
  pointer: MutableRefObject<{ x: number; y: number } | null>;
  ripple: MutableRefObject<Ripple | null>;
}

export function GlassMap({ vb, view, zoom, dragging, counts, max, hover, selected, hero, motion, pointer, ripple }: Props) {
  const uid = useId().replace(/:/g, "");
  const id = (s: string) => `${uid}-${s}`;
  const ref = (s: string) => `url(#${uid}-${s})`;
  const href = (slug: string) => `#${uid}-p-${slug}`;
  const lightsRef = useRef<SVGSVGElement>(null);
  const sheenRef = useRef<SVGCircleElement>(null);
  const rippleRef = useRef<SVGCircleElement>(null);

  const onSet = [...new Set([selected, hover].filter((s): s is string => Boolean(s)))];
  const active = hover ?? selected;
  /* Faollikdan chiqqan plita qisqa vaqt "tushib" boradi (nusxa), keyin joyidagi asl plita ko'rinadi */
  const [leaving, setLeaving] = useState<string | null>(null);
  const prevOn = useRef<string[]>([]);
  const onKey = onSet.join("|");
  useEffect(() => {
    const gone = prevOn.current.find((s) => !onSet.includes(s));
    prevOn.current = onSet;
    if (!gone || !motion) return;
    setLeaving(gone);
    const t = setTimeout(() => setLeaving((l) => (l === gone ? null : l)), LEAVE_MS);
    return () => clearTimeout(t);
  }, [onKey, motion]); // eslint-disable-line react-hooks/exhaustive-deps
  const leavingSlug = leaving && !onSet.includes(leaving) ? leaving : null;

  const topSlug = SHARDS.reduce<string | null>((best, s) => ((counts[s.slug] ?? 0) > (best ? counts[best] ?? 0 : 0) ? s.slug : best), null);
  const tOf = (n: number) => (n > 0 ? Math.min(1, (n / Math.max(1, max)) ** 0.6) : 0);

  const clip = zoom && view.k > 1;
  /** Zoom'da choklar va qirralar ekranda haddan tashqari qalinlashmasin */
  const zs = zoom ? 1 / view.k ** 0.6 : 1;
  const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  const layer = cn("pointer-events-none absolute inset-0 h-full w-full", clip ? "overflow-hidden rounded-card" : "overflow-visible");
  const zoomProps = {
    className: cn(zoom && "map-zoom-layer"),
    "data-dragging": dragging || undefined,
    style: zoom ? ({ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transformBox: "view-box" } as CSSProperties) : undefined,
  };
  const mask = { maskUnits: "userSpaceOnUse" as const, x: vb.x - 60, y: vb.y - 60, width: vb.w + 120, height: vb.h + 120 };

  /* Yaltiroq sichqonchaga silliq ergashadi; bosish to'lqini kengayib so'nadi. Faqat ko'rinib turganda ishlaydi */
  useEffect(() => {
    const svg = lightsRef.current;
    const sheen = sheenRef.current;
    const rip = rippleRef.current;
    if (!svg || !sheen || !rip) return;
    let raf = 0;
    let visible = true;
    let sx = REST.x;
    let sy = REST.y;
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const p = pointer.current;
      const tx = p ? p.x : REST.x;
      const ty = p ? p.y : REST.y;
      if (Math.abs(tx - sx) > 0.3 || Math.abs(ty - sy) > 0.3) {
        const e = motion ? 0.1 : 1;
        sx += (tx - sx) * e;
        sy += (ty - sy) * e;
        sheen.setAttribute("cx", sx.toFixed(1));
        sheen.setAttribute("cy", sy.toFixed(1));
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
          rip.setAttribute("opacity", ((1 - e) * 0.7).toFixed(3));
        }
      }
      raf = requestAnimationFrame(tick);
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
    start();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", start);
    };
  }, [motion, pointer, ripple]);

  /** Bitta plita: rang, yaltiroq, umumiy yorug'lik, qirra, (faol bo'lsa) coral chegara, tashqi kontur */
  const tile = (s: Shard, outline: boolean) => {
    const n = counts[s.slug] ?? 0;
    const h = href(s.slug);
    return (
      <g mask={ref(`m-${s.slug}`)}>
        <use href={h} style={{ fill: fillFor(n, n > 0 ? Math.min(1, n / Math.max(1, max)) : 0) }} />
        <use href={h} fill={ref("gloss")} />
        <use href={h} fill={ref("light")} />
        <use href={h} fill="none" stroke={ref("rim")} strokeWidth={(s.gap + RIM * 2) * zs} strokeLinejoin="round" />
        {outline && <use href={h} className="tile-outline" fill="none" stroke="var(--accent)" strokeWidth={(s.gap + OUTLINE * 2) * zs} strokeLinejoin="round" />}
        <use href={h} fill="none" stroke="var(--map-seam)" strokeWidth={(s.gap + LINE * 2) * zs} strokeLinejoin="round" />
      </g>
    );
  };

  return (
    <>
      {/* 1) Plitalar qatlami */}
      <svg viewBox={vbStr} className={layer} aria-hidden="true" focusable="false">
        <defs>
          {SHARDS.map((s) => (
            <path key={s.slug} id={id(`p-${s.slug}`)} d={s.d} fillRule="evenodd" />
          ))}
          <linearGradient id={id("gloss")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--map-gloss)" stopOpacity="1" />
            <stop offset="0.5" stopColor="var(--map-gloss)" stopOpacity="0.2" />
            <stop offset="1" stopColor="var(--map-gloss)" stopOpacity="0" />
          </linearGradient>
          {/* Bitta umumiy yorug'lik manbai (yuqori-chap) — plitalar bir butun ob'ektdek o'qiladi */}
          <linearGradient id={id("light")} gradientUnits="userSpaceOnUse" x1="120" y1="20" x2="900" y2="640">
            <stop offset="0" stopColor="var(--map-light-hi)" />
            <stop offset="0.5" stopColor="var(--map-light-hi)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--map-light-lo)" />
          </linearGradient>
          <linearGradient id={id("rim")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--map-rim-1)" />
            <stop offset="0.45" stopColor="var(--map-rim-2)" />
            <stop offset="1" stopColor="var(--map-rim-3)" />
          </linearGradient>
          {/* Har plita uchun niqob: o'z konturining qora chizig'i — bir xil kenglikdagi chok */}
          {SHARDS.map((s) => (
            <mask key={s.slug} id={id(`m-${s.slug}`)} {...mask}>
              <use href={href(s.slug)} fill="#fff" stroke="#000" strokeWidth={s.gap * zs} strokeLinejoin="round" />
            </mask>
          ))}
          <filter id={id("soft")} x="-15%" y="-15%" width="130%" height="145%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id={id("contact")} x="-5%" y="-5%" width="110%" height="115%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          {hero && (
            <radialGradient id={id("aura")} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="var(--map-aura)" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          )}
        </defs>

        {hero && <ellipse cx={MAP_VIEWBOX.width / 2} cy={MAP_VIEWBOX.height / 2 + 20} rx={560} ry={330} fill={ref("aura")} />}

        <g {...zoomProps}>
          {/* Stol soyasi: keng yumshoq + yaqin aniq; faol plita ko'tarilganda soya joyida qoladi */}
          <g className={cn(motion && "map-shadow-in")}>
            <g filter={ref("soft")} transform="translate(0 14)" fill="var(--map-shadow)">
              {SHARDS.map((s) => (
                <use key={s.slug} href={href(s.slug)} />
              ))}
            </g>
            <g filter={ref("contact")} transform="translate(0 2)" fill="var(--map-shadow-contact)">
              {SHARDS.map((s) => (
                <use key={s.slug} href={href(s.slug)} />
              ))}
            </g>
          </g>

          <g className={cn("tiles", active && "has-active", motion && "is-intro")}>
            {SHARDS.map((s) => {
              const hidden = onSet.includes(s.slug) || s.slug === leavingSlug;
              return (
                <g key={s.slug} className="tile" style={{ "--d": `${s.delay}s` } as CSSProperties}>
                  <g className={cn("tile-body", hidden && "is-hidden")}>{tile(s, false)}</g>
                </g>
              );
            })}
          </g>

          {/* Faol plita: joyida — coral nur (shisha orqali stolga tushgan yorug'lik), ustida — ko'tarilgan nusxa */}
          {onSet.map((slug) => (
            <use key={`glow-${slug}`} href={href(slug)} className="tile-underglow" fill="var(--accent)" filter={ref("soft")} transform="translate(0 6)" />
          ))}
          {leavingSlug &&
            SHARDS.filter((s) => s.slug === leavingSlug).map((s) => (
              <g key={`down-${s.slug}`} className="tile-top is-down">
                {tile(s, true)}
              </g>
            ))}
          {SHARDS.filter((s) => onSet.includes(s.slug)).map((s) => (
            <g key={`up-${s.slug}`} className={cn("tile-top", motion ? "is-up" : "is-raised")}>
              {tile(s, true)}
            </g>
          ))}
        </g>
      </svg>

      {/* 2) Yorug'lik qatlami (alohida kompozit qatlam — ping/yaltiroq plitalarni qayta chizdirmaydi) */}
      <svg ref={lightsRef} viewBox={vbStr} className={cn(layer, "will-change-transform")} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={id("halo")}>
            <stop offset="0" stopColor="var(--map-pin-glow)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--map-pin-glow)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("sheen")}>
            <stop offset="0" stopColor="var(--map-sheen)" stopOpacity="1" />
            <stop offset="0.5" stopColor="var(--map-sheen)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--map-sheen)" stopOpacity="0" />
          </radialGradient>
          <mask id={id("inset")} {...mask}>
            {SHARDS.map((s) => (
              <use key={s.slug} href={href(s.slug)} fill="#fff" stroke="#000" strokeWidth={s.gap * zs} strokeLinejoin="round" />
            ))}
          </mask>
        </defs>
        <g {...zoomProps}>
          <g mask={ref("inset")}>
            <circle ref={sheenRef} cx={REST.x} cy={REST.y} r={240} fill={ref("sheen")} />
          </g>
          <g className={cn("pins", active && "has-active")}>
            {SHARDS.map((s) => {
              const n = counts[s.slug] ?? 0;
              if (n === 0) return null;
              const t = tOf(n);
              const core = r1(2.3 + 1.6 * t);
              const on = onSet.includes(s.slug);
              return (
                <g key={s.slug} className={cn("pin", on && "is-on")}>
                  <g className={cn(motion && "pin-in")} transform={`translate(${s.ax} ${s.ay})`}>
                    {motion && s.slug === topSlug && <circle className="pin-ping" r={core + 1} fill="none" stroke="var(--map-pin-glow)" strokeWidth={1.2} />}
                    <circle r={core * 3.4} fill={ref("halo")} />
                    <circle r={core} fill="var(--map-pin)" stroke="var(--map-pin-edge)" strokeWidth={1.1} />
                  </g>
                </g>
              );
            })}
          </g>
          <circle ref={rippleRef} r={0} fill="none" stroke="var(--accent)" strokeWidth={1.6} opacity={0} />
        </g>
      </svg>
    </>
  );
}
