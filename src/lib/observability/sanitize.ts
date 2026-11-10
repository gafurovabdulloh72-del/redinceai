/**
 * XATOLAR JURNALI — tozalash (2026-11-10). TOZA modul: hech qanday import yo'q (server, skript va testda bir xil ishlaydi).
 *
 * Nega kerak: xato matni va steki ichida foydalanuvchi ma'lumoti bo'lishi mumkin — Drizzle «Failed query … params: …»
 * (email, telefon, ism), URL so'rov satri (`?token=…`, `?t2=…`), parol tiklash havolasi (token YO'LNING o'zida),
 * `Authorization: Bearer …`. Jurnal admin panelda ko'rinadi va bazada yotadi — shuning uchun yozishdan OLDIN:
 *   · URL/yo'ldan so'rov satri va hash olib tashlanadi;
 *   · JWT, Bearer, bot tokeni, `kalit=qiymat` sirlari va uzun tasodifiy satrlar → `[token]`;
 *   · email → `[email]`, telefon raqami → `[tel]`;
 *   · Drizzle `params: …` dumi butunlay kesiladi.
 * Ortiqcha tozalash (masalan, 13 xonali vaqt belgisi `[tel]` bo'lib qolishi) — ataylab: maxfiylik aniqlikdan ustun.
 */

export const MAX_MESSAGE = 500;
export const MAX_STACK = 4000;
export const MAX_PATH = 300;
export const MAX_UA = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uzun satr «tokenga o'xshaydimi»: tasodifiy (katta+kichik harf+raqam) yoki uzun hex / aralash — so'zli slug emas */
function looksLikeToken(s: string): boolean {
  if (UUID_RE.test(s)) return false; // yozuv identifikatori — sir emas, tuzatishda kerak
  if (/WEBPACK|__/.test(s)) return false; // webpack modul nomlari (stekda)
  const digits = (s.match(/\d/g) ?? []).length;
  const upper = /[A-Z]/.test(s);
  const lower = /[a-z]/.test(s);
  if (s.length >= 32 && /^[0-9a-f]+$/i.test(s) && digits >= 4) return true; // hex (sha256, API kalit)
  if (s.length >= 20 && upper && lower && digits >= 1) return true; // base64url (tiklash tokeni, chipta)
  if (s.length >= 32 && digits >= 4 && s.length - digits >= 4 && !/^[a-z]+(?:-[a-z0-9]+)+$/.test(s)) return true;
  return false;
}

/**
 * Matndan shaxsiy va maxfiy bo'laklarni olib tashlaydi (uzunlikni cheklamaydi — chaqiruvchi kesadi).
 * Yangi qatorlar saqlanadi (stek uchun), boshqa boshqaruv belgilari probelga aylanadi.
 */
export function scrub(input: unknown): string {
  let s = typeof input === "string" ? input : String(input ?? "");
  if (s.length > 20_000) s = s.slice(0, 20_000);
  s = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ");
  // Drizzle: «Failed query: … params: a@b.c,+99890…» — qiymatlar butunlay kesiladi
  s = s.replace(/\bparams:[\s\S]*$/i, "params: [yashirildi]");
  // JWT (sessiya, 2FA chiptasi, media tokeni)
  s = s.replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]{4,})?/g, "[token]");
  // Authorization sarlavhasi
  s = s.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi, "$1 [token]");
  // Telegram bot tokeni: 123456789:AA…
  s = s.replace(/\d{6,}:[A-Za-z0-9_-]{30,}/g, "[token]");
  // URL: so'rov satri va hash (qator:ustun dumi saqlanadi — stek kadri o'qilishi uchun)
  s = s.replace(/(https?:\/\/[^\s"'<>()[\]?#]+)[?#][^\s"'<>()[\]:]*/g, "$1");
  // Nisbiy yo'l: /api/x?token=… → /api/x
  s = s.replace(/(\/[A-Za-z0-9_\-./%@:+~]*)\?[^\s"'<>()[\]]*/g, "$1");
  // kalit=qiymat / kalit: qiymat ko'rinishidagi sirlar
  s = s.replace(
    /\b((?:access|refresh|id|api|auth|csrf|reset|bot|session)?[_-]?(?:token|secret|password|passwd|pwd|signature|otp|apikey|api_key|cookie|authorization|initdata)s?)\b(["']?\s*[=:]\s*)(["']?)(?!\[|Bearer\b|Basic\b)[^\s"'&,;)}\]]{4,}\3/gi,
    "$1$2$3[yashirildi]$3",
  );
  // Email (URL'da kodlangan %40 ham)
  s = s.replace(/[A-Za-z0-9._%+-]+(?:@|%40)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, "[email]");
  // Telefon: 9–15 raqam, orasida probel/chiziqcha/qavs bo'lishi mumkin (+998 90 123-45-67, 998901234567)
  s = s.replace(/(?<![\w.:/#-])\+?\d(?:[\s().-]{0,2}\d){8,14}(?![\w-])/g, "[tel]");
  // Uzun tasodifiy satrlar (tiklash tokeni, API kalit, xesh)
  s = s.replace(/[A-Za-z0-9_-]{20,}/g, (m) => (looksLikeToken(m) ? "[token]" : m));
  return s;
}

/** Bir qatorli, kesilgan xabar */
export function cleanMessage(input: unknown, max = MAX_MESSAGE): string {
  const s = scrub(input).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Stek: qatorlar saqlanadi (har biri ALOHIDA tozalanadi — birinchi qatordagi «params: …» qolgan kadrlarni kesib
 * yubormasin), har qator ≤400 belgi, ≤60 qator, jami `max` belgidan oshmaydi.
 */
export function cleanStack(input: unknown, max = MAX_STACK): string {
  if (typeof input !== "string" || !input.trim()) return "";
  const lines = input
    .slice(0, 40_000)
    .split(/\r?\n/)
    .slice(0, 120)
    .map((l) => scrub(l).replace(/\s+$/g, "").slice(0, 400))
    .filter((l) => l.trim())
    .slice(0, 60);
  const out = lines.join("\n");
  return out.length > max ? out.slice(0, max) : out;
}

/** Stekdan faqat kadr qatorlari (V8 «at …», Firefox/Safari «fn@url:qator:ustun») — xabar sarlavhasi tashlanadi */
export function stackFrames(stack: unknown): string {
  if (typeof stack !== "string") return "";
  return stack
    .split(/\r?\n/)
    .filter((l) => /^\s*at\s/.test(l) || /@.*:\d+(?::\d+)?\s*$/.test(l))
    .join("\n");
}

/** Next/Node ichki kadrlari — xato qayerdaligini ko'rsatmaydi, faqat joy egallaydi */
const INTERNAL_FRAME = /node_modules[\\/]next[\\/]dist|next-app-loader|node:internal|\(node:|next-server[\\/]app-|<anonymous>\)?$/;

/**
 * Server stekini ixchamlash: freymvork ichki kadrlari tashlanadi (hammasi ichki bo'lsa — dastlabki 5 tasi qoladi),
 * `webpack-internal:///(rsc)/` prefiksi va serverdagi mutlaq papka (`root`) olib tashlanadi — `./src/lib/x.ts:12:5`
 * ko'rinishida qoladi (o'qish oson, server papka tuzilishi jurnalga tushmaydi, deploylar orasida guruh buzilmaydi).
 */
export function tidyFrames(frames: string, root?: string): string {
  const lines = frames.split("\n").filter((l) => l.trim());
  const kept = lines.filter((l) => !INTERNAL_FRAME.test(l));
  const base = root ? root.replace(/[\\/]+$/, "") : "";
  return (kept.length ? kept : lines.slice(0, 5))
    .slice(0, 30)
    .map((l) => {
      let s = l.replace(/webpack-internal:\/\/\/(?:\([a-z-]+\)\/)?/g, "");
      if (base) s = s.split(base).join(".");
      return s;
    })
    .join("\n");
}

/**
 * Yo'l (so'rov yoki sahifa): faqat pathname — so'rov satri/hash yo'q; segmentlar ichidagi email, telefon va
 * tokenga o'xshash bo'laklar almashtiriladi (parol tiklash havolasida token YO'LNING o'zida turadi).
 */
export function cleanPath(input: unknown, max = MAX_PATH): string {
  if (typeof input !== "string" || !input) return "";
  let p = input.trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    /* URL emas — xom satr sifatida davom etamiz */
  }
  p = p.replace(/[?#].*$/s, "").replace(/[\u0000-\u001f\u007f\s]+/g, "");
  if (!p.startsWith("/")) p = `/${p}`;
  const parts = p.split("/").map((seg, i, all) => {
    if (!seg) return seg;
    let d = seg;
    try {
      d = decodeURIComponent(seg);
    } catch {
      /* noto'g'ri kodlangan — o'zi */
    }
    // Bir martalik token yo'lda: /auth/parol-tiklash/<token>
    if (i > 0 && /^(parol-tiklash|reset|verify|tasdiqlash)$/i.test(all[i - 1] ?? "") && d.length >= 12) return "[token]";
    if (/(?:@|%40)[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(d)) return "[email]";
    if (/^\+?\d[\d\s().-]{7,}\d$/.test(d) && d.replace(/\D/g, "").length >= 9) return "[tel]";
    if (d.length >= 20 && looksLikeToken(d)) return "[token]";
    return seg.slice(0, 80);
  });
  const out = parts.join("/");
  return out.length > max ? out.slice(0, max) : out;
}

/** User-Agent: bir qator, ≤200 belgi */
export function cleanUserAgent(input: unknown, max = MAX_UA): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

/** Stekning birinchi «o'z» kadri (node_modules/Next ichki kadrlaridan keyingi) — guruhlash kaliti uchun */
export function topFrame(stack: string): string {
  const frames = stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^at\s/.test(l) || /@.*:\d+/.test(l));
  if (!frames.length) return "";
  const own = frames.find((l) => !/node_modules|node:|next[\\/]dist|webpack[\\/]|\(native\)|<anonymous>/.test(l)) ?? frames[0];
  return own
    .replace(/https?:\/\/[^/\s)]+/g, "") // origin (deploylar orasida o'zgarmasin)
    .replace(/webpack-internal:\/\/\/(?:\([a-z-]+\)\/)?/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

/** Guruhlash uchun xabarni normallashtirish: raqamlar va identifikatorlar o'zgaruvchan — bir xil xato bitta guruhda qolsin */
export function normalizeForFingerprint(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "ID")
    .replace(/\b[0-9a-f]{12,}\b/g, "ID")
    .replace(/\d+/g, "0")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Qo'shimcha kontekst: faqat qisqa skalyar qiymatlar, kalit/qiymat tozalangan, ≤12 kalit */
export function cleanExtra(extra: Record<string, unknown> | undefined | null): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!extra || typeof extra !== "object") return out;
  for (const [k, v] of Object.entries(extra).slice(0, 12)) {
    const key = k.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40);
    if (!key || v == null) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else if (typeof v === "string") {
      const s = cleanMessage(v, 300);
      if (s) out[key] = s;
    }
  }
  return out;
}

/** Brauzer kengaytmalari va zararsiz brauzer shovqini — bizning xatomiz emas, jurnalni to'ldirmasin */
const NOISE_SOURCE = /(?:chrome|moz|safari|safari-web|ms-browser|webkit-masked)-(?:extension|url):\/\//i;
const NOISE_MESSAGE = [
  /^script error\.?$/i, // boshqa domen skripti — tafsilot yo'q
  /resizeobserver loop/i,
  /^non-error promise rejection captured/i,
  /^(?:aborterror|the (?:user|operation) (?:was )?aborted)/i,
  /load failed$|^failed to fetch$|^networkerror when attempting to fetch/i, // tarmoq uzilishi — xato emas
  /^cancelled$|^canceled$/i,
];
export function isClientNoise(message: string, stack: string, source?: string | null): boolean {
  if (!message.trim()) return true;
  if (NOISE_SOURCE.test(stack) || NOISE_SOURCE.test(source ?? "") || NOISE_SOURCE.test(message)) return true;
  return NOISE_MESSAGE.some((re) => re.test(message.trim()));
}
