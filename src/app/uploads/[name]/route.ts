import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { uploadDir } from "@/lib/uploads";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
/** Hujjatlar inline ochilmaydi — faqat yuklab olish (brauzer plagini orqali ijro bo'lmasin) */
const DOWNLOAD = new Set(["pdf", "doc", "docx"]);

/**
 * UPLOAD_DIR ichidagi fayllarni beradi (public/ tashqarisidagi Volume uchun).
 * Dev'da public/uploads mavjud bo'lsa Next uni o'zi beradi — bu route faqat qolgan hollarda ishlaydi.
 * Xavfsizlik: nom qat'iy regex bilan (path traversal yo'q), nosniff + inline (brauzer faylni
 * skript/HTML deb talqin qilmaydi), rasm MIME'lari inline, hujjatlar (PDF/DOC/DOCX) attachment sifatida.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[\w-]+\.(jpe?g|png|webp|gif|pdf|docx?)$/i.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(uploadDir(), name);
  try {
    const s = await stat(file);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    const ext = name.split(".").pop()!.toLowerCase();
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Length": String(s.size),
        "Content-Disposition": `${DOWNLOAD.has(ext) ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
