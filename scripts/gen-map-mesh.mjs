#!/usr/bin/env node
/**
 * Xarita uchun "neon tarmoq" (low-poly) to'rini oldindan hisoblaydi:
 * hudud chegaralari bo'ylab va ichida tugunlar → Delaunay uchburchaklash → faqat O'zbekiston ichidagi qirralar.
 * Natija: src/components/map/map-mesh.ts (deterministik — har safar bir xil).
 *
 *   node scripts/gen-map-mesh.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/components/map/regions-geo.ts"), "utf8");

const BOUNDARY_STEP = 44; // chegara bo'ylab tugunlar oralig'i
const INTERIOR_STEP = 66; // ichki to'r qadami
const MIN_GAP = 24; // tugunlar orasidagi eng kichik masofa
const MAX_EDGE = 120; // shundan uzun qirralar olib tashlanadi

/* ---------------- Ma'lumot ---------------- */
const regions = [];
const re = /slug: "([^"]+)"[\s\S]*?cx: ([\d.]+), cy: ([\d.]+),\s*d: "([^"]+)"/g;
for (let m; (m = re.exec(src)); ) {
  const rings = m[4]
    .split("M")
    .map((p) => (p.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number))
    .filter((r) => r.length >= 6);
  regions.push({ slug: m[1], cx: +m[2], cy: +m[3], rings });
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20241015);

function inside(rings, x, y) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
function edgeDist(rings, x, y) {
  let best = Infinity;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const ax = r[j], ay = r[j + 1], vx = r[i] - ax, vy = r[i + 1] - ay;
      const l = vx * vx + vy * vy;
      const t = l ? Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / l)) : 0;
      best = Math.min(best, (ax + t * vx - x) ** 2 + (ay + t * vy - y) ** 2);
    }
  }
  return Math.sqrt(best);
}
const regionAt = (x, y) => regions.find((r) => inside(r.rings, x, y));
const inUnion = (x, y) => Boolean(regionAt(x, y));
const bbox = (rings) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) {
    minX = Math.min(minX, r[i]); maxX = Math.max(maxX, r[i]);
    minY = Math.min(minY, r[i + 1]); maxY = Math.max(maxY, r[i + 1]);
  }
  return { minX, maxX, minY, maxY };
};

/* ---------------- Hudud markazi (pin joyi) ---------------- */
const anchors = {};
for (const r of regions) {
  const b = bbox(r.rings);
  const size = Math.min(b.maxX - b.minX, b.maxY - b.minY);
  let ax = r.cx, ay = r.cy;
  if (!inside(r.rings, ax, ay) || edgeDist(r.rings, ax, ay) < Math.min(6, size * 0.2)) {
    let best = -1;
    for (let gy = 1; gy < 30; gy++) for (let gx = 1; gx < 30; gx++) {
      const x = b.minX + ((b.maxX - b.minX) * gx) / 30, y = b.minY + ((b.maxY - b.minY) * gy) / 30;
      if (!inside(r.rings, x, y)) continue;
      const d = edgeDist(r.rings, x, y);
      if (d > best) { best = d; ax = x; ay = y; }
    }
  }
  anchors[r.slug] = { x: Math.round(ax * 10) / 10, y: Math.round(ay * 10) / 10 };
}

/* ---------------- Tugunlar ---------------- */
const pts = []; // [x, y, kind] kind: 2 markaz, 1 chegara, 0 ichki
const near = (x, y, d) => pts.some((p) => (p[0] - x) ** 2 + (p[1] - y) ** 2 < d * d);
for (const r of regions) pts.push([anchors[r.slug].x, anchors[r.slug].y, 2]);
for (const r of regions) {
  for (const ring of r.rings) {
    // Perimetr bo'ylab teng qadamda (o'tkir burilishlar ham saqlanadi)
    let acc = BOUNDARY_STEP * 0.5;
    for (let i = 0; i < ring.length; i += 2) {
      const j = (i + 2) % ring.length;
      const ax = ring[i], ay = ring[i + 1], bx = ring[j], by = ring[j + 1];
      const seg = Math.hypot(bx - ax, by - ay);
      let t = 0;
      while (acc + (seg - t) >= BOUNDARY_STEP) {
        t += BOUNDARY_STEP - acc;
        acc = 0;
        const x = ax + ((bx - ax) * t) / seg, y = ay + ((by - ay) * t) / seg;
        if (!near(x, y, MIN_GAP * 0.75)) pts.push([x, y, 1]);
      }
      acc += seg - t;
    }
  }
}
const all = bbox(regions.flatMap((r) => r.rings));
for (let y = all.minY + INTERIOR_STEP / 2; y < all.maxY; y += INTERIOR_STEP * 0.87) {
  const row = Math.round((y - all.minY) / (INTERIOR_STEP * 0.87));
  for (let x = all.minX + (row % 2 ? INTERIOR_STEP / 2 : 0); x < all.maxX; x += INTERIOR_STEP) {
    const jx = x + (rand() - 0.5) * INTERIOR_STEP * 0.55, jy = y + (rand() - 0.5) * INTERIOR_STEP * 0.55;
    const r = regionAt(jx, jy);
    if (!r || edgeDist(r.rings, jx, jy) < MIN_GAP * 0.7 || near(jx, jy, MIN_GAP * 1.4)) continue;
    pts.push([jx, jy, 0]);
  }
}

/* ---------------- Delaunay (Bowyer–Watson) ---------------- */
function circum(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const a2 = a[0] ** 2 + a[1] ** 2, b2 = b[0] ** 2 + b[1] ** 2, c2 = c[0] ** 2 + c[1] ** 2;
  const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { x, y, r2: (a[0] - x) ** 2 + (a[1] - y) ** 2 };
}
const P = pts.map((p) => [p[0], p[1]]);
const n = P.length;
P.push([-5000, -5000], [5000, -5000], [0, 5000]);
let tris = [[n, n + 1, n + 2]].map((t) => ({ t, c: circum(P[t[0]], P[t[1]], P[t[2]]) }));
for (let i = 0; i < n; i++) {
  const [x, y] = P[i];
  const bad = [], keep = [];
  for (const tr of tris) ((x - tr.c.x) ** 2 + (y - tr.c.y) ** 2 < tr.c.r2 ? bad : keep).push(tr);
  const edges = new Map();
  for (const { t } of bad) {
    for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(k, edges.has(k) ? null : [a, b]);
    }
  }
  tris = keep;
  for (const e of edges.values()) if (e) tris.push({ t: [e[0], e[1], i], c: circum(P[e[0]], P[e[1]], P[i]) });
}

/* ---------------- Faqat O'zbekiston ichidagi qirralar ---------------- */
const edgeSet = new Map();
for (const { t } of tris) {
  if (t.some((v) => v >= n)) continue;
  const [a, b, c] = t.map((v) => P[v]);
  const gx = (a[0] + b[0] + c[0]) / 3, gy = (a[1] + b[1] + c[1]) / 3;
  if (!inUnion(gx, gy)) continue;
  const pairs = [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]];
  if (pairs.some(([u, v]) => Math.hypot(P[u][0] - P[v][0], P[u][1] - P[v][1]) > MAX_EDGE)) continue;
  for (const [u, v] of pairs) {
    const mx = (P[u][0] + P[v][0]) / 2, my = (P[u][1] + P[v][1]) / 2;
    // Qirra o'rtasi chegaradan tashqarida bo'lsa (botiq joy) — chizilmaydi; chegaraga juda yaqin bo'lsa ham — u chegara chizig'ining o'zi
    const r = regionAt(mx, my);
    if (!r) continue;
    const k = u < v ? `${u},${v}` : `${v},${u}`;
    if (!edgeSet.has(k)) edgeSet.set(k, { u, v, slug: r.slug });
  }
}

const f = (v) => Math.round(v);
const bySlug = {};
for (const { u, v, slug } of edgeSet.values()) {
  (bySlug[slug] ??= []).push(`M${f(P[u][0])} ${f(P[u][1])}L${f(P[v][0])} ${f(P[v][1])}`);
}
const used = new Set([...edgeSet.values()].flatMap((e) => [e.u, e.v]));
const nodes = pts.map((p, i) => [f(p[0]), f(p[1]), p[2], i]).filter((p) => used.has(p[3]) || p[2] === 2).map(([x, y, k]) => [x, y, k]);

const out = `// AUTO-GENERATED by scripts/gen-map-mesh.mjs — qo'lda tahrirlamang.
// Neon tarmoq: ${nodes.length} tugun, ${edgeSet.size} qirra.

/** Hudud markazi — pin uchi shu nuqtada (hudud ichida, chetdan uzoqroq) */
export const MAP_ANCHORS: Record<string, { x: number; y: number }> = ${JSON.stringify(anchors)};

/** Tugunlar: [x, y, tur] — 2: hudud markazi, 1: chegara, 0: ichki */
export const MESH_NODES: readonly (readonly [number, number, 0 | 1 | 2])[] = ${JSON.stringify(nodes)};

/** Har hudud ichidagi qirralar (bitta path) */
export const MESH_EDGES: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(bySlug).map(([k, v]) => [k, v.join("")])))};
`;
writeFileSync(join(root, "src/components/map/map-mesh.ts"), out);
console.log(`map-mesh.ts: ${nodes.length} tugun, ${edgeSet.size} qirra, ${out.length} bayt`);
