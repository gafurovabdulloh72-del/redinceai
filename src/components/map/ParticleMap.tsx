"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { REGION_SHAPES } from "./regions-geo";

/**
 * "Tirik zarrachalar" xaritasi — canvas qatlami (UzbekistanMap'ning SVG'si ostida chiziladi).
 *
 * - Har bir hudud minglab mayda nuqtadan iborat; nuqtalar zichligi/yorqinligi — mutaxassislar soniga qarab
 * - Kirish: barcha nuqtalar Toshkentdan "portlab" chiqib, masofaga qarab navbat bilan o'z joyiga uchib boradi
 * - Sichqoncha yaqinlashsa nuqtalar undan qochadi (magnit linza), keyin prujina bilan joyiga qaytadi
 * - Har bir yorqin yulduz — bitta haqiqiy ijodkor (hududdagi soncha), miltillab turadi
 * - Toshkentdan viloyatlarga kometalar uchadi (hero), yetib borganda halqa paydo bo'ladi
 * - Davriy to'lqin markazdan butun xarita bo'ylab yuguradi; hudud bosilganda shu nuqtadan zarb to'lqini tarqaladi
 * - prefers-reduced-motion: faqat statik chizish (fizika, kometalar, to'lqin yo'q)
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
  /** Hudud bosilganda zarb to'lqini manbai */
  ripple: MutableRefObject<Ripple | null>;
  className?: string;
}

const HUB = "toshkent-shahri";
const SLUGS = REGION_SHAPES.map((r) => r.slug);
const REGION_INDEX: Record<string, number> = Object.fromEntries(
  SLUGS.map((s, i) => [s, i]),
);

/** Statik ma'lumot (keshlanadi, nusxalar orasida umumiy) */
interface Field {
  n: number;
  hx: Float32Array;
  hy: Float32Array;
  phase: Float32Array;
  delay: Float32Array;
  hubDist: Float32Array;
  region: Uint8Array;
  /** Har bir hudud nuqtalari [start, end) — massivda ketma-ket joylashgan */
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

/** Hudud konturlari ichidan to'r bo'yicha (biroz siljitilgan) nuqtalar olinadi */
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
    const st = area < 2500 ? step * 0.55 : step;
    for (let y = minY + st / 2; y < maxY; y += st * 0.87) {
      const odd = Math.round((y - minY) / (st * 0.87)) % 2 === 1;
      for (let x = minX + (odd ? st / 2 : 0); x < maxX; x += st) {
        const jx = x + (rand() - 0.5) * st * 0.35;
        const jy = y + (rand() - 0.5) * st * 0.35;
        if (ctx?.isPointInPath(path, jx, jy)) pts.push({ x: jx, y: jy, r: ri });
      }
    }
    if (pts.length === start) pts.push({ x: shape.cx, y: shape.cy, r: ri });
    ranges.push([start, pts.length]);
  });
  const n = pts.length;
  const f: Field = {
    n,
    hx: new Float32Array(n),
    hy: new Float32Array(n),
    phase: new Float32Array(n),
    delay: new Float32Array(n),
    hubDist: new Float32Array(n),
    region: new Uint8Array(n),
    ranges,
  };
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    f.hx[i] = p.x;
    f.hy[i] = p.y;
    f.region[i] = p.r;
    f.phase[i] = rand() * Math.PI * 2;
    const d = Math.hypot(p.x - hub.cx, p.y - hub.cy);
    f.hubDist[i] = d;
    // Toshkentdan tarqalish: yaqinlar avval, uzoqlar keyin (+ ozgina tasodif — "to'lqin" jonli ko'rinsin)
    f.delay[i] = 120 + d * 1.15 + rand() * 260;
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
    for (let j = 0; j < n; j++)
      star[
        a + Math.min(b - a - 1, Math.floor(j * stride + rand() * stride * 0.8))
      ] = 1;
  });
  return star;
}

type Colors = { accent: string; dot: string; hot: string; core: string };
function readColors(el: Element): Colors {
  const cs = getComputedStyle(el);
  const v = (name: string, fb: string) =>
    cs.getPropertyValue(name).trim() || fb;
  return {
    accent: v("--accent", "#ff5a36"),
    dot: v("--map-dot", "#c4bcae"),
    hot: v("--map-dot-hot", "#ffe1d8"),
    core: v("--map-star-core", "#ffffff"),
  };
}

interface Comet {
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  bx: number;
  by: number;
  t0: number;
  dur: number;
  target: number;
}
interface Burst {
  x: number;
  y: number;
  t0: number;
}

const quad = (a: number, c: number, b: number, t: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

export function ParticleMap({
  vb,
  view,
  counts,
  max,
  hover,
  selected,
  hero,
  motion,
  pointer,
  ripple,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Har kadrda o'qiladigan eng so'nggi props (effektni qayta ishga tushirmaslik uchun) */
  const live = useRef({ vb, view, counts, max, hover, selected, hero, motion });
  live.current = { vb, view, counts, max, hover, selected, hero, motion };
  const dirty = useRef(true);
  const countsKey = SLUGS.map((s) => counts[s] ?? 0).join(",");
  const starsRef = useRef<Uint8Array | null>(null);
  const fieldRef = useRef<Field | null>(null);

  // Props o'zgarsa — statik rejimda ham qayta chizish kerak
  useEffect(() => {
    dirty.current = true;
  }, [
    vb.x,
    vb.y,
    vb.w,
    vb.h,
    view.k,
    view.x,
    view.y,
    hover,
    selected,
    max,
    motion,
  ]);
  useEffect(() => {
    if (fieldRef.current)
      starsRef.current = pickStars(fieldRef.current, live.current.counts);
    dirty.current = true;
  }, [countsKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      dirty.current = true;
    };
    resize();
    // Tor ekranda nuqtalar siyrakroq (tezlik uchun)
    const base = buildField(cssW > 0 && cssW < 520 ? 14 : 7.5);
    fieldRef.current = base;
    // Harakatlanuvchi holat — har bir xarita nusxasiga alohida (bosh sahifada ikkita xarita bor)
    const field = {
      ...base,
      x: new Float32Array(base.n),
      y: new Float32Array(base.n),
      vx: new Float32Array(base.n),
      vy: new Float32Array(base.n),
    };
    starsRef.current = pickStars(field, live.current.counts);

    const reduce = !live.current.motion;
    const t0 = performance.now();
    if (reduce) {
      field.x.set(field.hx);
      field.y.set(field.hy);
    } else {
      const hub = REGION_SHAPES.find((r) => r.slug === HUB) ?? REGION_SHAPES[0];
      const rand = rng(99);
      for (let i = 0; i < field.n; i++) {
        field.x[i] = hub.cx + (rand() - 0.5) * 10;
        field.y[i] = hub.cy + (rand() - 0.5) * 10;
        field.vx[i] = 0;
        field.vy[i] = 0;
      }
    }

    let colors = readColors(canvas);
    const mo = new MutationObserver(() => {
      colors = readColors(canvas);
      dirty.current = true;
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      colors = readColors(canvas);
      dirty.current = true;
    };
    mq.addEventListener("change", onScheme);

    const ro = new ResizeObserver(resize);
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

    const comets: Comet[] = [];
    const bursts: Burst[] = [];
    let nextComet = t0 + 1900;
    const hubShape =
      REGION_SHAPES.find((r) => r.slug === HUB) ?? REGION_SHAPES[0];

    let raf = 0;
    let running = false;
    let last = 0;
    const kick = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    function spawnComet(now: number) {
      const { counts: c } = live.current;
      const pool = REGION_SHAPES.filter(
        (r) => r.slug !== HUB && (c[r.slug] ?? 0) > 0,
      );
      const list = pool.length
        ? pool
        : REGION_SHAPES.filter((r) => r.slug !== HUB);
      // Ko'p ijodkorli hududlarga ko'proq kometa
      const weights = list.map((r) => 1 + Math.sqrt(c[r.slug] ?? 0));
      let pick = Math.random() * weights.reduce((a, b) => a + b, 0);
      let target = list[0];
      for (let i = 0; i < list.length; i++) {
        pick -= weights[i];
        if (pick <= 0) {
          target = list[i];
          break;
        }
      }
      const dx = target.cx - hubShape.cx;
      const dy = target.cy - hubShape.cy;
      const len = Math.hypot(dx, dy) || 1;
      let px = -dy / len;
      let py = dx / len;
      if (py > 0) {
        px = -px;
        py = -py;
      }
      const lift = Math.min(150, len * 0.35);
      comets.push({
        ax: hubShape.cx,
        ay: hubShape.cy,
        bx: target.cx,
        by: target.cy,
        cx: (hubShape.cx + target.cx) / 2 + px * lift,
        cy: (hubShape.cy + target.cy) / 2 + py * lift,
        t0: now,
        dur: 1100 + len * 1.6,
        target: REGION_INDEX[target.slug] ?? 0,
      });
    }

    function frame(now: number) {
      const L = live.current;
      const animate = L.motion && !reduce;
      if (!visible || document.hidden || cssW === 0) {
        running = false;
        last = 0;
        return;
      }
      const t = now - t0;
      // Fizika vaqtga bog'langan: sekin qurilmada (kam FPS) kadr uchun bir necha qadam — tezlik bir xil qoladi
      const steps = last
        ? Math.max(1, Math.min(4, Math.round((now - last) / 16.7)))
        : 1;
      last = now;
      const f = field;
      const stars = starsRef.current;
      const hoverIdx = L.hover ? (REGION_INDEX[L.hover] ?? -1) : -1;
      const selIdx = L.selected ? (REGION_INDEX[L.selected] ?? -1) : -1;

      /* ---------- Fizika ---------- */
      let settled = true;
      if (animate) {
        const ptr = pointer.current;
        const rp = ripple.current;
        const rAge = rp ? now - rp.t : Infinity;
        if (rp && rAge > 1600) ripple.current = null;
        const pxu = (cssW / L.vb.w) * L.view.k; // ekran pikseli / xarita birligi
        const R = 44 / pxu; // magnit linza radiusi ~44px
        const push = 1.5 / Math.max(0.5, pxu);
        const R2 = R * R;
        for (let step = 0; step < steps; step++)
          for (let i = 0; i < f.n; i++) {
            if (t < f.delay[i]) continue; // hali Toshkentdan "uchib chiqmagan"
            const ph = f.phase[i];
            let tx = f.hx[i] + Math.sin(t * 0.0011 + ph) * 0.7;
            let ty = f.hy[i] + Math.cos(t * 0.0009 + ph * 1.3) * 0.7;
            if (f.region[i] === hoverIdx) {
              // Hover qilingan hudud "nafas oladi" — kattaroq amplituda
              tx += Math.sin(t * 0.004 + ph) * 1.1;
              ty += Math.cos(t * 0.0045 + ph) * 1.1;
            }
            let ax = (tx - f.x[i]) * 0.055;
            let ay = (ty - f.y[i]) * 0.055;
            if (ptr) {
              const dx = f.x[i] - ptr.x;
              const dy = f.y[i] - ptr.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < R2 && d2 > 0.01) {
                const d = Math.sqrt(d2);
                const k = (1 - d / R) ** 2 * push;
                ax += (dx / d) * k;
                ay += (dy / d) * k;
              }
            }
            if (rp && rAge < 1600) {
              const dx = f.x[i] - rp.x;
              const dy = f.y[i] - rp.y;
              const d = Math.sqrt(dx * dx + dy * dy) || 1;
              const front = rAge * 0.55;
              const gap = Math.abs(d - front);
              if (gap < 22) {
                const k = (1 - gap / 22) * 2.4 * (1 - rAge / 1600);
                ax += (dx / d) * k;
                ay += (dy / d) * k;
              }
            }
            f.vx[i] = (f.vx[i] + ax) * 0.8;
            f.vy[i] = (f.vy[i] + ay) * 0.8;
            f.x[i] += f.vx[i];
            f.y[i] += f.vy[i];
          }
        settled = false;
      }

      /* ---------- Chizish ---------- */
      if (animate || dirty.current) {
        dirty.current = false;
        const s = (cssW / L.vb.w) * dpr;
        const k = L.view.k;
        ctx!.setTransform(1, 0, 0, 1, 0, 0);
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        ctx!.setTransform(
          s * k,
          0,
          0,
          s * k,
          (L.view.x - L.vb.x) * s,
          (L.view.y - L.vb.y) * s,
        );
        const unit = 1 / (cssW / L.vb.w) / k; // 1 ekran pikseli xarita birligida (zoom hisobga olingan)
        const waveR = animate ? ((t % 6500) / 6500) * 1300 - 120 : -9999;
        const maxN = Math.max(1, L.max);

        for (let ri = 0; ri < f.ranges.length; ri++) {
          const [a, b] = f.ranges[ri];
          const n = L.counts[SLUGS[ri]] ?? 0;
          const c = n > 0 ? Math.pow(n / maxN, 0.7) : 0;
          const on = ri === hoverIdx || ri === selIdx;
          const dim = hoverIdx >= 0 && !on ? 0.4 : 1;
          const r = (on ? 1.9 : n > 0 ? 1.15 + c * 0.6 : 1) * unit;
          // Asosiy nuqtalar
          ctx!.globalAlpha = (on ? 1 : n > 0 ? 0.55 + c * 0.45 : 0.6) * dim;
          ctx!.fillStyle = on
            ? colors.accent
            : n > 0
              ? colors.accent
              : colors.dot;
          ctx!.beginPath();
          const hotIdx: number[] = [];
          for (let i = a; i < b; i++) {
            if (animate && t < f.delay[i]) continue;
            const x = f.x[i];
            const y = f.y[i];
            if (animate && Math.abs(f.hubDist[i] - waveR) < 22) {
              hotIdx.push(i);
              continue;
            }
            ctx!.moveTo(x + r, y);
            ctx!.arc(x, y, r, 0, Math.PI * 2);
          }
          ctx!.fill();
          // To'lqin ustidagi nuqtalar — yorqinroq va kattaroq
          if (hotIdx.length) {
            ctx!.globalAlpha = 0.9 * dim;
            ctx!.fillStyle = colors.accent;
            ctx!.beginPath();
            for (const i of hotIdx) {
              const w = 1 - Math.abs(f.hubDist[i] - waveR) / 22;
              const rr = r * (1 + w * 0.8);
              ctx!.moveTo(f.x[i] + rr, f.y[i]);
              ctx!.arc(f.x[i], f.y[i], rr, 0, Math.PI * 2);
            }
            ctx!.fill();
          }
        }

        // Yulduzlar — ijodkorlar: yumshoq nur + oq yadro, miltillaydi
        if (stars) {
          ctx!.fillStyle = colors.accent;
          ctx!.globalAlpha = 0.28;
          ctx!.beginPath();
          const core: [number, number, number][] = [];
          for (let i = 0; i < f.n; i++) {
            if (!stars[i] || (animate && t < f.delay[i] + 250)) continue;
            const on = f.region[i] === hoverIdx || f.region[i] === selIdx;
            if (hoverIdx >= 0 && !on) continue;
            const tw = animate
              ? 0.75 + 0.25 * Math.sin(t * 0.004 + f.phase[i] * 3)
              : 1;
            const rr = (on ? 7 : 5.5) * tw * unit;
            ctx!.moveTo(f.x[i] + rr, f.y[i]);
            ctx!.arc(f.x[i], f.y[i], rr, 0, Math.PI * 2);
            core.push([f.x[i], f.y[i], (on ? 2.6 : 2.1) * tw * unit]);
          }
          ctx!.fill();
          // So'nik hududlardagi yulduzlar ham ko'rinsin, lekin xira
          if (hoverIdx >= 0) {
            ctx!.globalAlpha = 0.35;
            ctx!.fillStyle = colors.accent;
            ctx!.beginPath();
            for (let i = 0; i < f.n; i++) {
              if (
                !stars[i] ||
                f.region[i] === hoverIdx ||
                f.region[i] === selIdx
              )
                continue;
              if (animate && t < f.delay[i] + 250) continue;
              const rr = 1.8 * unit;
              ctx!.moveTo(f.x[i] + rr, f.y[i]);
              ctx!.arc(f.x[i], f.y[i], rr, 0, Math.PI * 2);
            }
            ctx!.fill();
          }
          ctx!.globalAlpha = 1;
          ctx!.fillStyle = colors.core;
          ctx!.beginPath();
          for (const [x, y, rr] of core) {
            ctx!.moveTo(x + rr, y);
            ctx!.arc(x, y, rr, 0, Math.PI * 2);
          }
          ctx!.fill();
          ctx!.strokeStyle = colors.accent;
          ctx!.lineWidth = 1.1 * unit;
          ctx!.globalAlpha = 0.9;
          ctx!.beginPath();
          for (const [x, y, rr] of core) {
            ctx!.moveTo(x + rr, y);
            ctx!.arc(x, y, rr, 0, Math.PI * 2);
          }
          ctx!.stroke();
        }

        // Kometalar (hero): Toshkentdan viloyatlarga — dumi so'nib boruvchi nuqtalar zanjiri
        if (animate && L.hero) {
          if (now >= nextComet && t > 1600) {
            spawnComet(now);
            nextComet = now + 650 + Math.random() * 700;
          }
          for (let ci = comets.length - 1; ci >= 0; ci--) {
            const cm = comets[ci];
            const p = (now - cm.t0) / cm.dur;
            if (p >= 1) {
              bursts.push({ x: cm.bx, y: cm.by, t0: now });
              comets.splice(ci, 1);
              continue;
            }
            const e = 1 - Math.pow(1 - p, 2);
            ctx!.fillStyle = colors.accent;
            for (let j = 0; j < 16; j++) {
              const q = e - j * 0.018;
              if (q < 0) break;
              const x = quad(cm.ax, cm.cx, cm.bx, q);
              const y = quad(cm.ay, cm.cy, cm.by, q);
              ctx!.globalAlpha = (1 - j / 16) * 0.85;
              ctx!.beginPath();
              ctx!.arc(x, y, (2.4 - j * 0.12) * unit, 0, Math.PI * 2);
              ctx!.fill();
            }
            ctx!.globalAlpha = 1;
            ctx!.fillStyle = colors.core;
            ctx!.beginPath();
            ctx!.arc(
              quad(cm.ax, cm.cx, cm.bx, e),
              quad(cm.ay, cm.cy, cm.by, e),
              1.3 * unit,
              0,
              Math.PI * 2,
            );
            ctx!.fill();
          }
        }
        // Halqalar: kometa yetib borgan joyda
        for (let bi = bursts.length - 1; bi >= 0; bi--) {
          const bu = bursts[bi];
          const p = (now - bu.t0) / 750;
          if (p >= 1 || !animate) {
            bursts.splice(bi, 1);
            continue;
          }
          ctx!.globalAlpha = (1 - p) * 0.8;
          ctx!.strokeStyle = colors.accent;
          ctx!.lineWidth = (1.6 * (1 - p) + 0.4) * unit;
          ctx!.beginPath();
          ctx!.arc(bu.x, bu.y, (3 + p * 18) * unit, 0, Math.PI * 2);
          ctx!.stroke();
        }
        // Zarb to'lqini halqasi (hudud bosilganda)
        const rp = ripple.current;
        if (animate && rp) {
          const age = now - rp.t;
          if (age < 1200) {
            ctx!.globalAlpha = (1 - age / 1200) * 0.55;
            ctx!.strokeStyle = colors.accent;
            ctx!.lineWidth = 1.5 * unit;
            ctx!.beginPath();
            ctx!.arc(rp.x, rp.y, age * 0.55, 0, Math.PI * 2);
            ctx!.stroke();
          }
        }
        ctx!.globalAlpha = 1;
      }

      if (animate || !settled || dirty.current)
        raf = requestAnimationFrame(frame);
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
      mq.removeEventListener("change", onScheme);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [motion]); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
