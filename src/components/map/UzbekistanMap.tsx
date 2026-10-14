"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { MAP_VIEWBOX, REGION_SHAPES, type RegionShape } from "./regions-geo";
import { ParticleMap, type Ripple } from "./ParticleMap";
import { REGION_NEIGHBOURS, REGION_TAB_ORDER, type ArrowKey } from "./geo-utils";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * O'zbekiston xaritasi — "tirik zarrachalar": vizual qatlam canvas'da (ParticleMap) — nuqtalar zichligi
 * va yorqinligi mutaxassislar soniga qarab, har bir yorqin "yulduz" bitta ijodkor. SVG esa ustida
 * shaffof bosish maydonlari, chegaralar, yorliqlar va a11y uchun qoladi.
 * - Hover/tanlashda hudud nuqtalari jonlanadi, ma'lumot kartochkasi xaritaning bo'sh burchagida chiqadi
 * - variant="hero": Toshkentdan viloyatlarga kometalar, son pill'lari (top-3)
 * - Yorliqlar: ekranda ~10px o'lchamda; avval gorizontal siljitiladi, keyin vertikal; uzoqlashganiga qisqa chiziq
 * - A11y: <svg> ichidagi har bir hudud role="button" (svg'ning o'zi role="img" EMAS — ichidagi tugmalar AT uchun ochiq).
 *   Klaviatura: bitta Tab to'xtash joyi (roving tabindex), strelkalar — qo'shni hudud, Enter/Probel — tanlash, Esc — bekor qilish,
 *   Home/End — g'arbiy/sharqiy chekka; zoomable bo'lsa +/−/0 — masshtab
 * - Bosish maydoni: kichik hududlar (Toshkent sh., Sirdaryo) ekranda <32px bo'lsa, markazida ko'rinmas
 *   ≥40px disk; hero'dagi son pill'lari va yorliqlar ham o'z hududini tanlaydi (qo'shni hududni emas)
 * - zoomable: +/−/qaytarish tugmalari, Ctrl/⌘ + g'ildirak (trackpad pinch), sensorda ikki barmoq; 1–3x, chegaradan chiqmaydi
 */

/** Yorliq markazining hudud markaziga nisbatan siljishi (viewBox birligida). Zich markaz — bo'sh joyga (Qozog'iston/Tojikiston tomoni) */
const LABEL_OFFSET: Record<string, [number, number]> = {
  "toshkent-shahri": [-70, -52],
  "toshkent-viloyati": [62, -42],
  sirdaryo: [46, 50],
  jizzax: [-14, 28],
  namangan: [-4, -30],
  andijon: [10, 24],
  fargona: [0, 28],
  xorazm: [-12, 24],
  surxondaryo: [10, 26],
  qashqadaryo: [0, 26],
  samarqand: [4, 22],
};
/** Shundan uzoq yorliq hudud markeriga qisqa chiziq bilan bog'lanadi */
const LEADER_MIN = 24;

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box, pad = 2) => Math.abs(a.x - b.x) * 2 < a.w + b.w + pad * 2 && Math.abs(a.y - b.y) * 2 < a.h + b.h + pad * 2;

/**
 * Yorliqlarni joylash: ko'p sonlilar birinchi (afzal joyni oladi). Har bir yorliq uchun nomzodlar tartibi —
 * avval shu qatorda gorizontal siljish (±⅓, ±⅔ kenglik), keyin bir qator past/yuqori va h.k.
 * To'siqlar: joylangan yorliqlar + boshqa hududlarning markerlari; viewBox'dan chiqmaydi.
 */
function layoutLabels(items: (Box & { slug: string; n: number })[], obstacles: (Box & { slug: string })[], bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  const placed: Box[] = [];
  const out: Record<string, { x: number; y: number }> = {};
  const order = [...items].sort((a, b) => b.n - a.n);
  for (const it of order) {
    const others = obstacles.filter((o) => o.slug !== it.slug);
    const free = (x: number, y: number) => {
      const b = { x, y, w: it.w, h: it.h };
      if (x - it.w / 2 < bounds.minX || x + it.w / 2 > bounds.maxX || y - it.h / 2 < bounds.minY || y + it.h / 2 > bounds.maxY) return false;
      return !placed.some((p) => overlaps(b, p)) && !others.some((o) => overlaps(b, o, 0));
    };
    let pos = { x: it.x, y: it.y };
    search: for (const dy of [0, 1, -1, 2, -2, 3]) {
      for (const dx of [0, -1 / 3, 1 / 3, -2 / 3, 2 / 3]) {
        const x = it.x + dx * it.w;
        const y = it.y + dy * (it.h + 3);
        if (free(x, y)) {
          pos = { x, y };
          break search;
        }
      }
    }
    placed.push({ ...pos, w: it.w, h: it.h });
    out[it.slug] = pos;
  }
  return out;
}

type View = { k: number; x: number; y: number };
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const VIEW_IDENTITY: View = { k: 1, x: 0, y: 0 };

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
  /** Zoom/pan (faqat panel rejimida; bosh sahifa hero'si statik qoladi) */
  zoomable?: boolean;
}

const SLAB = 18; // pastki bo'sh joy (viewBox birligida)
const LABEL_MIN_WIDTH = 520; // shu kenglikdan tor xaritada yorliqlar yashiriladi (px)
const LABEL_SCREEN_PX = 10; // yorliq matnining ekrandagi minimal o'lchami (px)
const LABEL_MAX_UNIT_SCALE = 1.6; // yorliq xarita birligida shundan katta bo'lishi kerak bo'lsa — joy yetmaydi, yashiriladi
const HIT_MIN_PX = 32; // hudud ekranda shundan kichik bo'lsa — qo'shimcha bosish diski
const HIT_DISC_PX = 40; // diskning ekrandagi diametri (px)

/* ---------------- Hudud geometriyasi ---------------- */
interface MapShape extends RegionShape {
  /** Konturning kichik tomoni — kichik hududlarga qo'shimcha bosish diski */
  size: number;
}
const SHAPES: MapShape[] = REGION_SHAPES.map((r) => {
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
  return { ...r, size: nums.length ? Math.min(maxX - minX, maxY - minY) : Infinity };
});
const SHAPE_BY_SLUG: Record<string, MapShape> = Object.fromEntries(SHAPES.map((r) => [r.slug, r]));

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
  zoomable = false,
}: UzbekistanMapProps) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  /** Ma'lumot oynasi joyi: xaritaning hududni (va qo'shnilarini) to'smaydigan burchagi */
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [width, setWidth] = useState<number>(0);
  /** Roving tabindex: Tab bilan kiriladigan yagona hudud */
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  /** Klaviatura fokusi (:focus-visible) — ustki kontur faqat shunda chiziladi */
  const [kbFocus, setKbFocus] = useState<string | null>(null);
  const [view, setView] = useState<View>(VIEW_IDENTITY);
  const [dragging, setDragging] = useState(false);
  const [wheelHint, setWheelHint] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const touchTip = useRef(false);
  const suppressClick = useRef(false);
  const lastDragEnd = useRef(0);
  const armedSlug = useRef<string | null>(null);
  const uid = useId().replace(/:/g, "");
  const descId = `${uid}-desc`;

  const count = (slug: string) => counts?.[slug] ?? stats?.[slug]?.total ?? 0;
  const max = useMemo(() => Math.max(1, ...SHAPES.map((r) => count(r.slug))), [stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => SHAPES.reduce((a, r) => a + count(r.slug), 0), [stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Canvas qatlami uchun: sichqoncha joyi (xarita birligida) va zarb to'lqini manbai */
  const pointerMap = useRef<{ x: number; y: number } | null>(null);
  const ripple = useRef<Ripple | null>(null);
  const countMap = useMemo(() => Object.fromEntries(SHAPES.map((r) => [r.slug, count(r.slug)])) as Record<string, number>, [stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const isHero = variant === "hero";
  const tipW = width > 0 && width < 480 ? 188 : 224;
  const topSlugs = useMemo(
    () => [...SHAPES].sort((a, b) => count(b.slug) - count(a.slug)).slice(0, 3).map((r) => r.slug),
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

  /* Harakatni kamaytirish sozlamasi — to'lqin/yoy/chizilish animatsiyalari o'chadi */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduceMotion(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  /*
   * Ma'lumot oynasi hudud ustida emas — xaritaning BO'SH burchagida chiqadi: to'rt burchakdan qaysi biri
   * tanlangan hududni (katta og'irlik bilan) va boshqa hududlarni eng kam to'ssa, o'sha tanlanadi.
   * Hudud o'zi ko'tarilib, yorishib turadi — bog'liqlik ko'rinib turadi, qo'shni hududlar ochiq qoladi.
   */
  useEffect(() => {
    if (!hover) {
      setTip(null);
      return;
    }
    const w = wrap.current;
    const el = pathRefs.current.get(hover);
    if (!w || !el) return;
    const wr = w.getBoundingClientRect();
    type R = { x: number; y: number; w: number; h: number };
    const rel = (e: Element): R => {
      const r = e.getBoundingClientRect();
      return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height };
    };
    const ov = (a: R, b: R) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const m = 20;
    const hr = rel(el);
    const hot = { x: hr.x - m, y: hr.y - m, w: hr.w + 2 * m, h: hr.h + 2 * m };
    const others = [...pathRefs.current.entries()].filter(([slug]) => slug !== hover).map(([, e]) => rel(e));
    // Yorliqlar va son pill'lari ham to'silmasin (kichik, lekin o'qilishi muhim — og'irligi yuqoriroq)
    const marks = [...w.querySelectorAll("[data-map-mark]")].map(rel);
    const cw = tipW;
    const ch = tipRef.current?.offsetHeight ?? (activeStat ? 190 : 124);
    const pad = 8;
    const topRight = canZoom ? 56 : pad; // zoom tugmalari o'ng tepada
    // Nomzodlar: 4 burchak + tepa/past o'rta. x/y — kartaning chap-yuqori nuqtasi (wrap'ga nisbatan)
    const W = wr.width;
    const H = wr.height;
    const xs = { left: pad, mid: Math.round((W - cw) / 2), right: W - cw - pad };
    const cands: { x: number; y: number }[] = [
      { x: xs.left, y: H - ch - pad },
      { x: xs.right, y: H - ch - pad },
      { x: xs.left, y: pad },
      { x: W - cw - topRight, y: pad },
      { x: xs.mid, y: pad },
      { x: xs.mid, y: H - ch - pad },
    ];
    let best = cands[0];
    let bestScore = Infinity;
    cands.forEach((c, i) => {
      const box = { x: c.x, y: c.y, w: cw, h: ch };
      const score = ov(box, hot) * 30 + others.reduce((acc, o) => acc + ov(box, o), 0) + marks.reduce((acc, o) => acc + ov(box, o) * 6, 0) + i * 40;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    });
    setTip((t) => (t && t.x === best.x && t.y === best.y ? t : { x: best.x, y: best.y }));
  }, [hover, view, width]); // eslint-disable-line react-hooks/exhaustive-deps


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

  /* Sichqoncha joyi zarrachalar uchun (ular undan qochadi): ekran → viewBox → zoom'dan oldingi xarita birligi */
  const onWrapMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const p = toSvg(e.clientX, e.clientY);
    pointerMap.current = { x: (p.x - view.x) / k, y: (p.y - view.y) / k };
  };

  const onRegionPointerDown = (e: PointerEvent<SVGElement>, slug: string) => {
    if (e.pointerType !== "touch") return;
    touchTip.current = true;
    setHover(slug);
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
    // Sudrash/pinch tugagan zahoti keladigan "click" — tanlov emas
    if (Date.now() - lastDragEnd.current < 350) return;
    pick(slug);
  };

  const pick = (slug: string) => {
    const sh = SHAPE_BY_SLUG[slug];
    if (sh) ripple.current = { x: sh.cx, y: sh.cy, t: performance.now() };
    if (onSelect) onSelect(selected === slug ? null : slug);
    else if (hrefFor) router.push(hrefFor(slug));
    else if (linkTo === "xarita") router.push(`/xarita?region=${slug}`);
    else router.push(`/mutaxassislar?region=${slug}`);
  };

  /* ---------------- Zoom / pan (viewBox birligida: p' = k·p + t) ---------------- */
  const VB = { x: -24, y: -24, w: MAP_VIEWBOX.width + 48, h: MAP_VIEWBOX.height + 48 + SLAB };
  const vb = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
  const canZoom = zoomable && !isHero;
  const k = canZoom ? view.k : 1;

  /** Ko'rinadigan oyna xarita ichida qolsin (bo'sh joyga "suzib" ketmasin) */
  const clampView = useCallback(
    (v: View): View => {
      const kk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k));
      const lim = (t: number, o: number, size: number) => Math.min(o * (1 - kk), Math.max((o + size) * (1 - kk), t));
      return { k: kk, x: lim(v.x, VB.x, VB.w), y: lim(v.y, VB.y, VB.h) };
    },
    [VB.x, VB.y, VB.w, VB.h],
  );
  /** Ekran nuqtasi → svg (viewBox) koordinatasi */
  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: VB.x + VB.w / 2, y: VB.y + VB.h / 2 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  /** (px, py) nuqtasi joyida qolgan holda masshtabni nk ga o'zgartirish */
  const zoomAt = useCallback(
    (px: number, py: number, nk: number) =>
      setView((v) => {
        const kk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nk));
        const qx = (px - v.x) / v.k;
        const qy = (py - v.y) / v.k;
        return clampView({ k: kk, x: px - kk * qx, y: py - kk * qy });
      }),
    [clampView],
  );
  const zoomBy = (f: number) => zoomAt(VB.x + VB.w / 2, VB.y + VB.h / 2, view.k * f);
  const resetZoom = () => setView(VIEW_IDENTITY);

  /* Ctrl/⌘ + g'ildirak (trackpad pinch ham shu) — zoom; oddiy g'ildirak sahifani aylantiradi va ishora chiqadi */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !canZoom) return;
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        setWheelHint(true);
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => setWheelHint(false), 1400);
        return;
      }
      e.preventDefault();
      setWheelHint(false);
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const f = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.006);
      setView((v) => {
        const kk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * f));
        const qx = (p.x - v.x) / v.k;
        const qy = (p.y - v.y) / v.k;
        return clampView({ k: kk, x: p.x - kk * qx, y: p.y - kk * qy });
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", onWheel);
      clearTimeout(hintTimer);
    };
  }, [canZoom, clampView]);

  /* Sudrash (k>1) va ikki barmoq bilan pinch — pointer hodisalari */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; view: View; moved: boolean; pinch?: { d0: number; k0: number; qx: number; qy: number } } | null>(null);
  const hideTip = () => {
    setHover(null);
    setTip(null);
    touchTip.current = false;
    armedSlug.current = null;
    suppressClick.current = false;
  };
  const unitsPerPx = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width > 0 ? VB.w / r.width : 1;
  };
  const onSvgPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!canZoom || (e.pointerType === "mouse" && e.button !== 0)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      hideTip(); // pinch — birinchi barmoq ochgan tooltip xaritani to'smasin
      const [a, b] = [...pointers.current.values()];
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      gesture.current = {
        startX: e.clientX,
        startY: e.clientY,
        view,
        moved: true,
        pinch: { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: view.k, qx: (mid.x - view.x) / view.k, qy: (mid.y - view.y) / view.k },
      };
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    } else if (pointers.current.size === 1) {
      gesture.current = { startX: e.clientX, startY: e.clientY, view, moved: false };
    }
  };
  const onSvgPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!canZoom || !g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      const kk = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (g.pinch.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.pinch.d0));
      setView(clampView({ k: kk, x: mid.x - kk * g.pinch.qx, y: mid.y - kk * g.pinch.qy }));
      return;
    }
    if (g.view.k <= 1) return; // 1x da surish yo'q — sahifa aylanadi
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    if (!g.moved) {
      g.moved = true;
      hideTip();
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    const u = unitsPerPx();
    setView(clampView({ k: g.view.k, x: g.view.x + dx * u, y: g.view.y + dy * u }));
  };
  const onSvgPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.moved) lastDragEnd.current = Date.now();
    if (pointers.current.size === 1 && g?.pinch) {
      // Pinch'dan keyin bitta barmoq qoldi — shu nuqtadan surishni davom ettiramiz
      const [rest] = [...pointers.current.values()];
      gesture.current = { startX: rest.x, startY: rest.y, view, moved: true };
      return;
    }
    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    }
  };

  /* Tanlangan hudud zoom paytida ko'rinmay qolsa — markazga keltiramiz */
  useEffect(() => {
    if (!canZoom || !selected || view.k <= 1) return;
    const r = SHAPE_BY_SLUG[selected];
    if (!r) return;
    const sx = view.k * r.cx + view.x;
    const sy = view.k * r.cy + view.y;
    const m = 60;
    if (sx < VB.x + m || sx > VB.x + VB.w - m || sy < VB.y + m || sy > VB.y + VB.h - m) {
      setView((v) => clampView({ k: v.k, x: VB.x + VB.w / 2 - v.k * r.cx, y: VB.y + VB.h / 2 - v.k * r.cy }));
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- Klaviatura ---------------- */
  const tabSlug = focusSlug ?? selected ?? REGION_TAB_ORDER[0];
  const focusRegion = (slug: string) => {
    setFocusSlug(slug);
    pathRefs.current.get(slug)?.focus();
  };
  const onRegionKeyDown = (e: KeyboardEvent<SVGPathElement>, slug: string) => {
    const key = e.key;
    if (key === "Enter" || key === " ") {
      e.preventDefault();
      pick(slug);
    } else if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      const next = REGION_NEIGHBOURS[slug]?.[key as ArrowKey];
      if (next) focusRegion(next);
    } else if (key === "Home" || key === "End") {
      e.preventDefault();
      focusRegion(key === "Home" ? REGION_TAB_ORDER[0] : REGION_TAB_ORDER[REGION_TAB_ORDER.length - 1]);
    } else if (key === "Escape") {
      setHover(null);
      setTip(null);
      if (onSelect && selected) {
        e.preventDefault();
        onSelect(null);
      }
    } else if (canZoom && (key === "+" || key === "=" || key === "-" || key === "0")) {
      e.preventDefault();
      if (key === "0") resetZoom();
      else zoomBy(key === "-" ? 1 / 1.5 : 1.5);
    }
  };

  /* Ekran piksel / viewBox birligi (zoom hisobga olingan) — kichik hududlar uchun bosish diski o'lchami */
  const basePxPerUnit = width > 0 ? width / VB.w : 0.6;
  const pxPerUnit = basePxPerUnit * k;
  const hitR = HIT_DISC_PX / 2 / pxPerUnit;
  const smallRegions = SHAPES.filter((r) => r.size * pxPerUnit < HIT_MIN_PX);
  /**
   * Yorliq masshtabi: matn ekranda ≥10px bo'lsin. Xarita birligidagi o'lchami (labelScale / k) 1.6x dan oshsa —
   * yorliqlar xaritaga sig'maydi (tor ekran), ular yashiriladi; zoom qilinganda qaytib chiqadi (masalan, telefonda ~1.8x).
   */
  const labelScale = Math.max(1, LABEL_SCREEN_PX / (11.5 * basePxPerUnit));
  const labelsOn = showLabels && !isHero && !compact && width * k >= LABEL_MIN_WIDTH && labelScale / k <= LABEL_MAX_UNIT_SCALE;

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

  /*
   * Yorliq joylashuvi (kollziya tekshiruvi bilan). Qutilar "xarita" birligida: zoom k bo'lsa yorliq 1/k marta
   * kichrayadi (ekranda o'zgarmaydi), shuning uchun zich markaz zoom'da o'z-o'zidan yoyiladi.
   */
  const labelK = Math.round(k * 4) / 4; // har bir mayda zoom qadamida qayta hisoblamaslik uchun
  const labels = useMemo(() => {
    if (!labelsOn) return null;
    const s = labelScale / labelK;
    const markerBoxes = SHAPES.filter((r) => count(r.slug) > 0).map((r) => ({ slug: r.slug, x: r.cx, y: r.cy, w: 14 / labelK, h: 14 / labelK }));
    const items = SHAPES.map((r) => {
      const n = count(r.slug);
      const [ox, oy] = LABEL_OFFSET[r.slug] ?? [0, n > 0 ? 20 : 0];
      const label = REGION_BY_SLUG[r.slug]?.short ?? r.name;
      const w = (label.length * 7.4 + (n > 0 ? String(n).length * 8 + 18 : 14)) * s;
      const cy = r.cy;
      return { slug: r.slug, label, n, cx: r.cx, cy, w, h: 22 * s, x: r.cx + ox * s, y: cy + oy * s };
    });
    const pos = layoutLabels(items, markerBoxes, { minX: VB.x + 2, maxX: VB.x + VB.w - 2, minY: VB.y + 2, maxY: VB.y + VB.h - SLAB });
    return items.map((it) => {
      const p = pos[it.slug];
      // Qisqa chiziq: yorliq markerdan uzoqlashgan bo'lsa — markerdan yorliq qutisining eng yaqin nuqtasigacha
      const ex = Math.min(p.x + it.w / 2, Math.max(p.x - it.w / 2, it.cx));
      const ey = Math.min(p.y + it.h / 2, Math.max(p.y - it.h / 2, it.cy));
      const leader = Math.hypot(p.x - it.cx, p.y - it.cy) > (LEADER_MIN + 4) * s && Math.hypot(ex - it.cx, ey - it.cy) > 6 * s;
      return { ...it, ...p, s, leader: leader ? { x2: ex, y2: ey } : null };
    });
  }, [labelsOn, labelScale, labelK, stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const motion = !reduceMotion;

  return (
    <div
      ref={wrap}
      className={cn("relative select-none", className)}
      onPointerMove={onWrapMove}
      onPointerLeave={() => {
        pointerMap.current = null;
      }}
    >
      <div className={cn(isHero && motion && "map-float")}>
        <div className="map-enter relative">
          {/* Vizual qatlam: tirik zarrachalar (canvas). SVG ustida faqat bosish maydonlari, chegara va yorliqlar */}
          <ParticleMap
            vb={VB}
            view={canZoom ? view : VIEW_IDENTITY}
            counts={countMap}
            max={max}
            hover={hover}
            selected={selected ?? null}
            hero={isHero}
            motion={motion}
            pointer={pointerMap}
            ripple={ripple}
            className={cn("pointer-events-none absolute inset-0 h-full w-full", k > 1 && "rounded-card")}
          />
          <svg
            ref={svgRef}
            viewBox={vb}
            className={cn("relative h-auto w-full", k > 1 ? "overflow-hidden rounded-card" : "overflow-visible", k > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"))}
            style={canZoom ? { touchAction: k > 1 ? "none" : "pan-y" } : undefined}
            onMouseLeave={() => {
              if (touchTip.current) return;
              setHover(null);
              setTip(null);
            }}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerCancel={(e) => {
              // Bosish bekor bo'ldi (masalan, barmoq sahifani aylantirib yubordi) — click kelmaydi,
              // bayroq keyingi haqiqiy bosishni yutib yubormasin
              suppressClick.current = false;
              onSvgPointerUp(e);
            }}
            aria-label="O'zbekiston hududlari xaritasi"
            aria-describedby={descId}
          >
            <desc id={descId}>
              14 ta hudud. Har bir yorqin nuqta — bitta {unitLabel}. Har bir hudud — tugma: bosilganda yoki Enter tugmasida o'sha hududdagi {unitLabel}lar ro'yxati
              ochiladi. Strelkalar — qo'shni hudud, Esc — tanlovni bekor qilish{canZoom ? ", plyus/minus — masshtab" : ""}. Jami {total} ta.
            </desc>
            <defs>
              <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Orqa nur (hero) */}
            {isHero && (
              <g aria-hidden="true">
                <ellipse cx={MAP_VIEWBOX.width / 2} cy={MAP_VIEWBOX.height / 2} rx={560} ry={330} fill={`url(#${uid}-glow)`} />
              </g>
            )}

            {/* Zoom qatlami: barcha SVG qatlamlari bitta transform ostida (canvas ham xuddi shu transform bilan chiziladi) */}
            <g
              className={cn(canZoom && "map-zoom-layer")}
              data-dragging={dragging || undefined}
              style={canZoom ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transformBox: "view-box" } : undefined}
            >
              {/* Chegaralar: zarrachalar tarqalib bo'lgach chizilib paydo bo'ladi */}
              <g pointerEvents="none" aria-hidden="true">
                {SHAPES.map((r, i) => (
                  <path
                    key={r.slug}
                    d={r.d}
                    fill="none"
                    stroke="var(--map-edge)"
                    strokeWidth={1 / k}
                    strokeLinejoin="round"
                    pathLength={1}
                    className={motion ? "map-draw" : undefined}
                    style={motion ? { animationDelay: `${0.9 + i * 0.06}s` } : undefined}
                  />
                ))}
              </g>

              {/* Hududlar — shaffof tugmalar (roving tabindex: Tab bilan bitta hududga kiriladi, strelkalar bilan yuriladi) */}
              <g role="group" aria-label="Hududlar">
                {SHAPES.map((r) => {
                  const n = count(r.slug);
                  const isSel = selected === r.slug;
                  const on = isSel || hover === r.slug;
                  return (
                    <path
                      key={r.slug}
                      ref={(el) => {
                        if (el) pathRefs.current.set(r.slug, el);
                        else pathRefs.current.delete(r.slug);
                      }}
                      d={r.d}
                      className={cn("region-path", on && "is-active")}
                      stroke={on ? "var(--accent)" : "transparent"}
                      strokeWidth={(on ? 2 : 1) / k}
                      strokeLinejoin="round"
                      style={{ fill: on ? "color-mix(in oklab, var(--accent) 9%, transparent)" : "transparent" }}
                      onMouseEnter={() => {
                        if (!touchTip.current) setHover(r.slug);
                      }}
                      onPointerDown={(e) => onRegionPointerDown(e, r.slug)}
                      onClick={() => onRegionClick(r.slug)}
                      tabIndex={r.slug === tabSlug ? 0 : -1}
                      role="button"
                      aria-label={`${r.name}: ${n} ta ${unitLabel}`}
                      aria-pressed={onSelect ? isSel : undefined}
                      onFocus={(e) => {
                        setHover(r.slug);
                        setFocusSlug(r.slug);
                        setKbFocus(e.currentTarget.matches(":focus-visible") ? r.slug : null);
                      }}
                      onBlur={() => {
                        setKbFocus(null);
                        if (!touchTip.current) setHover(null);
                      }}
                      onKeyDown={(e) => onRegionKeyDown(e, r.slug)}
                    />
                  );
                })}
              </g>

              {/* Klaviatura fokusi konturi — qo'shni hududlar ustida */}
              {kbFocus && SHAPE_BY_SLUG[kbFocus] && <path d={SHAPE_BY_SLUG[kbFocus].d} className="region-focus-ring" style={{ strokeWidth: 3.5 / k }} aria-hidden="true" />}

              {/* Hero: eng ko'p ijodkorli 3 hudud — son pill'lari (zarrachalar joylashgach paydo bo'ladi) */}
              {isHero && (
                <g className={motion ? "map-late" : undefined} aria-hidden="true">
                  {topSlugs.map((slug) => {
                    const r = SHAPE_BY_SLUG[slug];
                    const n = count(slug);
                    if (!r || n === 0) return null;
                    const pillW = String(n).length * 10 + 22;
                    return (
                      <g key={slug} transform={`translate(${r.cx}, ${r.cy - 30})`} data-map-mark="" {...hitProps(slug)}>
                        <rect x={-pillW / 2} y={-14} width={pillW} height={28} rx={14} fill="var(--ink)" />
                        <path d="M -5 13 L 0 19 L 5 13 Z" fill="var(--ink)" />
                        <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="var(--ink-fg)" fontFamily="var(--font-display)">
                          {n}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Yorliqlar (panel rejimida, yetarli kenglikda): avval qisqa chiziqlar, ustidan yorliqlar */}
              {labels && (
                <g pointerEvents="none" aria-hidden="true" className={motion ? "map-late" : undefined}>
                  {labels.map(
                    (l) =>
                      l.leader && (
                        <g key={`${l.slug}-leader`}>
                          <line x1={l.cx} y1={l.cy} x2={l.leader.x2} y2={l.leader.y2} stroke="var(--fg-3)" strokeWidth={1.1 * l.s} strokeLinecap="round" opacity={0.7} />
                          <circle cx={l.cx} cy={l.cy} r={2.2 * l.s} fill="var(--fg-2)" />
                        </g>
                      ),
                  )}
                  {labels.map((l) => (
                    <g key={l.slug} transform={`translate(${l.x}, ${l.y})`} data-map-mark="" {...hitProps(l.slug)}>
                      <rect x={-l.w / 2} y={-l.h / 2} width={l.w} height={l.h} rx={l.h / 2} fill="var(--map-label-bg)" stroke="var(--line-2)" strokeWidth={l.s} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={11.5 * l.s} fontWeight={600} fill="var(--fg)" style={{ letterSpacing: "-0.01em" }}>
                        {l.label}
                        {l.n > 0 && (
                          <tspan fill="var(--accent-text)" fontWeight={800}>
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
            </g>
          </svg>
        </div>
      </div>

      {/* Zoom boshqaruvi (faqat /xarita) — sensorga qulay 40px tugmalar */}
      {canZoom && (
        <div className="absolute right-1 top-1 z-[11] flex flex-col overflow-hidden rounded-full border border-line bg-surface shadow-[var(--shadow-1)]" role="group" aria-label="Xarita masshtabi">
          <button
            type="button"
            onClick={() => zoomBy(1.5)}
            disabled={view.k >= ZOOM_MAX - 0.01}
            aria-label="Kattalashtirish"
            className="flex h-10 w-10 items-center justify-center text-fg-2 transition hover:bg-fg/6 hover:text-fg disabled:opacity-35"
          >
            <Plus size={16} />
          </button>
          <span className="mx-2 h-px bg-line" aria-hidden="true" />
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.5)}
            disabled={view.k <= ZOOM_MIN + 0.01}
            aria-label="Kichiklashtirish"
            className="flex h-10 w-10 items-center justify-center text-fg-2 transition hover:bg-fg/6 hover:text-fg disabled:opacity-35"
          >
            <Minus size={16} />
          </button>
          {view.k > 1.01 && (
            <>
              <span className="mx-2 h-px bg-line" aria-hidden="true" />
              <button
                type="button"
                onClick={resetZoom}
                aria-label="Asl ko'rinish"
                className="flex h-10 w-10 items-center justify-center text-fg-2 transition hover:bg-fg/6 hover:text-fg"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}
        </div>
      )}
      {canZoom && (
        <p
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-ink-fg shadow-[var(--shadow-2)] transition-opacity duration-300",
            wheelHint ? "opacity-95" : "opacity-0",
          )}
          aria-hidden="true"
        >
          Kattalashtirish: Ctrl / ⌘ + g'ildirak · sensorda ikki barmoq
        </p>
      )}

      {/* Ma'lumot oynasi — hudud ustida emas, xaritaning bo'sh burchagida (hududni ham, qo'shnilarini ham to'smaydi) */}
      {tip && activeRegion && hover && (
        <div
          ref={tipRef}
          key={`${tip.x}-${tip.y}`}
          className="card-floating map-tip-in pointer-events-none absolute z-[12] p-3.5"
          role="status"
          style={{
            width: tipW,
            left: tip.x,
            top: Math.max(8, tip.y),
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="icon-tile icon-tile-sm">
              <MapPin size={16} />
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
