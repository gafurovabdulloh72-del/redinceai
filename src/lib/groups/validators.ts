import { z } from "zod";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { attachmentListSchema } from "@/app/api/orders/_lib/attachments";
import { isAudioUrl } from "@/components/chat/attachments";

import { COMMENT_MAX, GROUP_DESC_MAX, GROUP_MSG_MAX, GROUP_NAME_MAX, GROUP_NAME_MIN, GROUP_RULES_MAX, GROUP_SLUG_MAX, GROUP_SLUG_MIN, GROUP_WELCOME_MAX, INVITE_EXPIRY_OPTIONS, JOIN_NOTE_MAX, MUTE_OPTIONS, POST_BODY_MAX, POST_MEDIA_MAX } from "./limits";

export * from "./limits";

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const regionSlugs = REGIONS.map((r) => r.slug) as [string, ...string[]];

const optionalEnum = (values: [string, ...string[]]) => z.enum(values).nullable().optional().or(z.literal("")).transform((v) => (v ? v : null));

export const groupInputSchema = z.object({
  name: z.string().trim().min(GROUP_NAME_MIN, `Nom kamida ${GROUP_NAME_MIN} ta belgi`).max(GROUP_NAME_MAX, `Nom ko'pi bilan ${GROUP_NAME_MAX} belgi`),
  description: z.string().trim().max(GROUP_DESC_MAX, `Tavsif ko'pi bilan ${GROUP_DESC_MAX} belgi`).optional().default(""),
  category: optionalEnum(categorySlugs),
  region: optionalEnum(regionSlugs),
  coverUrl: z.string().trim().max(500).optional().default(""),
  isPrivate: z.boolean().optional().default(false),
  /** group — hamma yozadi; channel — faqat egasi/adminlar */
  kind: z.enum(["group", "channel"]).optional().default("group"),
  /** Rasmiy kanal — route faqat sayt adminidan qabul qiladi */
  isOfficial: z.boolean().optional(),
});
export type GroupInput = z.infer<typeof groupInputSchema>;

export const groupPatchSchema = groupInputSchema.partial().extend({
  /** Manzil (slug) — faqat egasi; 3–40 belgi, kichik lotin/raqam/defis */
  slug: z.string().trim().toLowerCase().min(GROUP_SLUG_MIN, `Manzil kamida ${GROUP_SLUG_MIN} belgi`).max(GROUP_SLUG_MAX, `Manzil ko'pi bilan ${GROUP_SLUG_MAX} belgi`).optional(),
  rules: z.string().trim().max(GROUP_RULES_MAX, `Qoidalar ko'pi bilan ${GROUP_RULES_MAX} belgi`).optional(),
  welcomeText: z.string().trim().max(GROUP_WELCOME_MAX, `Matn ko'pi bilan ${GROUP_WELCOME_MAX} belgi`).optional(),
  coverPosition: z.coerce.number().int().min(0).max(100).nullable().optional(),
});

/** Xabar tahriri / qadash */
export const messagePatchSchema = z.object({
  body: z.string().trim().min(1, "Matn bo'sh").max(GROUP_MSG_MAX).optional(),
  pinned: z.boolean().optional(),
});

/** Qo'shilish: taklif kodi va (yopiq jamoada) qisqa izoh */
export const joinBodySchema = z.object({
  invite: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(JOIN_NOTE_MAX, `Izoh ko'pi bilan ${JOIN_NOTE_MAX} belgi`).nullable().optional(),
});

/** Jim qilish (muddat bilan) va efir eslatmasi */
export const muteSchema = z.object({
  muted: z.boolean().optional(),
  duration: z.enum(MUTE_OPTIONS.map((o) => o.key) as ["1h", "8h", "forever"]).optional(),
  eventReminders: z.boolean().optional(),
});

/** Taklif havolasi: yangilash, muddat, limit */
export const inviteSchema = z.object({
  rotate: z.boolean().optional().default(false),
  expiresIn: z.enum(INVITE_EXPIRY_OPTIONS.map((o) => o.key) as ["1d", "7d", "never"]).optional(),
  maxUses: z.union([z.literal(10), z.literal(50), z.null()]).optional(),
});

export const chatQuerySchema = z.object({
  after: z.string().trim().max(64).optional(),
  /** Qidiruv — 2–80 belgi */
  q: z.string().trim().min(2).max(80).optional(),
  /** Polling: shu vaqtdan (ms) keyin tahrirlangan/o'chirilganlar */
  changedSince: z.coerce.number().int().positive().optional(),
});

export const membersQuerySchema = z.object({
  status: z.enum(["active", "pending", "banned"]).optional().default("active"),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

/** Musiqa: o'zimizga yuklangan audio (URL keyin useMusic bilan tekshiriladi) yoki ommaviy katalog (iTunes) namunasi, va nomi */
export const musicSchema = z.object({
  url: z.string().trim().max(500).refine(isAudioUrl, "Musiqa katalogdan tanlanishi yoki sayt orqali yuklanishi kerak"),
  title: z.string().trim().min(1, "Musiqa nomini yozing").max(80),
  artist: z.string().trim().max(80).optional(),
  start: z.coerce.number().min(0).max(600).optional(),
});

export const postInputSchema = z.object({
  music: musicSchema.nullable().optional(),
  subscribersOnly: z.boolean().optional(),
  body: z.string().trim().max(POST_BODY_MAX, `Matn ko'pi bilan ${POST_BODY_MAX} belgi`).optional().default(""),
  media: attachmentListSchema(POST_MEDIA_MAX).optional().default([]),
  /** Efir/yig'ilish: vaqti (ms, kelajakda) va https havola (Zoom/Meet/YouTube/Telegram) — ikkalasi ixtiyoriy, havola vaqtsiz bo'lmaydi */
  eventAt: z.coerce.number().int().positive().nullable().optional(),
  eventUrl: z.string().trim().max(300).regex(/^https:\/\/\S+$/, "Havola https:// bilan boshlanishi kerak").optional().or(z.literal("")),
});

export const commentInputSchema = z.object({
  body: z.string().trim().min(1, "Izoh bo'sh").max(COMMENT_MAX, `Izoh ko'pi bilan ${COMMENT_MAX} belgi`),
});

export const groupMessageSchema = z.object({
  body: z.string().trim().max(GROUP_MSG_MAX).optional().default(""),
  attachments: attachmentListSchema().optional().default([]),
  /** Javob (iqtibos) — shu guruhdagi xabar id'si */
  replyToId: z.string().trim().max(64).nullable().optional(),
});

export const memberActionSchema = z.union([
  z.object({
    userId: z.string().min(1),
    action: z.enum(["approve", "reject", "remove", "promote", "demote", "unban"]),
  }),
  /** Barcha kutayotgan so'rovlarni bir bosishda tasdiqlash */
  z.object({ action: z.literal("approve_all") }),
]);

export const groupListQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(""),
  category: z.string().trim().max(40).optional().default(""),
  region: z.string().trim().max(40).optional().default(""),
  /** mine — men a'zo bo'lgan jamoalar */
  mine: z.enum(["1", "0"]).optional().default("0"),
  /** kind — faqat guruhlar yoki faqat kanallar */
  kind: z.enum(["group", "channel"]).optional().or(z.literal("")).default(""),
  /** sort — faollik (standart), yangi ochilgan, a'zolar soni */
  sort: z.enum(["active", "new", "members"]).optional().default("active"),
  limit: z.coerce.number().int().min(1).max(60).optional().default(30),
});
