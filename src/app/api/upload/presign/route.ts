import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { uid } from "@/lib/utils";
import { isR2Enabled, r2PresignPut, r2PublicUrl } from "@/lib/storage/r2";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { MAX_VIDEO_BYTES } from "@/components/chat/attachments";

/** Video kengaytmasi → MIME (faqat shu uchtasi qabul qilinadi — /api/upload/video bilan bir xil) */
const VIDEO_MIME = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" } as const;

const schema = z.object({
  ext: z.enum(["mp4", "webm", "mov"]),
  size: z.coerce.number().int().min(1).max(MAX_VIDEO_BYTES, "Video 50 MB dan katta"),
});

/**
 * Video uchun R2'ga to'g'ridan-to'g'ri (brauzerdan) yuklash: presigned PUT URL.
 * R2 sozlanmagan bo'lsa { mode: "fallback" } qaytadi — klient eski oqimga (Vercel Blob → /api/upload) o'tadi.
 *
 * Xavfsizlik (Blob client-upload oqimi bilan teng):
 *  - sessiya majburiy, kvota (upload rate limit) faqat R2 rejimida sarflanadi;
 *  - fayl NOMI SERVERDA yaratiladi (uid) — birovning yo'lini egallab bo'lmaydi;
 *  - ContentType + ContentLength imzoga kiradi — klient boshqa tur yoki kattaroq hajm yuborsa R2 rad etadi;
 *  - URL 10 daqiqa amal qiladi;
 *  - egalik yozuvi (audit "upload", targetId=<nom>) oldindan yoziladi — assertOwnUploads shundan o'qiydi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  // R2 yo'q: klientga Blob bor-yo'qligini ham aytamiz — Blob ham yo'q bo'lsa (dev/VPS) u to'g'ridan server diskiga o'tadi (Blob urinib 500 bermaydi)
  if (!isR2Enabled()) return ok({ mode: "fallback" as const, blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });

  await enforceLimit("upload", session.sub);
  const input = await parseBody(req, schema);
  const contentType = VIDEO_MIME[input.ext];
  if (!contentType) throw new ApiError(400, "Video turi noto'g'ri");

  const name = `${uid()}.${input.ext}`;
  const key = `uploads/${name}`;
  // Egalik yozuvi (assertOwnUploads shundan o'qiydi); nom tasodifiy UUID — to'qnashuv/egallash mumkin emas
  await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: input.size, mime: contentType, storage: "r2-client" } }, req);
  const uploadUrl = await r2PresignPut(key, contentType, input.size, 600);

  return ok({ mode: "r2" as const, uploadUrl, publicUrl: r2PublicUrl(key), contentType });
});
