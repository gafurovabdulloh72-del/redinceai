import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { blobHostOf, ownBlobHost } from "@/lib/uploads";
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
 * O'z Blob do'konimiz xosti HAQIQIY yuklama bilan tasdiqlanganmi. Tokendan olingan taxmin (`ownBlobHost`) faqat shu
 * xost bilan kamida bitta server yuklamasi jurnalda bo'lsa ishlatiladi — token formati o'zgarsa tekshiruv o'zi o'chadi
 * (yuklashlar to'xtab qolmaydi). Ijobiy javob jarayon davomida keshlanadi; salbiysi 5 daqiqa.
 */
let hostConfirmed: { host: string; ok: boolean; at: number } | null = null;
async function confirmedBlobHost(): Promise<string | null> {
  const guess = ownBlobHost();
  if (!guess) return null;
  if (hostConfirmed?.host === guess && (hostConfirmed.ok || Date.now() - hostConfirmed.at < 5 * 60_000)) return hostConfirmed.ok ? guess : null;
  const [row] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "upload"), sql`json_extract(${auditLogs.meta}, '$.host') = ${guess}`))
    .limit(1);
  hostConfirmed = { host: guess, ok: Boolean(row), at: Date.now() };
  return row ? guess : null;
}

/**
 * Manzil fayl HAQIQATAN saqlangan joyga mosmi (7-audit). Egalik fayl NOMI bo'yicha tekshiriladi, yuklama naqshi esa har
 * qanday `*.public.blob.vercel-storage.com` do'konini o'tkazadi — foydalanuvchi faylni bizga yuklab, keyin O'Z do'konidagi
 * shu nomli faylga havola bera olardi (mazmunini istagan payt almashtiradi: moderatsiyadan, chek tasdig'idan keyin ham).
 * Jurnal yozuvida saqlash turi bor (`disk` | `r2` | `r2-client` | `blob` | `blob-client`), server Blob yuklamasida xost ham.
 */
function storageMatches(url: string, meta: Record<string, unknown>, ownHost: string | null): boolean {
  const storage = typeof meta.storage === "string" ? meta.storage : "";
  const host = blobHostOf(url);
  if (storage === "disk") return url.startsWith("/uploads/");
  if (storage.startsWith("r2")) return !host;
  if (storage.startsWith("blob")) {
    if (!host) return true; // nisbiy manzil — fayl ochilmaydi, lekin begona mazmun ham emas
    if (typeof meta.host === "string" && meta.host) return host === meta.host.toLowerCase();
    return ownHost ? host === ownHost : true;
  }
  return true; // eski yozuvlar (saqlash turi yozilmagan)
}

/**
 * Egalik tekshiruvi: har bir yangi fayl shu foydalanuvchi tomonidan yuklangan bo'lishi kerak
 * (/api/upload har yuklashni audit jurnaliga `upload` + targetId=<fayl nomi> bilan yozadi) VA manzil o'sha fayl
 * saqlangan joyga ko'rsatishi kerak (`storageMatches`).
 * `known` — yozuvda allaqachon bor URL'lar (tahrirda qayta yuborilganlari tekshirilmaydi).
 * `field` — xato qaysi forma maydoniga tegishli (masalan, sharhlarda "media").
 */
export async function assertOwnUploads(userId: string, urls: string[], known: string[] = [], field = "attachments"): Promise<void> {
  const fresh = [...new Set(urls.filter((u) => !known.includes(u)))];
  if (!fresh.length) return;
  const names = fresh.map(uploadName);
  const rows = await db
    .select({ targetId: auditLogs.targetId, meta: auditLogs.meta })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "upload"), eq(auditLogs.actorId, userId), inArray(auditLogs.targetId, names)));
  const own = new Map(rows.map((r) => [r.targetId, r.meta ?? {}]));
  const missing = new ApiError(422, "Fayl topilmadi — uni qayta yuklang", { [field]: "Fayl topilmadi — uni qayta yuklang" });
  if (names.some((n) => !own.has(n))) throw missing;
  const ownHost = fresh.some((u) => blobHostOf(u)) ? await confirmedBlobHost().catch(() => null) : null;
  if (fresh.some((u) => !storageMatches(u, own.get(uploadName(u)) ?? {}, ownHost))) throw missing;
}
