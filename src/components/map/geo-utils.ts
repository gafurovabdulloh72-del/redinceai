import { REGION_SHAPES, type RegionShape } from "./regions-geo";

/**
 * Xarita geometriyasi uchun yordamchilar (regions-geo.ts avtomatik generatsiya qilingan — u yerga qo'lda yozilmaydi):
 * - lonLatToMap: GPS (WGS84) → xarita koordinatasi (equirectangular, cos(o'rta kenglik) tuzatilgan; chegaralar bo'yicha moslangan)
 * - regionAt: nuqta qaysi hudud ichida (even-odd, barcha halqalar)
 * - nearestRegion: markazi eng yaqin hudud (O'zbekistondan tashqarida bo'lsa)
 * - REGION_NEIGHBOURS: klaviatura strelkalari uchun yo'nalish bo'yicha qo'shni (markazlar orasidagi masofa + burchak)
 */

/* O'zbekiston chegaralari (geoBoundaries ADM0) ↔ xarita chetlari (12px ichki chekinish, 1000×662 viewBox) */
const LON_MIN = 55.996;
const LAT_MAX = 45.59;
const PX_PER_LON = 56.96;
const PX_PER_LAT = 75.95;

export function lonLatToMap(lon: number, lat: number) {
  return { x: 12 + (lon - LON_MIN) * PX_PER_LON, y: 12 + (LAT_MAX - lat) * PX_PER_LAT };
}

type Ring = Array<[number, number]>;

function ringsOf(d: string): Ring[] {
  return d
    .split(/[MZ]/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const nums = s.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const ring: Ring = [];
      for (let i = 0; i + 1 < nums.length; i += 2) ring.push([nums[i], nums[i + 1]]);
      return ring;
    })
    .filter((r) => r.length >= 3);
}

const RINGS: Record<string, Ring[]> = Object.fromEntries(REGION_SHAPES.map((r) => [r.slug, ringsOf(r.d)]));

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Tekshirish tartibi (bir marta): nuqtasi kam (kichik) hududlar avval — Toshkent sh. Toshkent vil. ichidagi "teshik" */
const REGION_CHECK_ORDER: RegionShape[] = [...REGION_SHAPES].sort(
  (a, b) => RINGS[a.slug].reduce((n, r) => n + r.length, 0) - RINGS[b.slug].reduce((n, r) => n + r.length, 0),
);

/** Nuqta (xarita koordinatasida) qaysi hudud ichida — topilmasa null */
export function regionAt(x: number, y: number): RegionShape | null {
  for (const r of REGION_CHECK_ORDER) {
    let inside = false;
    for (const ring of RINGS[r.slug]) if (inRing(x, y, ring)) inside = !inside;
    if (inside) return r;
  }
  return null;
}

export function nearestRegion(x: number, y: number): { region: RegionShape; distance: number } {
  let best = REGION_SHAPES[0];
  let bestD = Infinity;
  for (const r of REGION_SHAPES) {
    const d = Math.hypot(r.cx - x, r.cy - y);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return { region: best, distance: bestD };
}

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
const DIRS: Record<ArrowKey, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Chegaradosh hududlar: konturlarda bir-biriga ≤1.5 birlik yaqin nuqtalar bor (bir topologiyadan soddalashtirilgan) */
const ADJACENT: Record<string, Set<string>> = (() => {
  const CELL = 2;
  const grid = new Map<string, Array<{ slug: string; x: number; y: number }>>();
  for (const r of REGION_SHAPES)
    for (const ring of RINGS[r.slug])
      for (const [x, y] of ring) {
        const k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
        const cell = grid.get(k);
        if (cell) cell.push({ slug: r.slug, x, y });
        else grid.set(k, [{ slug: r.slug, x, y }]);
      }
  const adj: Record<string, Set<string>> = Object.fromEntries(REGION_SHAPES.map((r) => [r.slug, new Set<string>()]));
  for (const [k, pts] of grid) {
    const [gx, gy] = k.split(",").map(Number);
    for (let ox = -1; ox <= 1; ox++)
      for (let oy = -1; oy <= 1; oy++) {
        const other = grid.get(`${gx + ox},${gy + oy}`);
        if (!other) continue;
        for (const a of pts)
          for (const b of other)
            if (a.slug !== b.slug && Math.abs(a.x - b.x) <= 1.5 && Math.abs(a.y - b.y) <= 1.5) {
              adj[a.slug].add(b.slug);
              adj[b.slug].add(a.slug);
            }
      }
  }
  return adj;
})();

/**
 * Har bir hudud uchun 4 yo'nalishdagi qo'shni (strelkalar): avval chegaradosh hududlar orasidan —
 * yo'nalish konusida (±72°) "masofa × (1 + burchak jarimasi)" eng kichigi; chegaradosh topilmasa —
 * tor konusdagi (±38°) eng yaqin markaz (≤260 birlik). Hech kim bo'lmasa — o'sha tomonga harakat yo'q.
 */
export const REGION_NEIGHBOURS: Record<string, Partial<Record<ArrowKey, string>>> = Object.fromEntries(
  REGION_SHAPES.map((from) => {
    const out: Partial<Record<ArrowKey, string>> = {};
    const pick = (key: ArrowKey, pool: RegionShape[], minAlong: number, maxDist: number) => {
      const [ux, uy] = DIRS[key];
      let best: string | undefined;
      let bestScore = Infinity;
      for (const to of pool) {
        if (to.slug === from.slug) continue;
        const dx = to.cx - from.cx;
        const dy = to.cy - from.cy;
        const dist = Math.hypot(dx, dy);
        const along = (dx * ux + dy * uy) / dist; // cos(burchak)
        if (along < minAlong || dist > maxDist) continue;
        const score = dist * (1 + 2 * (1 - along));
        if (score < bestScore) {
          bestScore = score;
          best = to.slug;
        }
      }
      return best;
    };
    const adjacent = REGION_SHAPES.filter((r) => ADJACENT[from.slug].has(r.slug));
    for (const key of Object.keys(DIRS) as ArrowKey[]) {
      const best = pick(key, adjacent, 0.3, Infinity) ?? pick(key, REGION_SHAPES, 0.78, 260);
      if (best) out[key] = best;
    }
    return [from.slug, out];
  }),
);

/** Tab tartibi: g'arbdan sharqqa (markaz x bo'yicha) — ekran o'quvchi va Tab uchun mantiqiy ketma-ketlik */
export const REGION_TAB_ORDER: string[] = [...REGION_SHAPES].sort((a, b) => a.cx - b.cx).map((r) => r.slug);
