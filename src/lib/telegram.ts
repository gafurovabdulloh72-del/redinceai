import "server-only";
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { base64url } from "jose";

/**
 * Telegram bot integratsiyasi: hisobni ulash (deep-link kodi) va bildirishnoma yuborish.
 *
 * TELEGRAM_BOT_TOKEN bo'lmasa butun integratsiya jimgina o'chiq — isTelegramEnabled() false,
 * sendTelegram() hech narsa qilmaydi, kabinetdagi karta chiqmaydi (hech qayerda xato yo'q).
 */

/** Ulash kodi amal qilish muddati — 15 daqiqa */
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
/**
 * Imzo uzunligi (base64url, 132 bit). To'liq jose JWT ishlatilmaydi, chunki Telegram deep-link
 * (`t.me/bot?start=<kod>`) ko'pi bilan 64 ta [A-Za-z0-9_-] belgini qabul qiladi — JWT sig'maydi.
 * Shuning uchun ixcham format: marker(1) + exp(8, base36 soniya) + userId(base64url) + HMAC(22).
 */
const SIG_LEN = 22;
/** Deep-link payload chegarasi (Telegram hujjati) */
const MAX_CODE_LEN = 64;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Telegram xabari matn chegarasi */
const MAX_TEXT_LEN = 4096;
/** Rasm izohi chegarasi */
const MAX_CAPTION_LEN = 1024;

/** Oddiy matnni qirqish: surrogat juftligi (emoji) o'rtasidan kesilmaydi (`.slice()` yarim emoji qoldirishi mumkin) */
export function cutPlain(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = max;
  const c = s.charCodeAt(end - 1);
  if (c >= 0xd800 && c <= 0xdbff) end--;
  return s.slice(0, end);
}

/**
 * HTML matnni xavfsiz qirqish: surrogat juftligi (emoji) o'rtasidan, HTML teg yoki `&amp;` kabi belgi ichidan kesilmaydi —
 * aks holda Telegram matnni rad etadi («can't parse entities» yoki noto'g'ri UTF-8).
 */
export function cutText(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = cutPlain(s, max);
  // Yopilmagan HTML teg (`<b`) yoki belgi (`&am`) qolgan bo'lsa — o'shandan oldin kesamiz
  const lt = out.lastIndexOf("<");
  if (lt > out.lastIndexOf(">")) out = out.slice(0, lt);
  const amp = out.lastIndexOf("&");
  if (amp >= 0 && amp > out.length - 8 && out.indexOf(";", amp) < 0) out = out.slice(0, amp);
  return out;
}

/** Yolg'iz surrogatlarni olib tashlash (foydalanuvchi matni `.slice()` bilan kesilganda emoji yarmi qolishi mumkin) */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const wellFormed = (s: string): string => s.replace(LONE_SURROGATE, "");

/** HTML'ni oddiy matnga (parse xatosida zaxira yuborish uchun) */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

export function isTelegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/** Bot username (@siz) — deep-link uchun. Sozlanmagan bo'lsa null */
export function telegramBotUsername(): string | null {
  const u = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return u || null;
}

/** HTML parse_mode uchun maxsus belgilarni ekranlash (title/body foydalanuvchi matni bo'lishi mumkin) */
export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TELEGRAM_API = "https://api.telegram.org";
let apiBaseWarned = false;

/**
 * Bot API manzili — faqat testlarda soxta server bilan almashtiriladi (TELEGRAM_API_BASE).
 * Xavfsizlik: har so'rovda URL ichida BOT TOKENI ketadi — noto'g'ri sozlangan env tokenni begona serverga
 * oqizmasligi uchun faqat rasmiy `https://api.telegram.org` yoki loopback (127.0.0.1/localhost — CI va lokal
 * soxta server) qabul qilinadi; boshqasi e'tiborsiz qoldirilib, rasmiy manzil ishlatiladi.
 */
export function telegramApiBase(raw = process.env.TELEGRAM_API_BASE): string {
  const v = raw?.trim();
  if (!v) return TELEGRAM_API;
  try {
    const u = new URL(v);
    const loopback = (u.protocol === "http:" || u.protocol === "https:") && (u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]");
    const official = u.protocol === "https:" && u.hostname === "api.telegram.org";
    if ((loopback || official) && !u.username && !u.password) return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    /* noto'g'ri URL */
  }
  if (!apiBaseWarned) {
    apiBaseWarned = true;
    console.error("[telegram] TELEGRAM_API_BASE rad etildi (faqat api.telegram.org yoki loopback) — rasmiy manzil ishlatiladi");
  }
  return TELEGRAM_API;
}
function apiBase(): string {
  return telegramApiBase();
}

/** Inline tugma: `url` — havola, `data` — callback_data (webhook callback_query'da qaytadi, ≤64 bayt) */
export interface TelegramButton {
  text: string;
  url?: string;
  data?: string;
  /** Mini App havolasi (faqat https) — Telegram ichida ochiladi */
  webApp?: string;
  /**
   * Inline ulashish: bosilganda Telegram chat tanlash oynasini ochadi va xabar maydoniga `@bot <matn>` ni o'zi yozib qo'yadi.
   * Telegram `@` dan keyin faqat ILGARI ishlatilgan inline botlarni taklif qiladi — birinchi marta shu tugma eng oson yo'l.
   */
  switchInline?: string;
}
/** Doimiy klaviatura tugmasi: matn yoki Mini App ochadigan tugma */
export type ReplyButton = string | { text: string; webApp: string } | { text: string; requestContact: true };

/**
 * Bot API sendMessage (HTML, havola preview'siz). Hech qachon throw qilmaydi —
 * tarmoq/API xatosi console.error bilan yutiladi, false qaytadi (bildirishnoma oqimi buzilmasin).
 * `button` — xabar ostida bitta havola tugmasi; `keyboard` — bir nechta qator (url yoki callback tugmalari);
 * `replyKeyboard` — doimiy menyu (bot UI: lib/telegram-bot/ui.ts).
 */
export interface SendOpts {
  /** Xabar ostida bitta havola tugmasi */
  button?: { text: string; url: string };
  /** Inline tugmalar (qatorlar) */
  keyboard?: TelegramButton[][];
  /** Doimiy (reply) klaviatura — matn tugmalari; chat ostida turadi, bosilsa matn sifatida keladi */
  replyKeyboard?: ReplyButton[][];
  /** Doimiy klaviaturani olib tashlash */
  removeKeyboard?: boolean;
  /** replyKeyboard bir marta ishlatilgach yig'iladi (savol-javob qadamlari uchun) */
  oneTime?: boolean;
  /** Javob maydonini ochish (ForceReply) — foydalanuvchining keyingi xabari shu xabarga javob bo'lib keladi; matn — maydon ishorasi */
  forceReply?: string | true;
  /**
   * Ommaviy yuborish (bildirishnoma, e'lon, jamlama, admin ogohlantirishi): navbatda suhbat javoblaridan KEYIN turadi,
   * 429'da uzoqroq kutadi va «yetib bo'lmaydigan» (botni bloklagan) chatga umuman urinmaydi.
   */
  bulk?: boolean;
}

/** `reply_markup` — inline / doimiy klaviatura / olib tashlash (bittasi) */
export function replyMarkup(opts: SendOpts): Record<string, unknown> | null {
  const keyboard: TelegramButton[][] | null = opts.keyboard ?? (opts.button ? [[{ text: opts.button.text, url: opts.button.url }]] : null);
  if (keyboard)
    return {
      inline_keyboard: keyboard.map((row) =>
        row.map((b) =>
          b.webApp
            ? { text: wellFormed(b.text), web_app: { url: b.webApp } }
            : b.url
              ? { text: wellFormed(b.text), url: b.url }
              : b.switchInline !== undefined
                ? { text: wellFormed(b.text), switch_inline_query: b.switchInline }
                : { text: wellFormed(b.text), callback_data: b.data ?? "noop" },
        ),
      ),
    };
  if (opts.replyKeyboard)
    return {
      keyboard: opts.replyKeyboard.map((row) => row.map((b) => (typeof b === "string" ? { text: b } : "requestContact" in b ? { text: b.text, request_contact: true } : { text: b.text, web_app: { url: b.webApp } }))),
      resize_keyboard: true,
      ...(opts.oneTime ? { one_time_keyboard: true } : { is_persistent: true }),
    };
  if (opts.removeKeyboard) return { remove_keyboard: true };
  if (opts.forceReply) return { force_reply: true, ...(typeof opts.forceReply === "string" ? { input_field_placeholder: cutText(opts.forceReply, 64) } : {}) };
  return null;
}

/* ------------------------------------------------------------------ */
/* Yuborish navbati: ~25 xabar/s, 429 `retry_after`, bloklagan chatlar  */
/* ------------------------------------------------------------------ */

/**
 * Telegram bir botdan soniyasiga ~30 xabardan ortig'ini 429 bilan qaytaradi. Barcha yuborishlar BITTA navbatdan o'tadi:
 * har 40 ms da bitta ruxsat (≈25/s). Ikki qator: suhbat javoblari (ustun) va ommaviy (`bulk`) — katta e'lon ketayotganda
 * ham foydalanuvchiga javob kechikmaydi. 429 kelsa butun navbat `retry_after` soniyaga to'xtaydi va xabar QAYTA yuboriladi.
 * Jarayon bo'yicha bitta (dev'da modul qayta yuklanadi — globalThis'da).
 */
const SEND_GAP_MS = 40;
interface Pacer {
  high: (() => void)[];
  low: (() => void)[];
  nextAt: number;
  pausedUntil: number;
  timer: ReturnType<typeof setTimeout> | null;
}
const pacerFlag = globalThis as { __redinceTgPacer?: Pacer };
const pacer = (): Pacer => (pacerFlag.__redinceTgPacer ??= { high: [], low: [], nextAt: 0, pausedUntil: 0, timer: null });

function pump(): void {
  const p = pacer();
  if (p.timer) return;
  const step = () => {
    p.timer = null;
    const now = Date.now();
    const at = Math.max(p.nextAt, p.pausedUntil);
    if (at > now) {
      p.timer = setTimeout(step, at - now);
      return;
    }
    const next = p.high.shift() ?? p.low.shift();
    if (!next) return;
    p.nextAt = now + SEND_GAP_MS;
    next();
    if (p.high.length || p.low.length) p.timer = setTimeout(step, SEND_GAP_MS);
  };
  step();
}

/** Navbatdan ruxsat olish (o'z vaqti kelganda hal bo'ladi) */
function acquireSendSlot(bulk: boolean): Promise<void> {
  return new Promise((resolve) => {
    const p = pacer();
    (bulk ? p.low : p.high).push(resolve);
    pump();
  });
}

/** 429: butun navbatni `ms` ga to'xtatish */
function pauseSends(ms: number): void {
  const p = pacer();
  p.pausedUntil = Math.max(p.pausedUntil, Date.now() + ms);
}

/** Navbat holati (admin diagnostikasi va testlar uchun) */
export function sendQueueStats(): { waiting: number; pausedMs: number } {
  const p = pacer();
  return { waiting: p.high.length + p.low.length, pausedMs: Math.max(0, p.pausedUntil - Date.now()) };
}

export interface SendResult {
  ok: boolean;
  /** HTTP holati (tarmoq xatosida yo'q) */
  status?: number;
  description?: string;
  /** Chat yetib bo'lmaydigan: foydalanuvchi botni bloklagan / o'chirilgan / chat topilmadi */
  blocked?: boolean;
  messageId?: number;
}

/** 403 va «chat not found» — bu chatga yozib bo'lmaydi (qayta urinish befoyda) */
const isBlockedError = (status: number, description: string): boolean =>
  status === 403 || (status === 400 && /chat not found|user is deactivated|PEER_ID_INVALID/i.test(description));

async function callSend(method: "sendMessage" | "sendPhoto", body: Record<string, unknown>, bulk = false): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "token yo'q" };
  const chatId = String(body.chat_id ?? "");
  // Ommaviy yuborishda botni bloklagan chatga umuman urinmaymiz (har e'londa 403 yig'ilmasin) — lib/telegram-bot/reach.ts
  if (bulk && chatId) {
    const { isUnreachable } = await import("@/lib/telegram-bot/reach");
    if (await isUnreachable(chatId)) return { ok: false, blocked: true, description: "chat yetib bo'lmaydigan deb belgilangan" };
  }
  const maxAttempts = bulk ? 5 : 2;
  let payload = body;
  let triedPlain = false;
  for (let attempt = 1; ; attempt++) {
    await acquireSendSlot(bulk);
    try {
      const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; description?: string; parameters?: { retry_after?: number }; result?: { message_id?: number } } | null;
      if (res.ok && j?.ok !== false) return { ok: true, status: res.status, messageId: typeof j?.result?.message_id === "number" ? j.result.message_id : undefined };
      const description = String(j?.description ?? "").slice(0, 300);
      if (res.status === 429) {
        // Telegram aytgan muddatga butun navbat to'xtaydi; suhbat javobi faqat qisqa kutishni ko'taradi
        const retry = Math.min(120, Math.max(1, Number(j?.parameters?.retry_after) || 1));
        pauseSends(retry * 1000 + 200);
        if (attempt < maxAttempts && (bulk || retry <= 5)) continue;
        console.error(`[telegram] ${method} 429 — ${attempt} urinishdan keyin tashlab yuborildi (retry_after ${retry}s)`);
        return { ok: false, status: 429, description };
      }
      if (isBlockedError(res.status, description)) {
        if (chatId) {
          const { markUnreachable } = await import("@/lib/telegram-bot/reach");
          await markUnreachable(chatId, description).catch(() => undefined);
        }
        return { ok: false, status: res.status, description, blocked: true };
      }
      // Buzilgan HTML (kesilgan teg va h.k.) — xabar yo'qolmasin: bir marta oddiy matn bilan qayta yuboramiz
      if (res.status === 400 && /parse entities|unsupported start tag|can't find end/i.test(description) && !triedPlain) {
        triedPlain = true;
        const { parse_mode: _drop, ...rest } = payload;
        void _drop;
        payload = { ...rest, ...(typeof rest.text === "string" ? { text: plainText(rest.text) } : {}), ...(typeof rest.caption === "string" ? { caption: plainText(rest.caption) } : {}) };
        continue;
      }
      console.error(`[telegram] ${method}`, res.status, description);
      return { ok: false, status: res.status, description };
    } catch (e) {
      console.error(`[telegram] ${method}`, e instanceof Error ? e.message : e);
      return { ok: false, description: e instanceof Error ? e.message : "tarmoq xatosi" };
    }
  }
}

/** sendMessage — to'liq natija bilan (yetkazildi / bloklangan / xato). Hech qachon throw qilmaydi */
export async function sendTelegramEx(chatId: string, text: string, opts: SendOpts = {}): Promise<SendResult> {
  if (!chatId || !text) return { ok: false, description: "bo'sh" };
  const markup = replyMarkup(opts);
  return callSend(
    "sendMessage",
    {
      chat_id: chatId,
      text: cutText(wellFormed(text), MAX_TEXT_LEN),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(markup ? { reply_markup: markup } : {}),
    },
    Boolean(opts.bulk),
  );
}

export async function sendTelegram(chatId: string, text: string, opts: SendOpts = {}): Promise<boolean> {
  return (await sendTelegramEx(chatId, text, opts)).ok;
}

/** Rasm + izoh (HTML, ≤1024 belgi). Rasm yuborilmasa (masalan, lokal manzil) oddiy matn bilan davom etadi */
export async function sendTelegramPhoto(chatId: string, photoUrl: string, caption: string, opts: SendOpts = {}): Promise<boolean> {
  if (!chatId) return false;
  const markup = replyMarkup(opts);
  const photo = await callSend(
    "sendPhoto",
    {
      chat_id: chatId,
      photo: photoUrl,
      caption: cutText(wellFormed(caption), MAX_CAPTION_LEN),
      parse_mode: "HTML",
      ...(markup ? { reply_markup: markup } : {}),
    },
    Boolean(opts.bulk),
  );
  if (photo.ok) return true;
  // Chat bloklangan bo'lsa matn ham yetib bormaydi — ikkinchi urinish befoyda
  if (photo.blocked) return false;
  return sendTelegram(chatId, caption, opts);
}

/** Jarayon bo'yicha bir marta (dev'da modul qayta yuklanadi — globalThis'da, auth.ts uslubi) */
const keyFlag = globalThis as { __redinceTgKeys?: Map<string, Buffer>; __redinceTgRandom?: Buffer };

/** .env.example / dev namunaviy qiymatlar (auth.ts PLACEHOLDER_SECRET bilan bir xil) — hammaga ma'lum, kalit bo'la olmaydi */
const PLACEHOLDER_SECRET = /^(change-me|dev-only)/i;
let secretWarned = false;

/**
 * Kalit manbasi. Productionda NAMUNAVIY AUTH_SECRET («change-me…») ishlatilmaydi: auth.ts uni e'tiborsiz qoldirib sayt
 * ishlayveradi, lekin undan hosil bo'lgan webhook siri va ulash kodi imzosini istalgan odam hisoblab chiqa olardi.
 * Bunday holda baza tokeniga o'tiladi; u ham bo'lmasa — jarayon ichida tasodifiy kalit (webhook 401 qaytaradi, xavfsiz tomon).
 */
function keyMaterial(): string | Buffer {
  const prod = process.env.NODE_ENV === "production";
  const s = process.env.AUTH_SECRET;
  if (s && !(prod && PLACEHOLDER_SECRET.test(s))) return s;
  const token = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (token) return token;
  if (!prod) return "dev-only-insecure-secret-change-me-please-123456";
  if (!secretWarned) {
    secretWarned = true;
    console.error("[telegram] AUTH_SECRET namunaviy yoki yo'q — webhook siri uchun ishonchli kalit topilmadi. Haqiqiy AUTH_SECRET (yoki TELEGRAM_WEBHOOK_SECRET) bering va admin panelda «Webhookni o'rnatish»ni qayta bosing");
  }
  return (keyFlag.__redinceTgRandom ??= randomBytes(32));
}

/** Sessiya kaliti manbasidan HKDF bilan maqsadga xos kalit (har "info" uchun alohida) */
function derivedKey(info: string): Buffer {
  const cache = (keyFlag.__redinceTgKeys ??= new Map());
  const hit = cache.get(info);
  if (hit) return hit;
  const key = Buffer.from(hkdfSync("sha256", keyMaterial(), "redince", info, 32));
  cache.set(info, key);
  return key;
}

/**
 * Ulash kodi imzo kaliti — sessiya kaliti manbasidan HKDF bilan alohida hosil qilinadi
 * (auth.ts secret() bilan bir xil manba, lekin boshqa info — kodni cookie sifatida ishlatib bo'lmaydi).
 */
function linkKey(): Buffer {
  return derivedKey("telegram-link-v1");
}

/**
 * Webhook siri: TELEGRAM_WEBHOOK_SECRET berilgan bo'lsa o'sha; bo'lmasa AUTH_SECRET'dan
 * avtomatik hosil qilinadi — alohida env shart emas (setWebhook ham, tekshiruv ham shu qiymatni ishlatadi).
 */
export function telegramWebhookSecret(): string {
  const env = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (env) return env;
  return derivedKey("telegram-webhook-v1").toString("hex");
}

/**
 * Bot API chaqiruvi (umumiy): natija json yoki null (tarmoq xatosi — log, throw yo'q).
 * DIQQAT: xato holatida ham THROW QILMAYDI — `null` (tarmoq) yoki `{ok:false, description}` (Telegram rad etdi) qaytadi;
 * chaqiruvchi ikkalasini ham tekshirishi shart. Xabar yuboradigan metodlar (`send*`) umumiy yuborish navbatidan o'tadi;
 * qisqa 429 (≤3 s) bir marta qayta uriniladi.
 */
export async function telegramApi<T = unknown>(method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const paced = method.startsWith("send");
  for (let attempt = 1; ; attempt++) {
    if (paced) await acquireSendSlot(false);
    try {
      const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(10000),
      });
      const j = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } };
      if (res.status === 429) {
        const retry = Math.min(120, Math.max(1, Number(j?.parameters?.retry_after) || 1));
        if (paced) pauseSends(retry * 1000 + 200);
        if (attempt === 1 && retry <= 3) {
          if (!paced) await new Promise((r) => setTimeout(r, retry * 1000 + 100));
          continue;
        }
      }
      return j;
    } catch (e) {
      console.error(`[telegram] ${method}`, e instanceof Error ? e.message : e);
      return null;
    }
  }
}

/** Telegram'dagi faylni yuklab olish — standart ≤5 MB (chek rasmi), post uchun 20 MB (Bot API chegarasi); xato bo'lsa null */
export async function telegramDownloadFile(fileId: string, maxBytes = 5 * 1024 * 1024): Promise<Buffer | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const info = await telegramApi<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  const path = info?.result?.file_path;
  if (!path || (info?.result?.file_size ?? 0) > maxBytes) return null;
  try {
    const res = await fetch(`${apiBase()}/file/bot${token}/${path}`, { signal: AbortSignal.timeout(maxBytes > 6 * 1024 * 1024 ? 60000 : 15000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > maxBytes ? null : buf;
  } catch (e) {
    console.error("[telegram] file", e instanceof Error ? e.message : e);
    return null;
  }
}

function signPart(input: string): string {
  return createHmac("sha256", linkKey()).update(input).digest("base64url").slice(0, SIG_LEN);
}

/**
 * Qisqa muddatli (15 daqiqa) imzolangan ulash kodi (payload: userId) — bazada hech narsa saqlanmaydi.
 * UUID id'lar 16 baytga siqiladi ("u" marker), boshqa id'lar xomicha base64url ("r" marker).
 * 64 belgidan oshsa (juda uzun id) null — chaqiruvchi xato qaytaradi.
 */
export function createTelegramLinkCode(userId: string): string | null {
  const exp = Math.floor((Date.now() + LINK_CODE_TTL_MS) / 1000)
    .toString(36)
    .padStart(8, "0");
  const isUuid = UUID_RE.test(userId);
  const marker = isUuid ? "u" : "r";
  const idPart = isUuid ? base64url.encode(Buffer.from(userId.replace(/-/g, ""), "hex")) : base64url.encode(userId);
  const code = `${marker}${exp}${idPart}${signPart(`${marker}${exp}${idPart}`)}`;
  if (code.length > MAX_CODE_LEN) {
    console.error(`[telegram] linkCode ${code.length} belgi — Telegram deep-link chegarasi ${MAX_CODE_LEN} (userId uzunligi: ${userId.length})`);
    return null;
  }
  return code;
}

/** Kodni tekshiradi: imzo (timing-safe) va muddat to'g'ri bo'lsa userId, aks holda null */
export function verifyTelegramLinkCode(code: string): string | null {
  if (typeof code !== "string" || code.length < 1 + 8 + 2 + SIG_LEN || code.length > MAX_CODE_LEN || !/^[\w-]+$/.test(code)) return null;
  const marker = code[0];
  if (marker !== "u" && marker !== "r") return null;
  const exp36 = code.slice(1, 9);
  const idPart = code.slice(9, -SIG_LEN);
  const sig = code.slice(-SIG_LEN);
  const expected = signPart(`${marker}${exp36}${idPart}`);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const exp = parseInt(exp36, 36);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  try {
    const bytes = base64url.decode(idPart);
    if (marker === "u") {
      if (bytes.length !== 16) return null;
      const hex = Buffer.from(bytes).toString("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    const id = Buffer.from(bytes).toString("utf8");
    return id || null;
  } catch {
    return null;
  }
}
