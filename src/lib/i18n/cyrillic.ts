/**
 * O'zbek lotin → kirill transliteratsiyasi (yoshi kattalar uchun «Ўзбекча»).
 * Butun saytga avtomatik qo'llanadi (CyrillicLayer DOM matnini aylantiradi) — lug'at kerak emas,
 * yangi qo'shilgan har qanday matn (UI + foydalanuvchi kontenti) o'z-o'zidan kirillga o'tadi.
 * 100% ilmiy aniq emas (e/э, ц kabi nozik holatlar), lekin o'qish uchun yetarli.
 */

// Ko'p harfli (digraf) birikmalar — AVVAL tekshiriladi (uzunroq birinchi)
const DIGRAPHS: Array<[string, string]> = [
  ["o‘", "ў"], ["o'", "ў"], ["oʻ", "ў"], ["oʼ", "ў"],
  ["g‘", "ғ"], ["g'", "ғ"], ["gʻ", "ғ"], ["gʼ", "ғ"],
  ["sh", "ш"], ["ch", "ч"],
  ["yo", "ё"], ["yu", "ю"], ["ya", "я"], ["ye", "е"], ["ts", "ц"],
];

const SINGLE: Record<string, string> = {
  a: "а", b: "б", c: "с", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т",
  u: "у", v: "в", w: "в", x: "х", y: "й", z: "з",
};

/** Lotincha segment katta/kichikligini kirill natijaga ko'chiradi */
function applyCase(src: string, out: string): string {
  if (src.length >= 2 && src === src.toUpperCase() && src !== src.toLowerCase()) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

const LATIN_RE = /[a-zA-Z‘’'ʻʼ]/;

/** Bitta satrni kirillga aylantiradi */
export function toCyrillic(text: string): string {
  if (!text || !LATIN_RE.test(text)) return text;
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    // Digraf (2 belgigача) — katta/kichik aralash bo'lsa ham
    let matched = false;
    for (const [lat, cyr] of DIGRAPHS) {
      const seg = text.slice(i, i + lat.length);
      if (seg.toLowerCase() === lat.toLowerCase()) {
        out += applyCase(seg, cyr);
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const lower = ch.toLowerCase();
    const map = SINGLE[lower];
    if (map) {
      out += applyCase(ch, map);
      i += 1;
      continue;
    }
    // Tutuq belgisi (so'z ichida) → ъ; aks holda o'zgarmaydi
    if ((ch === "'" || ch === "’" || ch === "ʼ" || ch === "ʻ" || ch === "‘") && i > 0 && i < n - 1 && LATIN_RE.test(text[i - 1])) {
      out += "ъ";
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}
