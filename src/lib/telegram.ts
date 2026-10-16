import "server-only";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
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

/** Bot API manzili — faqat testlarda soxta server bilan almashtiriladi */
function apiBase(): string {
  return process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
}

/** Inline tugma: `url` — havola, `data` — callback_data (webhook callback_query'da qaytadi, ≤64 bayt) */
export interface TelegramButton {
  text: string;
  url?: string;
  data?: string;
}

/**
 * Bot API sendMessage (HTML, havola preview'siz). Hech qachon throw qilmaydi —
 * tarmoq/API xatosi console.error bilan yutiladi, false qaytadi (bildirishnoma oqimi buzilmasin).
 * `button` — xabar ostida bitta havola tugmasi; `keyboard` — bir nechta qator (url yoki callback tugmalari).
 */
export async function sendTelegram(chatId: string, text: string, opts: { button?: { text: string; url: string }; keyboard?: TelegramButton[][] } = {}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId || !text) return false;
  const keyboard: TelegramButton[][] | null = opts.keyboard ?? (opts.button ? [[{ text: opts.button.text, url: opts.button.url }]] : null);
  try {
    const res = await fetch(`${apiBase()}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, MAX_TEXT_LEN),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(keyboard
          ? { reply_markup: { inline_keyboard: keyboard.map((row) => row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data ?? "noop" }))) } }
          : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[telegram] sendMessage", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] sendMessage", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Jarayon bo'yicha bir marta (dev'da modul qayta yuklanadi — globalThis'da, auth.ts uslubi) */
const keyFlag = globalThis as { __redinceTgKeys?: Map<string, Buffer> };

/** Sessiya kaliti manbasidan HKDF bilan maqsadga xos kalit (har "info" uchun alohida) */
function derivedKey(info: string): Buffer {
  const cache = (keyFlag.__redinceTgKeys ??= new Map());
  const hit = cache.get(info);
  if (hit) return hit;
  const base = process.env.AUTH_SECRET || process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "dev-only-insecure-secret-change-me-please-123456";
  const key = Buffer.from(hkdfSync("sha256", base, "redince", info, 32));
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

/** Bot API chaqiruvi (umumiy): natija json yoki null (tarmoq xatosi — log, throw yo'q) */
export async function telegramApi<T = unknown>(method: string, body?: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${apiBase()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(10000),
    });
    return (await res.json()) as { ok: boolean; result?: T; description?: string };
  } catch (e) {
    console.error(`[telegram] ${method}`, e instanceof Error ? e.message : e);
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
