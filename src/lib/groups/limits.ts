/**
 * Jamoalar — kiritish chegaralari. Klient komponentlari ham, server validatorlari ham shu yerdan oladi;
 * bu faylda server importlari (db, zod sxemalari) YO'Q — klient bundle'iga xavfsiz.
 */
export const GROUP_NAME_MIN = 3;
export const GROUP_NAME_MAX = 60;
export const GROUP_DESC_MAX = 600;
export const POST_BODY_MAX = 2000;
export const POST_MEDIA_MAX = 4;
export const COMMENT_MAX = 500;
export const GROUP_MSG_MAX = 2000;
/** Muqova nisbati — karta (3:1) va jamoa sahifasi hero'si bilan bir xil: kesilgan rasm aynan shunday ko'rinadi */
export const GROUP_COVER_ASPECT = 3;
/** Qoidalar (markdown-lite), xush kelibsiz matni, so'rov izohi, slug */
export const GROUP_RULES_MAX = 2000;
export const GROUP_WELCOME_MAX = 300;
export const JOIN_NOTE_MAX = 200;
export const GROUP_SLUG_MIN = 3;
export const GROUP_SLUG_MAX = 40;
/** Jim qilish muddatlari (ms); null — doimiy */
export const MUTE_OPTIONS = [
  { key: "1h", label: "1 soat", ms: 60 * 60 * 1000 },
  { key: "8h", label: "8 soat", ms: 8 * 60 * 60 * 1000 },
  { key: "forever", label: "Doim", ms: null },
] as const;
/** Taklif havolasi muddati va limiti variantlari */
export const INVITE_EXPIRY_OPTIONS = [
  { key: "1d", label: "24 soat", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 kun", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "never", label: "Cheksiz", ms: null },
] as const;
export const INVITE_USES_OPTIONS = [10, 50, null] as const;

/** Reaksiyalar (Facebook/Telegram uslubi): kalit — bazada, emoji/yorliq — UI'da. Tartib — tanlagichdagi tartib */
export const REACTIONS = [
  { key: "heart", emoji: "❤️", label: "Yoqdi" },
  { key: "fire", emoji: "🔥", label: "Zo'r" },
  { key: "clap", emoji: "👏", label: "Qoyil" },
  { key: "haha", emoji: "😂", label: "Kulgili" },
  { key: "wow", emoji: "😮", label: "Voy" },
  { key: "like", emoji: "👍", label: "Ma'qul" },
] as const;
export type ReactionKind = (typeof REACTIONS)[number]["key"];
export const REACTION_KINDS = REACTIONS.map((r) => r.key) as [ReactionKind, ...ReactionKind[]];
export const REACTION_BY_KEY: Record<ReactionKind, (typeof REACTIONS)[number]> = Object.fromEntries(REACTIONS.map((r) => [r.key, r])) as Record<ReactionKind, (typeof REACTIONS)[number]>;
/** Bitta post/izohda ko'pi bilan nechta @foydalanuvchi eslatmasi bildirishnoma oladi */
export const MENTION_MAX = 10;
/** @username naqshi (users.username bilan bir xil: 3–32 belgi, kichik harf/raqam/_ . -) */
export const MENTION_RE = /(^|[^\w@])@([a-z0-9_.-]{3,32})(?![\w.-])/giu;

/* --- Lenta qo'shimchalari (batch-800): so'rovnoma, izoh tahriri, hashtag --- */
/** Tanlangan lenta turi («Hammasi/Obunalarim») cookie nomi — klient yozadi, server `page.tsx` o'qiydi */
export const FEED_SCOPE_COOKIE = "lenta_scope";
/** So'rovnoma: variantlar soni va bitta variant uzunligi */
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 4;
export const POLL_OPTION_MAX = 60;
/** Izohni muallif shu muddat ichida tahrirlay oladi */
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000;
/** #teg naqshi: oldida harf/raqam/#/_ bo'lmasin, 2–40 belgi (unicode harflar) */
export const HASHTAG_RE = /(^|[^\p{L}\p{N}_#])#([\p{L}\p{N}_]{2,40})/gu;
/** Matndagi teglar (kichik harfda, takrorsiz, tartib saqlanadi) */
export function extractTags(text: string, max = 20): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(HASHTAG_RE)) {
    const t = m[2].toLowerCase();
    if (!out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
/** Teg nomini normallashtirish (URL'dan): faqat harf/raqam/_ , 40 belgigacha, kichik harf */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().replace(/^#+/, "").toLowerCase();
  return /^[\p{L}\p{N}_]{2,40}$/u.test(t) ? t : null;
}
