import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { uid } from "@/lib/utils";
import { uploadDir } from "@/lib/uploads";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Oddiy rasm yuklash — fayl UPLOAD_DIR (default: public/uploads) ichiga yoziladi.
 * Railway'da UPLOAD_DIR=/data/uploads (Volume) — fayllar /uploads/<nom> orqali
 * src/app/uploads/[name]/route.ts tomonidan beriladi.
 */
export const POST = handler(async (req) => {
  await requireSession();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Fayl topilmadi");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Fayl 5 MB dan katta");

  const ext = ALLOWED[file.type];
  if (!ext) throw new ApiError(415, "Faqat JPG, PNG, WEBP yoki GIF");

  const name = `${uid()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  // Vercel: diskka yozib bo'lmaydi — Vercel Blob (BLOB_READ_WRITE_TOKEN avtomatik beriladi)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${name}`, bytes, { access: "public", contentType: file.type, addRandomSuffix: false });
    return ok({ url: blob.url }, { status: 201 });
  }

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return ok({ url: `/uploads/${name}` }, { status: 201 });
});
