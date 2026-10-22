import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { uid } from "@/lib/utils";
import { isR2Enabled, r2PresignPut, r2PublicUrl } from "@/lib/storage/r2";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { isPremium } from "@/lib/social/quota";
import { MAX_VIDEO_BYTES, videoLimitFor } from "@/components/chat/attachments";

/** Video kengaytmasi → MIME (faqat shu uchtasi qabul qilinadi — /api/upload/video bilan bir xil) */
const VIDEO_MIME = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg" } as const;

const schema = z.object({
  ext: z.enum(["mp4", "webm", "mov", "mp3", "m4a", "ogg"]),
  size: z.coerce.number().int().min(1).max(MAX_VIDEO_BYTES, `Video ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB dan katta`),
});

/**
 * Video uchun R2'ga to'g'ridan-to'g'ri (brauzerdan) yuklash: presigned PUT URL.
 * R2 sozlanmagan bo'lsa { mode: "fallback" } qaytadi — klient eski oqimga (Vercel Blob → /api/upload) o'tadi.
 *
 * Xavfsizlik (Blob client-upload oqimi bilan teng):
 *  - sessiya majburiy, kvota (upload rate limit) faqat R2 rejimida sarflanadi;
 *  - fayl NOMI SERVERDA yaratiladi (uid) — birovning yo'lini egallab bo'lmaydi;
 *  - ContentType + ContentLength imzoga kiradi — klient boshqa tur yoki kattaroq hajm yuborsa R2 rad etadi;
 *  - URL amal qilish muddati hajmga qarab (kamida 10 daqiqa, ~200 KB/s tezlikka hisoblangan, 6 soatgacha);
 *  - egalik yozuvi (audit "upload", targetId=<nom>) oldindan yoziladi — assertOwnUploads shundan o'qiydi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  // R2 yo'q: klientga Blob bor-yo'qligini ham aytamiz — Blob ham yo'q bo'lsa (dev/VPS) u to'g'ridan server diskiga o'tadi (Blob urinib 500 bermaydi)
  if (!isR2Enabled()) return ok({ mode: "fallback" as const, blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });

  await enforceLimit("upload", session.sub);
  const input = await parseBody(req, schema);
  const max = videoLimitFor(await isPremium(session.sub));
  if (input.size > max) throw new ApiError(413, `Fayl ${Math.round(max / (1024 * 1024))} MB dan katta${max < MAX_VIDEO_BYTES ? " — Premium yoki imtiyozli akkauntda 600 MB gacha" : ""}`);
  const contentType = VIDEO_MIME[input.ext];
  if (!contentType) throw new ApiError(400, "Video turi noto'g'ri");

  const name = `${uid()}.${input.ext}`;
  const key = `uploads/${name}`;
  // Egalik yozuvi (assertOwnUploads shundan o'qiydi); nom tasodifiy UUID — to'qnashuv/egallash mumkin emas
  await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: input.size, mime: contentType, storage: "r2-client" } }, req);
  const uploadUrl = await r2PresignPut(key, contentType, input.size, Math.min(3 * 3600, Math.max(600, Math.ceil(input.size / (200 * 1024)))));

  return ok({ mode: "r2" as const, uploadUrl, publicUrl: r2PublicUrl(key), contentType });
});
