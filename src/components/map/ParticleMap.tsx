"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { REGION_SHAPES } from "./regions-geo";

/**
 * "Precision" nuqta-matritsa xaritasi — canvas qatlami (UzbekistanMap SVG'si ostida chiziladi).
 * Premium data-xarita uslubi:
 *  - Har bir hudud — tebranishsiz olti burchakli to'rdagi bir xil mayda nuqtalar; rang va yorqinlik —
 *    mutaxassislar zichligi (neytral → coral). Hover'da hudud nuqtalari faqat yorishadi (o'lchami deyarli o'zgarmaydi)
 *  - Har bir yorqin nuqta — bitta haqiqiy ijodkor: yadro + halqa + yumshoq nur, vaqti-vaqti bilan "ping"
 *  - Hero: Toshkentdan faol hududlarga nozik yoylar, ular bo'ylab yorug' impuls; markazda sonar halqalar
 *  - Kursor yonidagi nuqtalar yumshoq yorishadi (geografiya joyidan siljimaydi)
 *  - Kirish: nuqtalar Toshkentdan tashqariga bir martalik radial to'lqin bilan paydo bo'ladi
 *  - Statik nuqtalar offscreen canvas'da keshlanadi — har kadrda faqat ustki qatlamlar chiziladi
 *  - prefers-reduced-motion: faqat statik kadr
 *
 * Koordinatalar — xarita birligida (regions-geo, 1000×662). SVG'dagi viewBox va zoom (k, x, y) bilan bir xil
 * transform qo'llanadi, shuning uchun nuqtalar SVG yo'llari (bosish maydonlari) bilan aniq ustma-ust tushadi.
 */

export type MapView = { k: number; x: number; y: number };
export type MapBox = { x: number; y: number; w: number; h: number };
export type Ripple = { x: number; y: number; t: number };

interface Props {
  vb: MapBox;
  view: MapView;
  counts: Record<string, number>;
  max: number;
  hover: string | null;
  selected: string | null;
  hero: boolean;
  motion: boolean;
  /** Sichqoncha joyi (xarita birligida) yoki null */
  pointer: MutableRefObject<{ x: number; y: number } | null>;
  /** Hudud bosilganda halqa manbai */
  ripple: MutableRefObject<Ripple | null>;
  className?: string;
}

const HUB = "toshkent-shahri";
const SLUGS = REGION_SHAPES.map((r) => r.slug);
const REGION_INDEX: Record<string, number> = Object.fromEntries(SLUGS.map((s, i) => [s, i]));
const TAU = Math.PI * 2;
const INTRO_MS = 1500;
const ARC_PERIOD = 4200;
const PING_PERIOD = 5200;

/** Statik ma'lumot (keshlanadi, nusxalar orasida umumiy) */
interface Field {
  n: number;
  x: Float32Array;
  y: Float32Array;
  phase: Float32Array;
  hubDist: Float32Array;
  region: Uint8Array;
  /** Har bir hudud nuqtalari [start, end) — massivda ketma-ket */
  ranges: [number, number][];
}

const fieldCache = new Map<number, Field>();

/** Deterministik tasodif (har safar bir xil naqsh — SSR/qayta ochishda "sakramaydi") */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hudud konturlari ichidan aniq olti burchakli to'r (tebranishsiz — "muhandislik" ko'rinishi) */
function buildField(step: number): Field {
  const cached = fieldCache.get(step);
  if (cached) return cached;
  const ctx = document.createElement("canvas").getContext("2d");
  const rand = rng(1337);
  const hub = REGION_SHAPES.find((r) => r.slug === HUB) ?? REGION_SHAPES[0];
  const pts: { x: number; y: number; r: number }[] = [];
  const ranges: [number, number][] = [];
  REGION_SHAPES.forEach((shape, ri) => {
    const start = pts.length;
    const path = new Path2D(shape.d);
    const nums = shape.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
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
    // Kichik hududlar (Toshkent sh.) ham ko'rinsin — to'r zichroq
    const area = (maxX - minX) * (maxY - minY);
    const st = area < 2500 ? step * 0.6 : step;
    const rowH = st * 0.866;
    // To'r butun xarita uchun bir xil fazada (hudud chegarasida qatorlar "uzilmasin")
    const y0 = Math.ceil(minY / rowH) * rowH;
    for (let y = y0; y < maxY; y += rowH) {
      const odd = Math.round(y / rowH) % 2 === 1;
      const x0 = Math.ceil(minX / st) * st + (odd ? st / 2 : 0);
      for (let x = x0; x < maxX; x += st) {
        if (ctx?.isPointInPath(path, x, y)) pts.push({ x, y, r: ri });
      }
    }
    if (pts.length === start) pts.push({ x: shape.cx, y: shape.cy, r: ri });
    ranges.push([start, pts.length]);
  });
  const n = pts.length;
  const f: Field = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    phase: new Float32Array(n),
    hubDist: new Float32Array(n),
    region: new Uint8Array(n),
    ranges,
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    f.x[i] = p.x;
    f.y[i] = p.y;
    f.region[i] = p.r;
    f.phase[i] = rand();
    f.hubDist[i] = Math.hypot(p.x - hub.cx, p.y - hub.cy);
  }
  fieldCache.set(step, f);
  return f;
}

/** Hudud ichidan n ta "yulduz" (ijodkor) — nuqtalar orasidan teng qadam bilan, deterministik */
function pickStars(f: Field, counts: Record<string, number>): Uint8Array {
  const star = new Uint8Array(f.n);
  f.ranges.forEach(([a, b], ri) => {
    const n = Math.min(counts[SLUGS[ri]] ?? 0, b - a);
    if (n <= 0) return;
    const rand = rng(ri * 7919 + 17);
    const stride = (b - a) / n;
    for (let j = 0; j < n; j++) star[a + Math.min(b - a - 1, Math.floor(j * stride + rand() * stride * 0.8))] = 1;
  });
  return star;
}

/* ---------------- Ranglar ---------------- */
type RGB = [number, number, number];
type Colors = { accent: RGB; dot: RGB; core: RGB };

function parseColor(v: string, fb: RGB): RGB {
  const s = v.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return fb;
}

function readColors(el: Element): Colors {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name);
  return {
    accent: parseColor(v("--accent"), [255, 90, 54]),
    dot: parseColor(v("--map-dot"), [196, 188, 174]),
    core: parseColor(v("--map-star-core"), [255, 255, 255]),
  };
}

const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const quad = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

type Live = { vb: MapBox; view: MapView; counts: Record<string, number>; max: number; hover: string | null; selected: string | null; hero: boolean; motion: boolean };

export function ParticleMap({ vb, view, counts, max, hover, selected, hero, motion, pointer, ripple, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Har kadrda o'qiladigan eng so'nggi props (effektni qayta ishga tushirmaslik uchun) */
  const live = useRef<Live>({ vb, view, counts, max, hover, selected, hero, motion });
  live.current = { vb, view, counts, max, hover, selected, hero, motion };
  const dirty = useRef(true);
  const countsKey = SLUGS.map((s) => counts[s] ?? 0).join(",");
  const starsRef = useRef<Uint8Array | null>(null);
  const fieldRef = useRef<Field | null>(null);

  // Props o'zgarsa — statik rejimda ham qayta chizish kerak
  useEffect(() => {
    dirty.current = true;
  }, [vb.x, vb.y, vb.w, vb.h, view.k, view.x, view.y, hover, selected, max, motion]);
  useEffect(() => {
    if (fieldRef.current) starsRef.current = pickStars(fieldRef.current, live.current.counts);
    dirty.current = true;
  }, [countsKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Statik nuqtalar keshi (hover/zoom/rang/o'lcham o'zgarganda qayta chiziladi)
    const base = document.createElement("canvas");
    const bctx = base.getContext("2d");
    if (!bctx) return;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let baseKey = "";
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      base.width = canvas.width;
      base.height = canvas.height;
      baseKey = "";
      dirty.current = true;
    };
    resize();
    // Tor ekranda to'r siyrakroq (tezlik va o'qilish uchun)
    const stepFor = (w: number) => (w > 0 && w < 520 ? 11 : 6.4);
    let step = stepFor(cssW);
    let field = buildField(step);
    fieldRef.current = field;
    starsRef.current = pickStars(field, live.current.counts);

    const reduce = !live.current.motion;
    const t0 = performance.now();
    let introDone = reduce;

    let colors = readColors(canvas);
    let colorVer = 0;
    const onColors = () => {
      colors = readColors(canvas);
      colorVer++;
      dirty.current = true;
      kick();
    };
    const mo = new MutationObserver(onColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onColors);

    const ro = new ResizeObserver(() => {
      resize();
      const next = stepFor(cssW);
      if (next !== step) {
        step = next;
        field = buildField(step);
        fieldRef.current = field;
        starsRef.current = pickStars(field, live.current.counts);
      }
      kick();
    });
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) kick();
    });
    io.observe(canvas);
    const onVis = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener("visibilitychange", onVis);

    const hub = REGION_SHAPES.find((r) => r.slug === HUB) ?? REGION_SHAPES[0];

    let raf = 0;
    let running = false;
    const kick = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    /** Xarita birligidan qurilma pikseliga transform (SVG viewBox + zoom bilan bir xil) */
    const applyView = (c: CanvasRenderingContext2D, L: Live) => {
      const s = (cssW / L.vb.w) * dpr;
      c.setTransform(s * L.view.k, 0, 0, s * L.view.k, (L.view.x - L.vb.x) * s, (L.view.y - L.vb.y) * s);
    };
    /** 1 CSS piksel xarita birligida (zoom hisobga olingan) */
    const unitOf = (L: Live) => 1 / (cssW / L.vb.w) / L.view.k;
    /** Zoom'da nuqtalar biroz kattalashadi (lekin to'r siyraklashgani kabi emas) */
    const zoomScale = (L: Live) => Math.min(2, Math.sqrt(L.view.k));

    const idxOf = (slug: string | null) => (slug ? (REGION_INDEX[slug] ?? -1) : -1);

    /** Hudud nuqtalarining rangi: bo'sh — neytral; mutaxassis bor — zichlikka qarab coral; tanlangan — to'liq accent */
    const regionStyle = (ri: number, L: Live, hoverIdx: number, selIdx: number) => {
      const n = L.counts[SLUGS[ri]] ?? 0;
      const c = n > 0 ? Math.pow(n / Math.max(1, L.max), 0.6) : 0;
      const on = ri === hoverIdx || ri === selIdx;
      const dim = hoverIdx >= 0 && !on ? 0.5 : 1;
      if (on) return { color: colors.accent, alpha: 1, on };
      if (n === 0) return { color: colors.dot, alpha: 0.72 * dim, on };
      return { color: mix(colors.dot, colors.accent, 0.42 + 0.58 * c), alpha: (0.62 + 0.38 * c) * dim, on };
    };

    /**
     * Nuqtalar qatlami. revealT berilsa — kirish animatsiyasi (Toshkentdan masofaga qarab paydo bo'lish,
     * 5 bosqichga guruhlangan: har bosqich bitta fill — minglab alohida chizish yo'q).
     */
    const drawDots = (c: CanvasRenderingContext2D, L: Live, revealT: number | null) => {
      const f = field;
      const unit = unitOf(L);
      const baseR = 1.05 * zoomScale(L) * unit;
      const hoverIdx = idxOf(L.hover);
      const selIdx = idxOf(L.selected);
      for (let ri = 0; ri < f.ranges.length; ri++) {
        const [a, b] = f.ranges[ri];
        const st = regionStyle(ri, L, hoverIdx, selIdx);
        const r = st.on ? baseR * 1.15 : baseR;
        if (revealT === null) {
          c.fillStyle = rgba(st.color, st.alpha);
          c.beginPath();
          for (let i = a; i < b; i++) {
            c.moveTo(f.x[i] + r, f.y[i]);
            c.arc(f.x[i], f.y[i], r, 0, TAU);
          }
          c.fill();
          continue;
        }
        const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        let any = false;
        for (let i = a; i < b; i++) {
          const p = (revealT - (60 + f.hubDist[i] * 0.95)) / 380;
          if (p <= 0) continue;
          const bk = p >= 1 ? 4 : Math.min(4, Math.floor(p * 5));
          const rr = r * (0.45 + 0.55 * ((bk + 1) / 5));
          buckets[bk].moveTo(f.x[i] + rr, f.y[i]);
          buckets[bk].arc(f.x[i], f.y[i], rr, 0, TAU);
          any = true;
        }
        if (!any) continue;
        for (let bk = 0; bk < 5; bk++) {
          c.fillStyle = rgba(st.color, st.alpha * ((bk + 1) / 5));
          c.fill(buckets[bk]);
        }
      }
    };

    const renderBase = (L: Live) => {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, base.width, base.height);
      applyView(bctx, L);
      drawDots(bctx, L, null);
    };

    /** Kursor yorug'ligi: yaqin nuqtalar neytral tomonga yorishadi (3 bosqich — 3 ta fill) */
    const drawSpotlight = (L: Live, ptr: { x: number; y: number }) => {
      const f = field;
      const unit = unitOf(L);
      const R = 70 * unit;
      const R2 = R * R;
      const r = 1.2 * zoomScale(L) * unit;
      const bands = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < f.n; i++) {
        const dx = f.x[i] - ptr.x;
        const dy = f.y[i] - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        const w = 1 - Math.sqrt(d2) / R;
        const band = w > 0.66 ? 2 : w > 0.33 ? 1 : 0;
        bands[band].moveTo(f.x[i] + r, f.y[i]);
        bands[band].arc(f.x[i], f.y[i], r, 0, TAU);
      }
      const tone = mix(colors.dot, colors.core, 0.7);
      const alphas = [0.16, 0.3, 0.48];
      for (let bd = 0; bd < 3; bd++) {
        ctx.fillStyle = rgba(tone, alphas[bd]);
        ctx.fill(bands[bd]);
      }
    };

    /** Hero yoylari: Toshkentdan mutaxassisi bor hududlarga (eng ko'p 8 ta) */
    const arcTargets = (L: Live) =>
      REGION_SHAPES.filter((r) => r.slug !== HUB && (L.counts[r.slug] ?? 0) > 0)
        .sort((a, b) => (L.counts[b.slug] ?? 0) - (L.counts[a.slug] ?? 0))
        .slice(0, 8)
        .map((r) => {
          const dx = r.cx - hub.cx;
          const dy = r.cy - hub.cy;
          const len = Math.hypot(dx, dy) || 1;
          let px = -dy / len;
          let py = dx / len;
          if (py > 0) {
            px = -px;
            py = -py;
          }
          const lift = Math.min(120, len * 0.3);
          return { ri: REGION_INDEX[r.slug] ?? 0, bx: r.cx, by: r.cy, cx: (hub.cx + r.cx) / 2 + px * lift, cy: (hub.cy + r.cy) / 2 + py * lift };
        });

    const drawArcs = (L: Live, t: number, animate: boolean) => {
      const unit = unitOf(L);
      const hoverIdx = idxOf(L.hover);
      const targets = arcTargets(L);
      ctx.lineCap = "round";
      targets.forEach((tg, ai) => {
        const isOn = hoverIdx >= 0 && tg.ri === hoverIdx;
        const dimmed = hoverIdx >= 0 && !isOn;
        // Doimiy nozik yoy
        ctx.strokeStyle = rgba(colors.accent, isOn ? 0.6 : dimmed ? 0.07 : 0.2);
        ctx.lineWidth = (isOn ? 1.4 : 1) * unit;
        ctx.beginPath();
        ctx.moveTo(hub.cx, hub.cy);
        ctx.quadraticCurveTo(tg.cx, tg.cy, tg.bx, tg.by);
        ctx.stroke();
        if (!animate) return;
        // Yoy bo'ylab yorug' impuls (har yoy o'z fazasida)
        const p = ((t + ai * 610) % ARC_PERIOD) / ARC_PERIOD;
        const travel = 0.55;
        const k = dimmed ? 0.25 : 1;
        if (p < travel) {
          const e = easeInOut(p / travel);
          const TAIL = 0.2;
          const SEG = 10;
          for (let j = 0; j < SEG; j++) {
            const qa = Math.max(0, e - TAIL * (1 - j / SEG));
            const qb = e - TAIL * (1 - (j + 1) / SEG);
            if (qb <= 0) continue;
            ctx.strokeStyle = rgba(colors.accent, ((j + 1) / SEG) * 0.95 * k);
            ctx.lineWidth = (0.8 + 1.4 * ((j + 1) / SEG)) * unit;
            ctx.beginPath();
            ctx.moveTo(quad(hub.cx, tg.cx, tg.bx, qa), quad(hub.cy, tg.cy, tg.by, qa));
            ctx.lineTo(quad(hub.cx, tg.cx, tg.bx, qb), quad(hub.cy, tg.cy, tg.by, qb));
            ctx.stroke();
          }
          ctx.shadowColor = rgba(colors.accent, 0.9 * k);
          ctx.shadowBlur = 8 * dpr;
          ctx.fillStyle = rgba(colors.core, k);
          ctx.beginPath();
          ctx.arc(quad(hub.cx, tg.cx, tg.bx, e), quad(hub.cy, tg.cy, tg.by, e), 1.7 * unit, 0, TAU);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (p < travel + 0.16) {
          // Yetib borganda — nozik halqa
          const rp = (p - travel) / 0.16;
          ctx.strokeStyle = rgba(colors.accent, (1 - rp) * 0.7 * k);
          ctx.lineWidth = 1.1 * unit;
          ctx.beginPath();
          ctx.arc(tg.bx, tg.by, (2 + rp * 12) * unit, 0, TAU);
          ctx.stroke();
        }
      });
    };

    /** Hero markazi (Toshkent): sonar halqalar + yadro */
    const drawHub = (L: Live, t: number, animate: boolean) => {
      const unit = unitOf(L);
      if (animate) {
        for (let j = 0; j < 2; j++) {
          const p = (t / 2800 + j * 0.5) % 1;
          ctx.strokeStyle = rgba(colors.accent, (1 - p) * 0.5);
          ctx.lineWidth = 1 * unit;
          ctx.beginPath();
          ctx.arc(hub.cx, hub.cy, (3 + p * 18) * unit, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.fillStyle = rgba(colors.accent, 0.18);
      ctx.beginPath();
      ctx.arc(hub.cx, hub.cy, 6 * unit, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(colors.accent, 1);
      ctx.beginPath();
      ctx.arc(hub.cx, hub.cy, 2.8 * unit, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(colors.core, 1);
      ctx.beginPath();
      ctx.arc(hub.cx, hub.cy, 1.1 * unit, 0, TAU);
      ctx.fill();
    };

    /** Ijodkorlar: nur + halqa + yadro (to'plab chiziladi), faollari vaqti-vaqti bilan "ping" */
    const drawStars = (L: Live, t: number, animate: boolean) => {
      const stars = starsRef.current;
      if (!stars) return;
      const f = field;
      const unit = unitOf(L);
      const zs = zoomScale(L);
      const coreR = 1.5 * zs * unit;
      const ringR = 3.1 * zs * unit;
      const hoverIdx = idxOf(L.hover);
      const selIdx = idxOf(L.selected);
      const halo = new Path2D();
      const ring = new Path2D();
      const core = new Path2D();
      const dimP = new Path2D();
      const pings: { x: number; y: number; p: number }[] = [];
      for (let i = 0; i < f.n; i++) {
        if (!stars[i]) continue;
        const reg = f.region[i];
        const on = reg === hoverIdx || reg === selIdx;
        const x = f.x[i];
        const y = f.y[i];
        if (hoverIdx >= 0 && !on) {
          dimP.moveTo(x + coreR, y);
          dimP.arc(x, y, coreR, 0, TAU);
          continue;
        }
        halo.moveTo(x + ringR * 1.9, y);
        halo.arc(x, y, ringR * 1.9, 0, TAU);
        ring.moveTo(x + ringR, y);
        ring.arc(x, y, ringR, 0, TAU);
        core.moveTo(x + coreR, y);
        core.arc(x, y, coreR, 0, TAU);
        if (animate) {
          const p = (t / PING_PERIOD + f.phase[i]) % 1;
          if (p < 0.24) pings.push({ x, y, p: p / 0.24 });
        }
      }
      ctx.fillStyle = rgba(colors.accent, 0.4);
      ctx.fill(dimP);
      ctx.fillStyle = rgba(colors.accent, 0.13);
      ctx.fill(halo);
      ctx.strokeStyle = rgba(colors.accent, 0.95);
      ctx.lineWidth = 1 * unit;
      ctx.stroke(ring);
      ctx.fillStyle = rgba(colors.core, 1);
      ctx.fill(core);
      for (const pg of pings) {
        ctx.strokeStyle = rgba(colors.accent, (1 - pg.p) * 0.5);
        ctx.lineWidth = 1 * unit;
        ctx.beginPath();
        ctx.arc(pg.x, pg.y, ringR + pg.p * 10 * unit, 0, TAU);
        ctx.stroke();
      }
    };

    function frame(now: number) {
      const L = live.current;
      const animate = L.motion && !reduce;
      if (!visible || document.hidden || cssW === 0) {
        running = false;
        return;
      }
      const t = now - t0;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      if (!introDone && t < INTRO_MS) {
        applyView(ctx!, L);
        drawDots(ctx!, L, t);
      } else {
        introDone = true;
        const key = [cssW, cssH, dpr, step, L.vb.x, L.vb.y, L.vb.w, L.view.k, L.view.x, L.view.y, L.hover, L.selected, L.max, colorVer, SLUGS.map((s) => L.counts[s] ?? 0).join(".")].join("|");
        if (key !== baseKey) {
          renderBase(L);
          baseKey = key;
        }
        ctx!.drawImage(base, 0, 0);
        applyView(ctx!, L);
        const ptr = pointer.current;
        if (animate && ptr) drawSpotlight(L, ptr);
      }

      const settled = introDone;
      if (L.hero && settled) {
        drawArcs(L, t, animate);
        drawHub(L, t, animate);
      }
      if (settled) drawStars(L, t, animate);

      // Hudud bosilganda — bitta nozik kengayuvchi halqa
      const rp = ripple.current;
      if (rp) {
        const age = now - rp.t;
        if (age < 1200 && animate) {
          ctx!.strokeStyle = rgba(colors.accent, (1 - age / 1200) * 0.55);
          ctx!.lineWidth = 1.4 * unitOf(L);
          ctx!.beginPath();
          ctx!.arc(rp.x, rp.y, age * 0.5, 0, TAU);
          ctx!.stroke();
        } else if (age >= 1200) {
          ripple.current = null;
        }
      }

      dirty.current = false;
      if (animate || !introDone) raf = requestAnimationFrame(frame);
      else running = false;
    }

    kick();
    // Statik rejimda props o'zgarganda qayta chizish uchun — yengil tekshiruv
    const poll = window.setInterval(() => {
      if (dirty.current) kick();
    }, 120);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(poll);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onColors);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [motion]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
