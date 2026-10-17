import { z } from "zod";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { attachmentListSchema } from "@/app/api/orders/_lib/attachments";

import { COMMENT_MAX, GROUP_DESC_MAX, GROUP_MSG_MAX, GROUP_NAME_MAX, GROUP_NAME_MIN, POST_BODY_MAX, POST_MEDIA_MAX } from "./limits";

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

export const groupPatchSchema = groupInputSchema.partial();

export const postInputSchema = z.object({
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
});

export const memberActionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["approve", "reject", "remove", "promote", "demote"]),
});

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
