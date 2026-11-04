import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { uid } from "@/lib/utils";
import { isR2Enabled, r2PresignPut, r2PublicUrl } from "@/lib/storage/r2";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { premiumTier } from "@/lib/social/quota";
import { MAX_UPLOAD_BYTES, MAX_VIDEO_BYTES, videoLimitFor } from "@/components/chat/attachments";

/** Video kengaytmasi → MIME (faqat shu uchtasi qabul qilinadi — /api/upload/video bilan bir xil) */
const VIDEO_MIME = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg" } as const;
/** Ovozli xabar (purpose="voice"): MediaRecorder formatlari — .weba (WebM/Opus), .m4a (Safari), .ogg; 5 MB gacha */
const VOICE_MIME = { weba: "audio/webm", m4a: "audio/mp4", ogg: "audio/ogg" } as const;

const VOICE_ERR = "Ovozli xabar formati qo'llab-quvvatlanmaydi (WebM/Opus, M4A yoki Ogg)";
/** purpose bo'yicha tarmoqlanadi: yo'q/"video" — video oqimi (600 MB gacha), "voice" — faqat audio kengaytma + 5 MB */
const schema = z
  .object({
    purpose: z.enum(["video", "voice"]).optional(),
    ext: z.enum(["mp4", "webm", "mov", "mp3", "m4a", "ogg", "weba"]),
    size: z.coerce.number().int().min(1),
  })
  .superRefine((v, ctx) => {
    if (v.purpose === "voice") {
      if (!(v.ext in VOICE_MIME)) ctx.addIssue({ code: "custom", path: ["ext"], message: VOICE_ERR });
      if (v.size > MAX_UPLOAD_BYTES) ctx.addIssue({ code: "custom", path: ["size"], message: "Ovozli xabar 5 MB dan katta — qisqaroq yozing" });
    } else {
      if (!(v.ext in VIDEO_MIME)) ctx.addIssue({ code: "custom", path: ["ext"], message: "Video turi noto'g'ri" });
      if (v.size > MAX_VIDEO_BYTES) ctx.addIssue({ code: "custom", path: ["size"], message: `Video ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB dan katta` });
    }
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
  // Tana R2'dan OLDIN tekshiriladi: noto'g'ri tur/hajm har muhitda 422 (klient fallback'ka o'tmaydi)
  const input = await parseBody(req, schema);
  // R2 yo'q: klientga Blob bor-yo'qligini ham aytamiz — Blob ham yo'q bo'lsa (dev/VPS) u to'g'ridan server diskiga o'tadi (Blob urinib 500 bermaydi)
  if (!isR2Enabled()) return ok({ mode: "fallback" as const, blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });

  if (input.purpose === "voice") {
    // Ovozli xabar: alohida kvota ("voice"), audio MIME + 5 MB imzoga kiradi, nom serverda (uid)
    await enforceLimit("voice", session.sub);
    const contentType = VOICE_MIME[input.ext as keyof typeof VOICE_MIME];
    const name = `${uid()}.${input.ext}`;
    const key = `uploads/${name}`;
    await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: input.size, mime: contentType, storage: "r2-client", purpose: "voice" } }, req);
    const uploadUrl = await r2PresignPut(key, contentType, input.size, 600);
    return ok({ mode: "r2" as const, uploadUrl, publicUrl: r2PublicUrl(key), contentType });
  }

  await enforceLimit("upload", session.sub);
  const max = videoLimitFor(await premiumTier(session.sub));
  if (input.size > max) throw new ApiError(413, `Fayl ${Math.round(max / (1024 * 1024))} MB dan katta${max < MAX_VIDEO_BYTES ? " — Pro tarifda 600 MB gacha" : ""}`);
  const contentType = VIDEO_MIME[input.ext as keyof typeof VIDEO_MIME];
  if (!contentType) throw new ApiError(400, "Video turi noto'g'ri");

  const name = `${uid()}.${input.ext}`;
  const key = `uploads/${name}`;
  // Egalik yozuvi (assertOwnUploads shundan o'qiydi); nom tasodifiy UUID — to'qnashuv/egallash mumkin emas
  await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: input.size, mime: contentType, storage: "r2-client" } }, req);
  const uploadUrl = await r2PresignPut(key, contentType, input.size, Math.min(3 * 3600, Math.max(600, Math.ceil(input.size / (200 * 1024)))));

  return ok({ mode: "r2" as const, uploadUrl, publicUrl: r2PublicUrl(key), contentType });
});
