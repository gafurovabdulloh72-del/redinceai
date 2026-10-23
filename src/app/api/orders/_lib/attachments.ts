import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { MAX_ATTACHMENTS, MAX_VIDEO_BYTES, UPLOAD_URL_RE, mimeFromUrl, uploadName, type Attachment } from "@/components/chat/attachments";

/** Bitta biriktirma: URL faqat /api/upload natijasi; tur URL kengaytmasidan olinadi */
export const attachmentSchema = z
  .object({
    url: z.string().trim().max(500).regex(UPLOAD_URL_RE, "Fayl sayt orqali yuklanishi kerak"),
    name: z.string().trim().max(120).optional().default(""),
    size: z.coerce.number().int().min(0).max(MAX_VIDEO_BYTES).optional().default(0),
    type: z.string().trim().max(80).optional().default(""),
    /** Ovozli xabar davomiyligi (soniya) — faqat ko'rsatish uchun */
    duration: z.coerce.number().min(0).max(3600).optional(),
    /** Video muqovasi: faqat sayt yuklamasi (rasm) */
    poster: z.string().trim().max(500).regex(UPLOAD_URL_RE, "Muqova sayt orqali yuklanishi kerak").optional(),
    /** Doira video xabar (chatda aylana shaklida ko'rsatiladi) */
    round: z.boolean().optional(),
  })
  .transform(
    (a): Attachment => ({
      url: a.url,
      name: a.name.replace(/[\u0000-\u001f]/g, "").trim() || uploadName(a.url),
      size: a.size,
      type: mimeFromUrl(a.url) ?? "application/octet-stream",
      ...(a.duration ? { duration: Math.round(a.duration) } : {}),
      ...(a.poster ? { poster: a.poster } : {}),
      ...(a.round ? { round: true } : {}),
    }),
  );

export const attachmentListSchema = (max = MAX_ATTACHMENTS) => z.array(attachmentSchema).max(max, `Ko'pi bilan ${max} ta fayl`);

/** Takrorlarni olib tashlash (URL bo'yicha) */
export function uniqueAttachments(list: Attachment[]): Attachment[] {
  const seen = new Set<string>();
  return list.filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)));
}

/**
 * Egalik tekshiruvi: har bir yangi fayl shu foydalanuvchi tomonidan yuklangan bo'lishi kerak
 * (/api/upload har yuklashni audit jurnaliga `upload` + targetId=<fayl nomi> bilan yozadi).
 * `known` — yozuvda allaqachon bor URL'lar (tahrirda qayta yuborilganlari tekshirilmaydi).
 * `field` — xato qaysi forma maydoniga tegishli (masalan, sharhlarda "media").
 */
export async function assertOwnUploads(userId: string, urls: string[], known: string[] = [], field = "attachments"): Promise<void> {
  const fresh = [...new Set(urls.filter((u) => !known.includes(u)))];
  if (!fresh.length) return;
  const names = fresh.map(uploadName);
  const rows = await db
    .select({ targetId: auditLogs.targetId })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "upload"), eq(auditLogs.actorId, userId), inArray(auditLogs.targetId, names)));
  const own = new Set(rows.map((r) => r.targetId));
  if (names.some((n) => !own.has(n))) throw new ApiError(422, "Fayl topilmadi — uni qayta yuklang", { [field]: "Fayl topilmadi — uni qayta yuklang" });
}
