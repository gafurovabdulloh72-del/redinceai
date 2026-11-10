/**
 * Chat matni uchun sof yordamchilar (klient va server umumiy, DB'siz):
 *  - `visibleText` / `isBlankBody` — faqat ko'rinmas belgilardan (zero-width, BOM, soft hyphen…) iborat xabarni «bo'sh» deb tanish;
 *  - `splitLinks` — matnni havola / oddiy bo'laklarga ajratish: `https://…`, `www.…` va ma'lum domen zonali yalang'och manzillar
 *    (kasbegalari.uz, t.me/kanal). Soxta moslik bo'lmasin: yalang'och domen faqat TLD oq ro'yxati bo'yicha, email ichidagi domen emas.
 */

/** Ko'rinmas (nol kenglikdagi) belgilar: ZWSP/ZWNJ/ZWJ, LRM/RLM, word joiner, BOM, soft hyphen, mo'g'ul unli ajratgichi, Hangul to'ldirgichlari, yo'nalish belgilari */
const INVISIBLE_RANGES: Array<number | [number, number]> = [0x00ad, 0x034f, 0x061c, 0x115f, 0x1160, 0x17b4, 0x17b5, [0x180b, 0x180e], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f], 0x2800, 0x3164, [0xfe00, 0xfe0f], 0xfeff, 0xffa0];
const hex4 = (n: number) => "\\u" + n.toString(16).padStart(4, "0");
const INVISIBLE_RE = new RegExp(`[${INVISIBLE_RANGES.map((c) => (Array.isArray(c) ? `${hex4(c[0])}-${hex4(c[1])}` : hex4(c))).join("")}]`, "g");

/** Matndan ko'rinmas belgilar olib tashlangan ko'rinishi (faqat TEKSHIRUV uchun — saqlanadigan matn o'zgarmaydi: emoji ZWJ ketma-ketliklari buzilmasin) */
export function visibleText(s: string): string {
  return s.replace(INVISIBLE_RE, "").trim();
}

/** Xabar matni amalda bo'shmi (bo'shliq yoki faqat ko'rinmas belgilar) */
export function isBlankBody(s: string | null | undefined): boolean {
  return !s || visibleText(s).length === 0;
}

/**
 * Saqlashdan oldin matnni tozalash: faqat ko'rinmas belgilardan iborat bo'lsa — bo'sh satr (xabar «bo'sh pufakcha» bo'lib chiqmasin),
 * aks holda matn o'zgarmaydi (ichidagi ZWJ/variatsiya belgilari emoji uchun kerak).
 */
export function cleanBody(s: string): string {
  return isBlankBody(s) ? "" : s;
}

/** Yalang'och domen uchun ruxsatli zonalar (eng ko'p uchraydiganlari) — `fayl.txt`, `salom.dunyo` kabi so'zlar havola bo'lib qolmasin */
const TLDS = "uz|com|ru|org|net|io|me|app|dev|tv|co|info|biz|kz|kg|tj|tm|az|by|ua|su|pro|site|online|store|shop|tech|ai|cc|ly|gg|edu|gov|xyz|link|page|studio|agency|design|media|video|art|blog|club|live|team|news|uk|fr|tr|cn";
/**
 * 1) sxemali havola; 2) `www.` bilan; 3) yalang'och domen (+ixtiyoriy yo'l). Oldida harf/raqam/@/nuqta/slash bo'lmasin
 * (email `ism@domen.uz` va `a.b.c` ichidan parcha olinmasin). Oxirgi tinish belgilari `trimTail` bilan kesiladi.
 */
const LINK_RE = new RegExp(
  `(https?:\\/\\/[^\\s<>"']+|(?<![\\p{L}\\p{N}@./_-])www\\.[^\\s<>"']+|(?<![\\p{L}\\p{N}@./_-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLDS})(?![\\p{L}\\p{N}_'ʻʼ’\\u2018-])(?:[/?#][^\\s<>"']*)?)`,
  "giu",
);
const TAIL_RE = /[.,;:!?…»”"')\]]+$/;

export interface TextPart {
  /** Ko'rinadigan matn */
  text: string;
  /** Havola bo'lsa — to'liq manzil (sxema bilan); oddiy matn uchun undefined */
  href?: string;
}

/** Havola oxiridagi tinish belgilarini ajratish; ochuvchi qavsi bor manzilda yopuvchi qavs saqlanadi (vikipediya uslubi) */
function trimTail(raw: string): [string, string] {
  let url = raw.replace(TAIL_RE, "");
  const opens = (url.match(/\(/g) ?? []).length;
  const closes = (url.match(/\)/g) ?? []).length;
  if (raw.length > url.length && raw[url.length] === ")" && opens > closes) url = raw.slice(0, url.length + 1);
  return [url, raw.slice(url.length)];
}

/** Matnni bo'laklarga ajratish: havolalar `href` bilan (faqat http/https — boshqa sxema hech qachon chiqmaydi) */
export function splitLinks(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const idx = m.index ?? 0;
    const [url, tail] = trimTail(m[0]);
    if (!url) continue;
    if (idx > last) out.push({ text: text.slice(last, idx) });
    out.push({ text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = idx + url.length;
    void tail;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Matndagi birinchi havola (havola kartasi uchun) yoki null */
export function firstLink(text: string): string | null {
  return splitLinks(text).find((p) => p.href)?.href ?? null;
}
