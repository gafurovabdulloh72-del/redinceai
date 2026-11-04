/**
 * AVTOMATIK RU TARJIMA — klientga xavfsiz yadro (2026-11-04).
 *
 * Maqsad: sayt rus rejimida bo'lsa, lug'atga (tr()) ulanmagan HAR QANDAY o'zbekcha UI matni ham ruscha ko'rinsin —
 * shu jumladan keyinroq qo'shiladigan yangi matnlar. Uch qatlam:
 *  1) `ru-dict.json` — statik lug'at (kod matnlaridan `scripts/i18n-sync.mjs` yig'adi), darhol, API'siz;
 *  2) `ui_translations` jadvali — server keshi (`/api/i18n/avto`);
 *  3) Gemini API — keshda yo'q yangi matn uchun (env GEMINI_API_KEY), natija keshga yoziladi.
 * DOM qatlam (`RuAutoLayer`) matn tugunlarini 1-qatlamdan darhol, 2–3 dan asinxron almashtiradi.
 */
/** Lug'at faqat kerak bo'lganda (rus rejimida) yuklanadi — ~190 KB JSON hamma uchun bundle'ga kirmasin */
let RU_DICT: Record<string, string> = {};
let loading: Promise<void> | null = null;
export function ensureDict(): Promise<void> {
  if (!loading) loading = import("./ru-dict.json").then((m) => {
    RU_DICT = (m.default ?? m) as Record<string, string>;
  });
  return loading;
}

/** Apostrof variantlari va bo'shliqlarni bir xil ko'rinishga keltiradi (lug'at kaliti) */
export function normalizeUz(s: string): string {
  return s.replace(/[‘’ʻʼ`]/g, "'").replace(/\s+/g, " ").trim();
}

/** Matn o'zbekcha UI iborasiga o'xshaydimi (kirill/raqam/URL emas) — AI'ga yuborishdan oldin filtr */
const UZ_HINT = /('[a-z]|\b(va|yoki|uchun|bilan|kun|soat|yo'q|bor|emas|kerak|mumkin|yangi|saqlash|bekor|o'chirish|qo'shish|ko'rish|tanlang|yuklash|xato|hali|faqat|barcha|siz|bu|shu|keyin|hozir|ta|lar|ni|ga|da|dan|ning)\b)/i;
export function looksUzbek(s: string): boolean {
  const t = normalizeUz(s);
  if (t.length < 3 || t.length > 160) return false;
  if (/[а-яё]/i.test(t)) return false;
  if (!/[a-z]/i.test(t)) return false;
  if (/^(https?:|\/|@|#|\+?\d)/.test(t)) return false;
  if (/^[\w.@-]+$/.test(t) && !/'/.test(t)) return false; // bitta so'z: ism/slug/email bo'lishi mumkin
  if (UZ_HINT.test(t)) return true;
  return /[xq]/i.test(t) && !/\d/.test(t); // «Xabar yozing» kabi; «Sony FX3» emas
}

/** Son + birlik/valyuta kabi dinamik satrlar (lug'atga sig'maydi) — naqsh qoidalari */
const UNIT_RULES: Array<[RegExp, string]> = [
  [/^(\d[\d ]*) so'm \/ oy$/, "$1 сум / мес"],
  [/^(\d[\d ]*) ming so'm \/ oy$/, "$1 тыс. сум / мес"],
  [/^(\d[\d ]*) mln so'm \/ oy$/, "$1 млн сум / мес"],
  [/^(\d[\d ]*) so'm$/, "$1 сум"],
  [/^(\d[\d ]*) ming so'm$/, "$1 тыс. сум"],
  [/^(\d[\d ]*) mln so'm$/, "$1 млн сум"],
  [/^(\d[\d ]*) so'm dan$/, "от $1 сум"],
  [/^(\d+) kun$/, "$1 дн."],
  [/^(\d+) kun oldin$/, "$1 дн. назад"],
  [/^(\d+) soat$/, "$1 ч"],
  [/^(\d+) soat oldin$/, "$1 ч назад"],
  [/^(\d+) daqiqa$/, "$1 мин"],
  [/^(\d+) daqiqa oldin$/, "$1 мин назад"],
  [/^(\d+) ta$/, "$1"],
  [/^(\d+) ta (dars|post|ish|izoh|ovoz|obunachi|talaba|kurs|efir|xabar|savol|javob|ko'rish|fayl|a'zo)$/, "$1 $2"],
];
const SHORT: Record<string, string> = { Bor: "Есть", "Yo'q": "Нет", kun: "дн.", soat: "ч", daqiqa: "мин", oy: "мес", yil: "г.", dars: "уроков", post: "постов", ish: "работ", izoh: "комментариев", ovoz: "голосов", obunachi: "подписчиков", talaba: "студентов", kurs: "курсов", efir: "эфиров", xabar: "сообщений", savol: "вопросов", javob: "ответов", "ko'rish": "просмотров", fayl: "файлов", "a'zo": "участников" };
function unitRu(key: string): string | null {
  for (const [re, to] of UNIT_RULES) {
    if (re.test(key)) return key.replace(re, to).replace(/ (dars|post|ish|izoh|ovoz|obunachi|talaba|kurs|efir|xabar|savol|javob|ko'rish|fayl|a'zo)$/, (_, w: string) => " " + SHORT[w]);
  }
  return SHORT[key] ?? null;
}

/** Statik lug'atdan (va lokal keshdan) darhol tarjima; yo'q bo'lsa son/birlik qoidalari; yo'q bo'lsa null */
const memo = new Map<string, string>();
export function lookupRu(s: string): string | null {
  const key = normalizeUz(s);
  return memo.get(key) ?? RU_DICT[key] ?? unitRu(key);
}
export function rememberRu(key: string, ru: string) {
  memo.set(normalizeUz(key), ru);
}
export function dictSize(): number {
  return Object.keys(RU_DICT).length;
}
