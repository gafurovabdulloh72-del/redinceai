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
