import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { uid } from "@/lib/utils";
import { uploadDir } from "@/lib/uploads";
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
 * Oddiy rasm yuklash — fayl UPLOAD_DIR (default: public/uploads) ichiga yoziladi.
 * Railway'da UPLOAD_DIR=/data/uploads (Volume) — fayllar /uploads/<nom> orqali
 * src/app/uploads/[name]/route.ts tomonidan beriladi.
 * Kvota: foydalanuvchi boshiga 30 ta fayl / kun (rate_limits). Har yuklash audit jurnaliga yoziladi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("upload", session.sub);

  // Butun tanani xotiraga o'qishdan OLDIN Content-Length bo'yicha rad etamiz (multipart sarlavhalari uchun ~64 KB zaxira);
  // quyidagi file.size tekshiruvi asosiy bo'lib qolaveradi
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES + 64 * 1024) throw new ApiError(413, "Fayl 5 MB dan katta");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Fayl topilmadi");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Fayl 5 MB dan katta");

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) throw new ApiError(415, "Faqat JPG, PNG, WEBP yoki GIF");

  const name = `${uid()}.${kind.ext}`;

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
