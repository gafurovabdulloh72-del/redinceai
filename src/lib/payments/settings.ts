import "server-only";
import { cache } from "react";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { PLATFORM_DEFAULTS, TOP_RATED_RULE } from "@/lib/constants";

/**
 * Komissiya darajalari (F21). PLATFORM_DEFAULTS (constants.ts) hali bu kalitlarni bilmasa ham ishlaydi —
 * constants'dagi qiymat bo'lsa u ustun (keyin spread).
 *  commissionPctNew — yangi mutaxassis (bajarilgan buyurtmalar < NEW_TIER_MAX)
 *  commissionPct    — oddiy daraja
 *  commissionPctTop — "Top mutaxassis" (topRated)
 */
const TIER_DEFAULTS = { commissionPctNew: 15, commissionPctTop: 7 } as const;
export const ALL_DEFAULTS = { ...TIER_DEFAULTS, ...PLATFORM_DEFAULTS } as const;
/** Shu sondan kam bajarilgan buyurtmasi bo'lgan mutaxassis "yangi" darajada */
export const NEW_TIER_MAX_COMPLETED = 3;
/**
 * "Top mutaxassis" (F21/F69) — recalcRating (queries.ts) bilan BIR XIL qoida (constants TOP_RATED_RULE), aks holda
 * nishon sharh yozilganda va buyurtma yakunlanganda almashib turadi. Qoidaga minCompleted qo'shilsa — u ham hisobga olinadi.
 */
const RULE: { minRating: number; minReviews: number; minCompleted?: number } = TOP_RATED_RULE;
export const TOP_RATED_MIN_RATING = RULE.minRating;
export const TOP_RATED_MIN_REVIEWS = RULE.minReviews;
export const TOP_RATED_MIN_COMPLETED = RULE.minCompleted ?? 0;
export function isTopRated(sp: { rating: number; reviewCount: number; completedCount: number }): boolean {
  return sp.rating >= TOP_RATED_MIN_RATING && sp.reviewCount >= TOP_RATED_MIN_REVIEWS && sp.completedCount >= TOP_RATED_MIN_COMPLETED;
}

export type PlatformSettings = { -readonly [K in keyof typeof ALL_DEFAULTS]: number };
export type PlatformSettingKey = keyof PlatformSettings;

const KEYS = Object.keys(ALL_DEFAULTS) as PlatformSettingKey[];
const isKey = (k: string): k is PlatformSettingKey => (KEYS as string[]).includes(k);

/**
 * Platforma sozlamalari (komissiya darajalari, minimal payout, minimal buyurtma summasi).
 * React cache() — bitta so'rov ichida necha marta chaqirilsa ham baza bir marta o'qiladi.
 * Bazada yo'q kalitlar uchun standart qiymatlar ishlatiladi.
 */
export const getSettings = cache(async (): Promise<PlatformSettings> => {
  const out: PlatformSettings = { ...ALL_DEFAULTS };
  try {
    const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, KEYS));
    for (const r of rows) {
      if (!isKey(r.key)) continue;
      const n = Number(r.value);
      if (Number.isFinite(n) && n >= 0) out[r.key] = Math.round(n);
    }
  } catch (e) {
    console.error("[settings] o'qib bo'lmadi, standart qiymatlar ishlatiladi", e);
  }
  return out;
});

export async function getSetting<K extends PlatformSettingKey>(key: K): Promise<PlatformSettings[K]> {
  return (await getSettings())[key];
}

/** Admin: sozlamalarni saqlash (upsert). Faqat berilgan kalitlar yoziladi; to'liq yangi qiymatlarni qaytaradi. */
export async function saveSettings(input: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const now = new Date();
  for (const key of KEYS) {
    const raw = input[key];
    if (raw == null) continue;
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) continue;
    await db
      .insert(platformSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: now } });
  }
  return { ...(await getSettings()), ...Object.fromEntries(Object.entries(input).filter(([k, v]) => isKey(k) && v != null).map(([k, v]) => [k, Math.round(Number(v))])) } as PlatformSettings;
}

export type CommissionTier = "new" | "standard" | "top";

/** Mutaxassisning komissiya darajasi: topRated → top; bajarilgan buyurtmalar kam → new; aks holda standart */
export function commissionTierFor(sp: { completedCount?: number | null; topRated?: boolean | null }): CommissionTier {
  if (sp.topRated) return "top";
  if ((sp.completedCount ?? 0) < NEW_TIER_MAX_COMPLETED) return "new";
  return "standard";
}

/** Daraja bo'yicha foiz (narx belgilash paytida buyurtmaga snapshot qilinadi) */
export function commissionPctFor(settings: PlatformSettings, sp: { completedCount?: number | null; topRated?: boolean | null }): { pct: number; tier: CommissionTier } {
  const tier = commissionTierFor(sp);
  const pct = tier === "top" ? settings.commissionPctTop : tier === "new" ? settings.commissionPctNew : settings.commissionPct;
  return { pct, tier };
}

/**
 * Shoshilinch buyurtma ustamasi (F30): asosiy narxning urgentPct foizi, so'mgacha yaxlitlangan.
 * orders.amount = asosiy narx + urgentFee — mijoz shu jami summani to'laydi (Payme/Click/checkout ham orders.amount'ni
 * ishlatadi), komissiya jami summaga qo'llanadi, ustama ham mutaxassisga tegishli.
 */
export function urgentFeeFor(base: number, urgentPct: number): number {
  const pct = Math.min(100, Math.max(0, urgentPct));
  return Math.round((Math.max(0, base) * pct) / 100);
}

/** Komissiyani bo'lish: mijoz to'lagan summadan platformaga qoladigan qism va mutaxassis ulushi */
export function splitAmount(amount: number, commissionPct: number): { commissionAmount: number; netAmount: number } {
  const pct = Math.min(100, Math.max(0, commissionPct));
  const commissionAmount = Math.round((amount * pct) / 100);
  return { commissionAmount, netAmount: Math.max(0, amount - commissionAmount) };
}

/* ------------------------------------------------------------------ */
/* Qo'lda o'tkazma kartasi (admin sozlamasi; env PLATFORM_CARD — zaxira) */
/* ------------------------------------------------------------------ */
const CARD_KEYS = ["platformCard", "platformCardName"] as const;

export interface ManualCard {
  card: string;
  name: string;
  /** Qiymat qayerdan: admin sozlamasi, env yoki umuman yo'q */
  source: "settings" | "env" | "none";
}

/** Keshsiz o'qish — saqlashdan oldin/keyin solishtirish uchun (getManualCard so'rov ichida keshlanadi) */
export async function readManualCard(): Promise<ManualCard> {
  const envCard = process.env.PLATFORM_CARD?.trim() || "";
  const envName = process.env.PLATFORM_CARD_NAME?.trim() || "Kasb Egalari";
  try {
    const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, [...CARD_KEYS]));
    const map = Object.fromEntries(rows.map((r) => [r.key, typeof r.value === "string" ? r.value : ""]));
    const card = (map.platformCard ?? "").trim();
    if (card) return { card, name: (map.platformCardName ?? "").trim() || envName, source: "settings" };
  } catch (e) {
    console.error("[settings] platforma kartasi o'qilmadi", e);
  }
  return envCard ? { card: envCard, name: envName, source: "env" } : { card: "", name: envName, source: "none" };
}

export const getManualCard = cache(readManualCard);

/** Admin: qo'lda o'tkazma kartasini saqlash (bo'sh card — o'chirish, env zaxiraga qaytadi) */
export async function saveManualCard(card: string, name: string): Promise<void> {
  const now = new Date();
  for (const [key, value] of [
    ["platformCard", card],
    ["platformCardName", name],
  ] as const) {
    await db
      .insert(platformSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: now } });
  }
}

/* ------------------------------------------------------------------ */
/* Sayt e'loni va texnik ishlar rejimi (2026-11-10)                     */
/* ------------------------------------------------------------------ */
/**
 * Ikki kalit `platform_settings`da JSON obyekt sifatida turadi:
 *  siteBanner  — sayt tepasidagi e'lon chizig'i (matn uz/ru, ohang, havola, muddat, versiya);
 *  maintenance — «faqat o'qish» rejimi (admin bo'lmaganlarning o'zgartirishlari 503 oladi — lib/admin/maintenance.ts).
 * Bu yerda faqat XOM o'qish/yozish; keshlangan o'qish — lib/admin/site-notice.ts (layout har so'rovda bazaga bormasin).
 */
export const BANNER_TONES = ["info", "warn", "success"] as const;
export type BannerTone = (typeof BANNER_TONES)[number];

export interface SiteBannerSetting {
  textUz: string;
  /** Bo'sh bo'lsa rus tilidagi tashrifchiga ham o'zbekcha matn ko'rsatiladi */
  textRu: string;
  tone: BannerTone;
  /** Ichki yo'l (/…) yoki https havola; null — havolasiz */
  href: string | null;
  /** Shu vaqtgacha (ms) ko'rsatiladi; null — o'chirilguncha */
  until: number | null;
  /** Har saqlashda yangilanadi — tashrifchi yopgan e'lon yangi versiyada yana ko'rinadi */
  version: number;
}

export interface MaintenanceSetting {
  on: boolean;
  /** Bo'sh bo'lsa standart matn (i18n/dict/system.ts) */
  messageUz: string;
  messageRu: string;
  /** Yoqilgan vaqt (ms) — admin panelda «N daqiqadan beri» */
  since: number | null;
}

export const BANNER_LIMITS = { text: 240, href: 300, message: 300 } as const;
const NOTICE_KEYS = ["siteBanner", "maintenance"] as const;
export const MAINTENANCE_OFF: MaintenanceSetting = { on: false, messageUz: "", messageRu: "", since: null };

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** E'lon havolasi xavfsizmi: ichki yo'l (`/…`, `//` emas) yoki https manzil. Boshqa sxema (javascript:, data:, http:) — yo'q */
export function safeBannerHref(v: unknown): string | null {
  const s = str(v, BANNER_LIMITS.href);
  if (!s) return null;
  if (s.startsWith("/")) return s.startsWith("//") || /[\\\u0000-\u001f\s]/.test(s) ? null : s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

function parseBanner(v: unknown): SiteBannerSetting | null {
  const o = obj(v);
  if (!o) return null;
  const textUz = str(o.textUz, BANNER_LIMITS.text);
  if (!textUz) return null;
  const tone = (BANNER_TONES as readonly string[]).includes(String(o.tone)) ? (o.tone as BannerTone) : "info";
  const until = typeof o.until === "number" && Number.isFinite(o.until) && o.until > 0 ? Math.round(o.until) : null;
  const version = typeof o.version === "number" && Number.isFinite(o.version) ? Math.round(o.version) : 1;
  return { textUz, textRu: str(o.textRu, BANNER_LIMITS.text), tone, href: safeBannerHref(o.href), until, version };
}

function parseMaintenance(v: unknown): MaintenanceSetting {
  const o = obj(v);
  if (!o) return { ...MAINTENANCE_OFF };
  return {
    on: o.on === true,
    messageUz: str(o.messageUz, BANNER_LIMITS.message),
    messageRu: str(o.messageRu, BANNER_LIMITS.message),
    since: typeof o.since === "number" && Number.isFinite(o.since) ? Math.round(o.since) : null,
  };
}

/** Keshsiz o'qish (admin API va kesh yangilash uchun). Baza xatosi YUQORIGA tashlanadi — kesh qatlami oxirgi ma'lum holatni saqlaydi */
export async function readSiteNotice(): Promise<{ banner: SiteBannerSetting | null; maintenance: MaintenanceSetting }> {
  const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, [...NOTICE_KEYS]));
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return { banner: parseBanner(map.get("siteBanner")), maintenance: parseMaintenance(map.get("maintenance")) };
}

async function putSetting(key: (typeof NOTICE_KEYS)[number], value: unknown): Promise<void> {
  const now = new Date();
  await db
    .insert(platformSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: now } });
}

/** Admin: e'lonni saqlash (versiya yangilanadi) yoki `null` bilan o'chirish. Saqlangan holatni qaytaradi */
export async function saveSiteBanner(input: Omit<SiteBannerSetting, "version"> | null): Promise<SiteBannerSetting | null> {
  if (!input) {
    await db.delete(platformSettings).where(eq(platformSettings.key, "siteBanner"));
    return null;
  }
  const saved = parseBanner({ ...input, version: Date.now() });
  if (!saved) throw new Error("E'lon matni bo'sh");
  await putSetting("siteBanner", saved);
  return saved;
}

/** Admin: texnik ishlar rejimini saqlash. `since` — yoqilgan paytda qo'yiladi, o'chirilganda tozalanadi */
export async function saveMaintenance(input: Pick<MaintenanceSetting, "on" | "messageUz" | "messageRu">, prev?: MaintenanceSetting): Promise<MaintenanceSetting> {
  const saved = parseMaintenance({ ...input, since: input.on ? (prev?.on && prev.since ? prev.since : Date.now()) : null });
  await putSetting("maintenance", saved);
  return saved;
}
