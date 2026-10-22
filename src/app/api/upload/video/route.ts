import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { uploadDir } from "@/lib/uploads";
import { uid } from "@/lib/utils";
import { isPremium } from "@/lib/social/quota";
import { MAX_VIDEO_BYTES_FALLBACK, videoLimitFor, uploadName } from "@/components/chat/attachments";

/** Video "sehrli baytlari": MP4/MOV — ISO-BMFF "ftyp", WebM — EBML (brauzer MIME'siga ishonmaymiz) */
function sniffVideo(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand.startsWith("qt")) return { ext: "mov", mime: "video/quicktime" };
    return { ext: "mp4", mime: "video/mp4" };
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: "webm", mime: "video/webm" };
  // Musiqa (katta audio ham shu oqim orqali): MP3 (ID3/kadr sinxroni), Ogg
  if (buf.length >= 3 && buf.subarray(0, 3).toString("ascii") === "ID3") return { ext: "mp3", mime: "audio/mpeg" };
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ext: "mp3", mime: "audio/mpeg" };
  if (buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  return null;
}

/**
 * Video yuklash — brauzerdan to'g'ridan-to'g'ri Vercel Blob'ga (client upload).
 * Server tanasi Vercel'da 4.5 MB bilan cheklangani uchun video /api/upload orqali o'tmaydi:
 * bu route faqat qisqa muddatli yuklash tokenini beradi (sessiya + kvota + yo'l tekshirilib),
 * faylning o'zi esa brauzer → Blob'ga boradi (50 MB gacha; MP4, WebM, MOV).
 * BLOB_READ_WRITE_TOKEN bo'lmasa (dev) klient oddiy /api/upload'ga qaytadi.
 *
 * Xavfsizlik (pentest E95):
 *  - allowOverwrite:false — mavjud faylning ustiga yozib bo'lmaydi (birovning videosini buzish yo'q)
 *  - Yo'l oldindan band bo'lsa (shu nom bo'yicha "upload" yozuvi bor) — rad etiladi, shuning uchun
 *    hujumchi birovning yo'li uchun token so'rab, egalik yozuvini o'ziga yoza olmaydi
 *  - addRandomSuffix:false — nom allaqachon UUID (122 bit), taxmin qilib bo'lmaydi
 */
export const POST = handler(async (req) => {
  const session = await requireSession();

  // Disk yo'li (Blob/R2 ulanmagan muhit — dev yoki o'z serveri/VPS): video multipart bilan keladi, 50 MB gacha.
  // Vercel'da disk yozilmaydi — u yerda Blob majburiy (ulanmagan bo'lsa aniq xato).
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    if (process.env.VERCEL) throw new ApiError(503, "Video yuklash hali sozlanmagan (Vercel → Storage → Blob).");
    const clHeader = req.headers.get("content-length");
    const declared = clHeader === null ? NaN : Number(clHeader);
    if (!Number.isFinite(declared)) throw new ApiError(411, "Content-Length sarlavhasi talab qilinadi");
    if (declared > MAX_VIDEO_BYTES_FALLBACK + 64 * 1024) throw new ApiError(413, "Video 50 MB dan katta");
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Fayl topilmadi");
    if (file.size > MAX_VIDEO_BYTES_FALLBACK) throw new ApiError(413, "Video 50 MB dan katta");
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = sniffVideo(bytes);
    if (!kind) throw new ApiError(415, "Faqat MP4, WebM yoki MOV video");
    await enforceLimit("upload", session.sub);
    const name = `${uid()}.${kind.ext}`;
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: bytes.length, mime: kind.mime, storage: "disk" } }, req);
    return ok({ url: `/uploads/${name}` }, { status: 201 });
  }

  const maxBytes = videoLimitFor(await isPremium(session.sub));
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) throw new ApiError(400, "JSON noto'g'ri");

  const json = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      await enforceLimit("upload", session.sub);
      if (!/^uploads\/[\w-]{10,64}\.(?:mp4|webm|mov|mp3|m4a|ogg)$/i.test(pathname)) throw new ApiError(400, "Fayl yo'li noto'g'ri");
      const name = uploadName(pathname);
      // Bu nom allaqachon kimdir tomonidan yuklangan bo'lsa — qayta egalik qilib bo'lmaydi (IDOR/soxta egalik oldi)
      const taken = await db.query.auditLogs.findFirst({
        where: and(eq(auditLogs.action, "upload"), eq(auditLogs.targetId, name)),
        columns: { id: true },
      });
      if (taken) throw new ApiError(409, "Fayl yo'li band — sahifani yangilab, qayta urinib ko'ring");
      // Egalik yozuvi (assertOwnUploads shundan o'qiydi) — nom band qilinadi
      await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { mime: "video", storage: "blob-client" } }, req);
      return {
        allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime", "audio/mpeg", "audio/mp4", "audio/ogg"],
        maximumSizeInBytes: maxBytes,
        addRandomSuffix: false,
        allowOverwrite: false,
        tokenPayload: JSON.stringify({ userId: session.sub }),
      };
    },
    // Vercel ishlab chiqarishda yuklash tugagach webhook chaqiradi — qo'shimcha ish shart emas
    onUploadCompleted: async () => {},
  });

  // @vercel/blob klienti javobni o'z formatida kutadi — ok() o'ramisiz qaytariladi
  return NextResponse.json(json, { headers: { "cache-control": "private, no-store" } });
});
