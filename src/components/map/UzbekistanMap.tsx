"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { MAP_VIEWBOX, REGION_SHAPES } from "./regions-geo";
import { REGION_NEIGHBOURS, REGION_TAB_ORDER, type ArrowKey } from "./geo-utils";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import type { RegionStat } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * O'zbekiston xaritasi — premium 2D.
 * - Hudud bo'yicha choropleth (mutaxassislar soni) — rampa CSS tokenlarda (--map-tint-lo / --map-mix-floor / --map-mix-range),
 *   ≥1 ta bo'lgan hudud kamida "floor" tusini oladi (0 tadan aniq ajraladi; qorong'uda jigarrang emas)
 * - Ostida qalin "plita" (yengil 3D hissi), hover'da hudud ko'tariladi
 * - Pulsatsiya qiluvchi markerlar, tooltip (sichqoncha: hover, sensor: bosish)
 * - variant="hero": perspektiva bilan qiyshaytirilgan, sichqonchaga ergashadi
 * - Yorliqlar: ekranda ~10px o'lchamda; avval gorizontal siljitiladi, keyin vertikal; uzoqlashgan yorliqqa qisqa chiziq
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
/** Hero rejimidagi son pill'lari (top-3) uchun siljish — avvalgi joylashuv saqlanadi */
const HERO_PILL_OFFSET: Record<string, [number, number]> = {
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
/** Nuqta to'ri qadami (viewBox birligida) va darajalar: 0 — neytral, 1..5 — accent (kam → ko'p) */
const DOT_STEP = 9;
const DOT_TIERS: { r: number; o: number }[] = [
  { r: 1.25, o: 0.55 },
  { r: 1.7, o: 0.5 },
  { r: 2.05, o: 0.65 },
  { r: 2.4, o: 0.8 },
  { r: 2.75, o: 0.9 },
  { r: 3.1, o: 1 },
];
const LABEL_MIN_WIDTH = 520; // shu kenglikdan tor xaritada yorliqlar yashiriladi (px)
const LABEL_SCREEN_PX = 10; // yorliq matnining ekrandagi minimal o'lchami (px)
const LABEL_MAX_UNIT_SCALE = 1.6; // yorliq xarita birligida shundan katta bo'lishi kerak bo'lsa — joy yetmaydi, yashiriladi
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
  zoomable = false,
}: UzbekistanMapProps) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  /** Ma'lumot oynasi joyi: hudud konturining ekrandagi markazi/yuqori/pastki chekkasi (wrap'ga nisbatan) */
  const [tip, setTip] = useState<{ x: number; yTop: number; yBottom: number; below: boolean } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
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

  /* Harakatni kamaytirish sozlamasi — to'lqin/yoy/chizilish animatsiyalari o'chadi */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduceMotion(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  /* Ma'lumot oynasi hudud konturiga bog'lanadi (sichqonchaga emas): hover/zoom/o'lcham o'zgarsa qayta hisoblanadi */
  useEffect(() => {
    if (!hover) {
      setTip(null);
      return;
    }
    const el = pathRefs.current.get(hover);
    const w = wrap.current;
    if (!el || !w) return;
    const r = el.getBoundingClientRect();
    const wr = w.getBoundingClientRect();
    const yTop = r.top - wr.top;
    setTip({ x: r.left - wr.left + r.width / 2, yTop, yBottom: r.bottom - wr.top, below: yTop < 170 });
  }, [hover, view, width, tilt.x, tilt.y]);

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

  const onWrapMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isHero || !wrap.current || e.pointerType === "touch") return;
    const r = wrap.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: px, y: py });
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
    const r = REGION_SHAPES.find((s) => s.slug === selected);
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
  const smallRegions = REGION_SHAPES.filter((r) => REGION_SIZE[r.slug] * pxPerUnit < HIT_MIN_PX);
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
    const markerBoxes = REGION_SHAPES.filter((r) => count(r.slug) > 0).map((r) => ({ slug: r.slug, x: r.cx, y: r.cy, w: 14 / labelK, h: 14 / labelK }));
    const items = REGION_SHAPES.map((r) => {
      const n = count(r.slug);
      const [ox, oy] = LABEL_OFFSET[r.slug] ?? [0, n > 0 ? 20 : 0];
      const label = REGION_BY_SLUG[r.slug]?.short ?? r.name;
      const w = (label.length * 7.4 + (n > 0 ? String(n).length * 8 + 18 : 14)) * s;
      return { slug: r.slug, label, n, cx: r.cx, cy: r.cy, w, h: 22 * s, x: r.cx + ox * s, y: r.cy + oy * s };
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

  /* ---------------- Nuqtali (dot-matrix) uslub ---------------- */
  /** Hudud intensivligi → nuqta darajasi: 0 — neytral, 1..5 — accent (kam → ko'p) */
  const tierOf = (n: number) => (n <= 0 ? 0 : 1 + Math.min(4, Math.floor(Math.pow(n / max, 0.7) * 5 - 1e-9)));
  /** To'lqin manbai: tanlangan hudud, bo'lmasa Toshkent shahri */
  const origin = REGION_SHAPES.find((r) => r.slug === (selected ?? "toshkent-shahri")) ?? REGION_SHAPES[0];
  /** Hero: markazdan asosiy hududlarga oqib turuvchi yoylar (ma'lumot bo'lmasa — yirik shaharlar) */
  const arcs = useMemo(() => {
    if (!isHero) return [];
    const hub = REGION_SHAPES.find((r) => r.slug === "toshkent-shahri") ?? REGION_SHAPES[0];
    const ranked = [...REGION_SHAPES].filter((r) => r.slug !== hub.slug && count(r.slug) > 0).sort((a, b) => count(b.slug) - count(a.slug));
    const fallback = ["samarqand", "buxoro", "fargona", "qoraqalpogiston", "surxondaryo"];
    const targets = (ranked.length >= 3 ? ranked : REGION_SHAPES.filter((r) => fallback.includes(r.slug))).slice(0, 5);
    return targets.map((t) => {
      const mx = (hub.cx + t.cx) / 2;
      const my = (hub.cy + t.cy) / 2;
      const dx = t.cx - hub.cx;
      const dy = t.cy - hub.cy;
      const len = Math.hypot(dx, dy) || 1;
      // Yoy doim "yuqoriga" egiladi (perpendikulyar, manfiy y tomonga)
      let px = -dy / len;
      let py = dx / len;
      if (py > 0) {
        px = -px;
        py = -py;
      }
      const lift = Math.min(160, len * 0.32);
      return { slug: t.slug, d: `M ${hub.cx} ${hub.cy} Q ${mx + px * lift} ${my + py * lift} ${t.cx} ${t.cy}` };
    });
  }, [isHero, stats, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const tipW = 224;
  const tipLeft = tip ? Math.max(0, Math.min(tip.x + 16, (wrap.current?.clientWidth ?? 600) - tipW - 8)) : 0;
  const motion = !reduceMotion;

  return (
    <div
      ref={wrap}
      className={cn("relative select-none", isHero && "[perspective:1400px]", className)}
      onPointerMove={onWrapMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className={cn(isHero && motion && "map-float")}>
        <div
          className={cn("map-enter", isHero && "transition-transform duration-700 ease-out will-change-transform")}
          style={isHero ? { transform: `rotateX(${14 - tilt.y * 6}deg) rotateY(${tilt.x * 7}deg)`, transformStyle: "preserve-3d" } : undefined}
        >
          <svg
            ref={svgRef}
            viewBox={vb}
            className={cn("h-auto w-full", k > 1 ? "overflow-hidden rounded-card" : "overflow-visible", k > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"))}
            style={canZoom ? { touchAction: k > 1 ? "none" : "pan-y" } : undefined}
            onMouseLeave={() => {
              if (touchTip.current) return;
              setHover(null);
              setTip(null);
            }}
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerCancel={onSvgPointerUp}
            aria-label="O'zbekiston hududlari xaritasi"
            aria-describedby={descId}
          >
            <desc id={descId}>
              14 ta hudud. Har bir hudud — tugma: bosilganda yoki Enter tugmasida o'sha hududdagi {unitLabel}lar ro'yxati ochiladi. Strelkalar — qo'shni hudud,
              Esc — tanlovni bekor qilish{canZoom ? ", plyus/minus — masshtab" : ""}. Jami {total} ta.
            </desc>
            <defs>
              {/* Nuqta naqshlari: 0 — neytral, 1..5 — accent (kattaroq va yorqinroq), "hot" — tanlangan / to'lqin */}
              {DOT_TIERS.map((t, i) => (
                <pattern key={i} id={`${uid}-dots-${i}`} width={DOT_STEP} height={DOT_STEP} patternUnits="userSpaceOnUse">
                  <circle cx={DOT_STEP / 2} cy={DOT_STEP / 2} r={t.r} fill={i === 0 ? "var(--map-dot)" : "var(--accent)"} fillOpacity={t.o} />
                </pattern>
              ))}
              <pattern id={`${uid}-dots-hot`} width={DOT_STEP} height={DOT_STEP} patternUnits="userSpaceOnUse">
                <circle cx={DOT_STEP / 2} cy={DOT_STEP / 2} r={3.4} fill="var(--map-dot-hot)" />
              </pattern>
              <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`${uid}-floor`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#000" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
              {/* To'lqin: kengayib boruvchi halqa (markaz shaffof, chekkasi oq) */}
              <radialGradient id={`${uid}-ring`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0" />
                <stop offset="72%" stopColor="#fff" stopOpacity="0" />
                <stop offset="90%" stopColor="#fff" stopOpacity="1" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              {motion && (
                <mask id={`${uid}-wave`} maskUnits="userSpaceOnUse" x={VB.x} y={VB.y} width={VB.w} height={VB.h}>
                  <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="#000" />
                  <circle cx={origin.cx} cy={origin.cy} r={0} fill={`url(#${uid}-ring)`}>
                    <animate attributeName="r" values="0;1200" dur="6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.65;1" dur="6s" repeatCount="indefinite" />
                  </circle>
                </mask>
              )}
              <filter id={`${uid}-lift`} x="-20%" y="-20%" width="140%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="var(--accent)" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Orqa nur va "pol" soyasi (hero) */}
            {isHero && (
              <g aria-hidden="true">
                <ellipse cx={MAP_VIEWBOX.width / 2} cy={MAP_VIEWBOX.height / 2 + 30} rx={560} ry={300} fill={`url(#${uid}-glow)`} />
                <ellipse cx={MAP_VIEWBOX.width / 2} cy={MAP_VIEWBOX.height + 10} rx={440} ry={34} fill={`url(#${uid}-floor)`} />
              </g>
            )}

            {/* Zoom qatlami: barcha xarita qatlamlari bitta transform ostida (k=1 da — identik) */}
            <g
              className={canZoom ? "map-zoom-layer" : undefined}
              data-dragging={dragging || undefined}
              style={canZoom ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0", transformBox: "view-box" } : undefined}
            >
              {/* Hudud "plitasi" — har biri tugma (roving tabindex: Tab bilan bitta hududga kiriladi, strelkalar bilan yuriladi) */}
              <g role="group" aria-label="Hududlar">
                {REGION_SHAPES.map((r) => {
                  const n = count(r.slug);
                  const c = Math.pow(n / max, 0.7);
                  const isSel = selected === r.slug;
                  const isHov = hover === r.slug;
                  const on = isSel || isHov;
                  const fill = on
                    ? "color-mix(in oklab, var(--accent) 24%, var(--map-plate))"
                    : n > 0
                      ? `color-mix(in oklab, var(--accent) calc(3% + ${c.toFixed(3)} * 14%), var(--map-plate))`
                      : "var(--map-plate)";
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
                      strokeWidth={2 / k}
                      strokeLinejoin="round"
                      filter={on ? `url(#${uid}-lift)` : undefined}
                      style={{ fill }}
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

              {/* Nuqtalar: hudud intensivligiga qarab (bosishni o'tkazadi) */}
              <g pointerEvents="none" aria-hidden="true">
                {REGION_SHAPES.map((r) => {
                  const on = selected === r.slug || hover === r.slug;
                  return <path key={r.slug} d={r.d} fill={`url(#${uid}-${on ? "dots-hot" : `dots-${tierOf(count(r.slug))}`})`} className="map-dots" />;
                })}
              </g>

              {/* To'lqin: manbadan butun xarita bo'ylab yuguruvchi yorqin nuqtalar */}
              {motion && (
                <g pointerEvents="none" aria-hidden="true" mask={`url(#${uid}-wave)`} style={{ opacity: "var(--map-wave)" }}>
                  {REGION_SHAPES.map((r) => (
                    <path key={r.slug} d={r.d} fill={`url(#${uid}-dots-hot)`} />
                  ))}
                </g>
              )}

              {/* Chegaralar: sahifa ochilganda chizilib paydo bo'ladi */}
              <g pointerEvents="none" aria-hidden="true">
                {REGION_SHAPES.map((r, i) => (
                  <path
                    key={r.slug}
                    d={r.d}
                    fill="none"
                    stroke="var(--map-edge)"
                    strokeWidth={1.1 / k}
                    strokeLinejoin="round"
                    pathLength={1}
                    className={motion ? "map-draw" : undefined}
                    style={motion ? { animationDelay: `${0.1 + i * 0.07}s` } : undefined}
                  />
                ))}
              </g>

              {/* Klaviatura fokusi konturi — qo'shni hududlar ustida */}
              {kbFocus && <path d={REGION_SHAPES.find((s) => s.slug === kbFocus)?.d} className="region-focus-ring" style={{ strokeWidth: 3.5 / k }} aria-hidden="true" />}

              {/* Yoylar (hero): Toshkentdan asosiy hududlarga oqib turuvchi nur */}
              {arcs.length > 0 && (
                <g pointerEvents="none" aria-hidden="true">
                  {arcs.map((a, i) => (
                    <g key={a.slug}>
                      <path d={a.d} fill="none" stroke="var(--accent)" strokeOpacity={0.22} strokeWidth={1.4} strokeDasharray="2 6" />
                      {motion && (
                        <>
                          <path d={a.d} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" pathLength={1} className="map-arc-flow" style={{ animationDelay: `${i * 0.55}s` }} />
                          <circle r={3.6} fill="var(--accent)" stroke="var(--map-base)" strokeWidth={1.5}>
                            <animateMotion dur={`${3.4 + i * 0.35}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" path={a.d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                          </circle>
                        </>
                      )}
                    </g>
                  ))}
                </g>
              )}

              {/* Markerlar: mutaxassislar bor hududlarda "mayoq" */}
              <g pointerEvents="none" aria-hidden="true">
                {REGION_SHAPES.map((r, i) => {
                  const n = count(r.slug);
                  if (n === 0) return null;
                  const t = n / max;
                  const base = (isHero ? 6 : 4.5) + Math.sqrt(t) * (isHero ? 9 : 6);
                  const isSel = selected === r.slug;
                  const pillW = String(n).length * 10 + 20;
                  return (
                    // Zoom'da marker ekrandagi o'lchamini saqlaydi (1/k)
                    <g key={r.slug} transform={`translate(${r.cx}, ${r.cy})${k > 1 ? ` scale(${(1 / k).toFixed(3)})` : ""}`}>
                      <circle r={base} className="map-pulse" fill="var(--accent)" style={{ animationDelay: `${(i % 5) * 0.45}s` }} />
                      <circle r={base} className="map-pulse" fill="var(--accent)" style={{ animationDelay: `${(i % 5) * 0.45 + 1.2}s` }} />
                      <circle r={base * 0.5} fill={isSel ? "var(--map-base)" : "var(--accent)"} stroke={isSel ? "var(--accent)" : "var(--map-base)"} strokeWidth={2.4} />
                      {isHero && topSlugs.includes(r.slug) && (
                        <g transform={`translate(${(HERO_PILL_OFFSET[r.slug]?.[0] ?? 0) + base + 6}, ${(HERO_PILL_OFFSET[r.slug]?.[1] ?? 0) * 0.6})`} {...hitProps(r.slug)}>
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

              {/* Yorliqlar (panel rejimida, yetarli kenglikda): avval qisqa chiziqlar, ustidan yorliqlar */}
              {labels && (
                <g pointerEvents="none" aria-hidden="true">
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
                    <g key={l.slug} transform={`translate(${l.x}, ${l.y})`} {...hitProps(l.slug)}>
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

      {/* Ma'lumot oynasi — sichqoncha yonida emas, hudud TEPASIDA (xaritani to'smaydi); joy bo'lmasa — pastida */}
      {tip && activeRegion && hover && (
        <div
          className="pointer-events-none absolute z-[12] w-56"
          role="status"
          style={{
            left: Math.max(tipW / 2 + 4, Math.min(tip.x, (wrap.current?.clientWidth ?? 600) - tipW / 2 - 4)),
            top: tip.below ? tip.yBottom + 14 : tip.yTop - 14,
            // Joylashuv transformi alohida elementda — ichki animatsiya (map-tip-in) uni ustidan yozmasin
            transform: tip.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          }}
        >
        <div className={cn("card-floating relative w-56 p-3.5 map-tip-in", tip.below ? "origin-top" : "origin-bottom")}>
          <span
            aria-hidden="true"
            className={cn("absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-line bg-surface", tip.below ? "-top-1.5 border-l border-t" : "-bottom-1.5 border-b border-r")}
          />
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
        </div>
      )}
    </div>
  );
}
