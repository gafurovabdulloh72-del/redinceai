import { CATEGORIES, REGIONS } from "@/lib/constants";
import { PROFESSIONS } from "@/lib/vacancies/format";

/**
 * Yengil fuzzy qidiruv (kamchilik #41): «mantaj» → «montaj», «vidiograf» → «videograf».
 * Tashqi paketsiz — platforma lug'ati (kasblar, hududlar, tez-tez so'raladigan so'zlar)
 * bo'yicha Levenshtein masofasi bilan yozuv xatosi tuzatiladi. Natija bo'sh chiqqanda
 * chaqiriladi; tuzatilgan so'rov foydalanuvchiga «... bo'yicha ko'rsatildi» deb aytiladi.
 */

/** Levenshtein masofasi (bitta qator xotira, erta chiqish uchun max chegara) */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1; // bu qatorda ham chegaradan oshdi — davom etish befoyda
    prev = cur;
  }
  return prev[b.length];
}

const normWord = (s: string) => s.toLowerCase().replace(/[’'ʻ`]/g, "'");

/** Lug'at: kasb nomlari/sluglari, hududlar, vakansiya kasblari + tez-tez ishlatiladigan so'zlar (bir marta quriladi) */
let VOCAB: string[] | null = null;
function vocab(): string[] {
  if (VOCAB) return VOCAB;
  const set = new Set<string>();
  const addWords = (s: string) => {
    for (const w of normWord(s).split(/[^a-z0-9а-яё']+/i)) if (w.length >= 4) set.add(w);
  };
  for (const c of CATEGORIES) {
    addWords(c.name);
    addWords(c.slug.replace(/-/g, " "));
  }
  for (const r of REGIONS) {
    addWords(r.name);
    addWords(r.slug.replace(/-/g, " "));
  }
  for (const p of PROFESSIONS) addWords(p.name);
  for (const w of ["montaj", "montajchi", "videograf", "videografiya", "dizayner", "dizayn", "fotograf", "mentorlik", "vakansiya", "portfolio", "logotip", "banner", "reels", "animatsiya", "kurs", "to'y", "reklama", "intervyu", "podkast"]) set.add(w);
  VOCAB = [...set];
  return VOCAB;
}

/**
 * So'rovdagi har bir so'zni lug'at bilan solishtirib yozuv xatosini tuzatadi.
 * Qisqa so'zlar (<4 belgi) va lug'atda aynan bor so'zlar tegilmaydi; masofa chegarasi:
 * 4-6 belgi — 1, 7+ belgi — 2. Hech narsa o'zgarmasa null.
 */
export function correctQuery(q: string): string | null {
  const words = q.trim().split(/\s+/).slice(0, 8);
  if (!words.length) return null;
  const dict = vocab();
  let changed = false;
  const out = words.map((raw) => {
    const w = normWord(raw);
    if (w.length < 4 || dict.includes(w)) return raw;
    const max = w.length >= 7 ? 2 : 1;
    let best: string | null = null;
    let bestD = max + 1;
    for (const v of dict) {
      const d = editDistance(w, v, max);
      if (d < bestD) {
        bestD = d;
        best = v;
        if (d === 1) break; // yetarlicha yaqin
      }
    }
    if (best && bestD <= max) {
      changed = true;
      return best;
    }
    return raw;
  });
  return changed ? out.join(" ") : null;
}
