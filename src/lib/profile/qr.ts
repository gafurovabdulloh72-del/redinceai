/**
 * QR kod generatori — kutubxonasiz (ISO/IEC 18004): Byte rejimi, xatoni tuzatish darajasi M, 1–10 versiyalar
 * (213 baytgacha — qisqa havola / profil manzili uchun yetarli). Natija — SVG satri (yoki modullar matritsasi).
 * Sof funksiya: server (route) va klient (ulashish varaqi) uchun bir xil. Niqob 8 tasidan jarima bo'yicha eng yaxshisi tanlanadi.
 */

const EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // M darajasi, v1..v10
const NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

/* ---------------- GF(256) ---------------- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Reed–Solomon generator ko'phadi (daraja = ec) */
function rsGenerator(ec: number): number[] {
  let g = [1];
  for (let i = 0; i < ec; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}
function rsRemainder(data: number[], gen: number[]): number[] {
  const res = new Array<number>(gen.length - 1).fill(0);
  for (const b of data) {
    const factor = b ^ (res.shift() as number);
    res.push(0);
    for (let i = 0; i < res.length; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

/* ---------------- Sig'im ---------------- */
function rawCodewords(v: number) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (v >= 7) r -= 36;
  }
  return Math.floor(r / 8);
}
function dataCodewords(v: number) {
  return rawCodewords(v) - EC_PER_BLOCK[v - 1] * NUM_BLOCKS[v - 1];
}
function pickVersion(len: number): number | null {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const bits = 4 + (v < 10 ? 8 : 16) + len * 8;
    if (bits <= dataCodewords(v) * 8) return v;
  }
  return null;
}

/* ---------------- Bit oqimi ---------------- */
function encodeBytes(bytes: Uint8Array, v: number): number[] {
  const bits: number[] = [];
  const push = (val: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const cap = dataCodewords(v) * 8;
  push(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  return out;
}

/** Bloklarga bo'lib EC qo'shish va aralashtirish (interleave) */
function withEcc(data: number[], v: number): number[] {
  const blocks = NUM_BLOCKS[v - 1];
  const ec = EC_PER_BLOCK[v - 1];
  const raw = rawCodewords(v);
  const shortBlocks = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const gen = rsGenerator(ec);
  const parts: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const len = shortLen - ec + (i < shortBlocks ? 0 : 1);
    const d = data.slice(k, k + len);
    k += len;
    const block = i < shortBlocks ? [...d, 0] : d; // qisqa blokka vaqtincha bo'sh joy
    parts.push([...block, ...rsRemainder(d, gen)]);
  }
  const out: number[] = [];
  for (let i = 0; i < parts[0].length; i++) {
    parts.forEach((p, j) => {
      if (i !== shortLen - ec || j >= shortBlocks) out.push(p[i]);
    });
  }
  return out;
}

/* ---------------- Matritsa ---------------- */
type Grid = Uint8Array; // 1 = qora
interface Matrix {
  size: number;
  modules: Grid;
  func: Grid;
}

function alignmentPositions(v: number): number[] {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const size = v * 4 + 17;
  const step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

function buildMatrix(v: number): Matrix {
  const size = v * 4 + 17;
  const modules = new Uint8Array(size * size);
  const func = new Uint8Array(size * size);
  const set = (x: number, y: number, dark: boolean) => {
    modules[y * size + x] = dark ? 1 : 0;
    func[y * size + x] = 1;
  };
  // Vaqt chiziqlari
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // Topuvchi naqshlar (+ ajratgich)
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  // Tekislash naqshlari
  const ap = alignmentPositions(v);
  for (let i = 0; i < ap.length; i++)
    for (let j = 0; j < ap.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  // Format va versiya maydonlari band qilinadi (keyin yoziladi)
  for (let i = 0; i < 9; i++) {
    set(i, 8, false);
    set(8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    set(size - 1 - i, 8, false);
    set(8, size - 1 - i, false);
  }
  set(8, size - 8, true); // qora modul
  if (v >= 7)
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, false);
      set(b, a, false);
    }
  return { size, modules, func };
}

function placeData(m: Matrix, codewords: number[]) {
  const { size, modules, func } = m;
  let bit = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        const idx = y * size + x;
        if (func[idx]) continue;
        if (bit < total) {
          modules[idx] = (codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1;
          bit++;
        }
      }
    }
  }
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(m: Matrix, mask: number) {
  const { size, modules, func } = m;
  const f = MASKS[mask];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!func[y * size + x] && f(x, y)) modules[y * size + x] ^= 1;
}

function drawFormat(m: Matrix, mask: number) {
  const { size, modules } = m;
  const data = mask; // M darajasi = 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const get = (i: number) => (bits >>> i) & 1;
  const set = (x: number, y: number, d: number) => {
    modules[y * size + x] = d;
  };
  for (let i = 0; i <= 5; i++) set(8, i, get(i));
  set(8, 7, get(6));
  set(8, 8, get(7));
  set(7, 8, get(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, get(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, get(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, get(i));
  set(8, size - 8, 1);
}

function drawVersion(m: Matrix, v: number) {
  if (v < 7) return;
  const { size, modules } = m;
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (v << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const b = (bits >>> i) & 1;
    const a = size - 11 + (i % 3);
    const c = Math.floor(i / 3);
    modules[c * size + a] = b;
    modules[a * size + c] = b;
  }
}

/** Niqob jarimasi (N1–N4) — eng kam jarimali niqob skanerlash uchun eng qulay */
function penalty(m: Matrix): number {
  const { size, modules } = m;
  const at = (x: number, y: number) => modules[y * size + x];
  let score = 0;
  const runs = (get: (i: number) => number) => {
    let run = 0;
    let prev = -1;
    const hist: number[] = [0, 0, 0, 0, 0, 0, 0];
    const finderLike = () => {
      const n = hist[1];
      const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
      return (core && hist[0] >= n * 4 ? 1 : 0) + (core && hist[6] >= n * 4 ? 1 : 0);
    };
    for (let i = 0; i < size; i++) {
      const c = get(i);
      if (c === prev) run++;
      else {
        if (prev !== -1) {
          hist.shift();
          hist.push(run);
          if (prev === 0) score += finderLike() * 40;
        }
        if (run >= 5 && prev !== -1) score += 3 + (run - 5);
        run = 1;
        prev = c;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
    hist.shift();
    hist.push(run);
    if (prev === 0) score += finderLike() * 40;
  };
  for (let y = 0; y < size; y++) runs((x) => at(x, y));
  for (let x = 0; x < size; x++) runs((y) => at(x, y));
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) score += 3;
    }
  let dark = 0;
  for (const c of modules) dark += c;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

export interface QrMatrix {
  size: number;
  /** modules[y][x] — true = qora */
  get: (x: number, y: number) => boolean;
  version: number;
}

/** Matnni QR matritsasiga aylantiradi; 213 baytdan uzun bo'lsa null */
export function qrEncode(text: string): QrMatrix | null {
  const bytes = new TextEncoder().encode(text);
  const v = pickVersion(bytes.length);
  if (!v) return null;
  const codewords = withEcc(encodeBytes(bytes, v), v);
  let best: Matrix | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(v);
    placeData(m, codewords);
    applyMask(m, mask);
    drawFormat(m, mask);
    drawVersion(m, v);
    const s = penalty(m);
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
  }
  const m = best!;
  return { size: m.size, version: v, get: (x, y) => m.modules[y * m.size + x] === 1 };
}

/**
 * SVG satri: `path` bilan bitta shakl (yengil), 4 modulli "tinch zona", ranglar currentColor / fon.
 * `size` — px (viewBox orqali masshtablanadi); `bg` null bo'lsa fon shaffof.
 */
export function qrSvg(text: string, opts: { size?: number; fg?: string; bg?: string | null; title?: string } = {}): string | null {
  const q = qrEncode(text);
  if (!q) return null;
  const quiet = 4;
  const n = q.size + quiet * 2;
  const px = opts.size ?? 240;
  let d = "";
  for (let y = 0; y < q.size; y++) {
    for (let x = 0; x < q.size; x++) {
      if (q.get(x, y)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const title = opts.title ? `<title>${opts.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>` : "";
  const bg = opts.bg === null ? "" : `<rect width="${n}" height="${n}" fill="${opts.bg ?? "#ffffff"}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img">${title}${bg}<path d="${d}" fill="${opts.fg ?? "#111111"}"/></svg>`;
}
