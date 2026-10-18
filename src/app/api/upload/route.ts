import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { uid } from "@/lib/utils";
import { uploadDir } from "@/lib/uploads";
import { isR2Enabled, r2Put } from "@/lib/storage/r2";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Fayl boshidagi "sehrli baytlar" bo'yicha haqiqiy turni aniqlaymiz (brauzer bergan MIME'ga ishonmaymiz) */
function sniff(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a")) return { ext: "gif", mime: "image/gif" };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/**
 * Hujjatlar (faqat purpose="attachment" uchun): PDF, DOC (OLE2) va DOCX (ZIP).
 * ZIP/OLE2 konteyner ekani sehrli baytlardan tasdiqlanadi; docx/xlsx/pptx ichidan farqlash uchun
 * konteynerni ochmaymiz — yorliq (kengaytma) foydalanuvchi bergan fayl nomidan olinadi.
 */
function sniffDoc(buf: Buffer, origName: string): { ext: string; mime: string } | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return { ext: "pdf", mime: "application/pdf" };
  const lower = origName.toLowerCase();
  // ZIP: oddiy (PK\x03\x04) yoki bo'sh arxiv (PK\x05\x06) imzosi
  const isZip = buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && ((buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06));
  if (isZip && lower.endsWith(".docx")) return { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (isZip && lower.endsWith(".zip")) return { ext: "zip", mime: "application/zip" };
  const isOle = buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (isOle && lower.endsWith(".doc")) return { ext: "doc", mime: "application/msword" };
  return null;
}

/**
 * Video (faqat purpose="attachment"): MP4/MOV — ISO-BMFF "ftyp", WebM — EBML sarlavhasi.
 * Asosiy yo'l — brauzerdan Blob'ga to'g'ridan-to'g'ri (/api/upload/video); bu yerda dev/fallback uchun.
 */
function sniffVideo(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand.startsWith("qt")) return { ext: "mov", mime: "video/quicktime" };
    return { ext: "mp4", mime: "video/mp4" };
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: "webm", mime: "video/webm" };
  return null;
}

/** Ovozli xabar (purpose="voice"): WebM/Opus (EBML) → .weba, MP4/M4A (ftyp) → .m4a, Ogg/Opus → .ogg — audio kengaytma bilan saqlanadi */
function sniffAudio(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: "weba", mime: "audio/webm" };
  if (buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") return { ext: "m4a", mime: "audio/mp4" };
  if (buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  return null;
}

/**
 * Rasm (va buyurtma biriktirmasi sifatida hujjat, chatda ovozli xabar) yuklash. Saqlash tanlovi (ustuvorlik):
 *  1) Cloudflare R2 (barcha R2_* env'lar to'liq — src/lib/storage/r2.ts) → URL: R2_PUBLIC_BASE/uploads/<nom>
 *  2) Vercel Blob (BLOB_READ_WRITE_TOKEN bor)
 *  3) lokal disk: UPLOAD_DIR (default: public/uploads) — fayllar /uploads/<nom> orqali
 *     src/app/uploads/[name]/route.ts tomonidan beriladi (Railway'da UPLOAD_DIR=/data/uploads Volume).
 * Kvota: foydalanuvchi boshiga 30 ta fayl / kun (rate_limits). Har yuklash audit jurnaliga yoziladi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();

  // Butun tanani xotiraga o'qishdan OLDIN Content-Length bo'yicha rad etamiz (multipart sarlavhalari uchun ~64 KB zaxira).
  // Content-Length yo'q (masalan, Transfer-Encoding: chunked) bo'lsa — rad etamiz: aks holda chegarasiz
  // tanani formData() xotiraga yuklab, OOM/DoS qilish mumkin edi. Brauzerlar FormData'da doim Content-Length yuboradi.
  const clHeader = req.headers.get("content-length");
  const declared = clHeader === null ? NaN : Number(clHeader);
  if (!Number.isFinite(declared)) throw new ApiError(411, "Content-Length sarlavhasi talab qilinadi");
  if (declared > MAX_BYTES + 64 * 1024) throw new ApiError(413, "Fayl 5 MB dan katta");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Fayl topilmadi");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Fayl 5 MB dan katta");

  const bytes = Buffer.from(await file.arrayBuffer());
  // purpose="attachment" (buyurtma/chat fayllari) hujjatlarga ham ruxsat beradi; "voice" — faqat audio (alohida kvota);
  // qolgan joylar (avatar, portfolio, sharh) — faqat rasm
  const purpose = form?.get("purpose");
  const voice = purpose === "voice";
  const allowDocs = purpose === "attachment";
  await enforceLimit(voice ? "voice" : "upload", session.sub);
  const kind = voice ? sniffAudio(bytes) : (sniff(bytes) ?? (allowDocs ? (sniffDoc(bytes, file.name || "") ?? sniffVideo(bytes)) : null));
  if (!kind) throw new ApiError(415, voice ? "Ovozli xabar formati qo'llab-quvvatlanmaydi (WebM/Opus, M4A yoki Ogg)" : allowDocs ? "Faqat rasm (JPG, PNG, WEBP, GIF), hujjat (PDF, DOC, DOCX, ZIP) yoki video (MP4, WebM, MOV)" : "Faqat JPG, PNG, WEBP yoki GIF");

  const name = `${uid()}.${kind.ext}`;

  // Saqlash tanlovi (ustuvorlik): Cloudflare R2 (barcha R2_* env'lar to'liq) → Vercel Blob → lokal disk
  if (isR2Enabled()) {
    const url = await r2Put(`uploads/${name}`, bytes, kind.mime);
    await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: bytes.length, mime: kind.mime, storage: "r2" } }, req);
    return ok({ url }, { status: 201 });
  }

  // Vercel: diskka yozib bo'lmaydi — Vercel Blob (BLOB_READ_WRITE_TOKEN avtomatik beriladi)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${name}`, bytes, { access: "public", contentType: kind.mime, addRandomSuffix: false });
    await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: bytes.length, mime: kind.mime, storage: "blob" } }, req);
    return ok({ url: blob.url }, { status: 201 });
  }

  // Vercel'da Blob ulanmagan bo'lsa diskka yozib bo'lmaydi
  if (process.env.VERCEL) {
    throw new ApiError(503, "Rasm yuklash hali sozlanmagan (Vercel → Storage → Blob). Hozircha rasm havolasini (URL) kiriting.");
  }

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  await audit(session.sub, "upload", { targetType: "file", targetId: name, meta: { size: bytes.length, mime: kind.mime, storage: "disk" } }, req);
  // Nisbiy yo'l saqlanadi — domen/protokol o'zgarsa ham rasm ishlayveradi
  return ok({ url: `/uploads/${name}` }, { status: 201 });
});
