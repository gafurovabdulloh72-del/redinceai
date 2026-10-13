import type { FileAttachment } from "@/lib/db/schema";

/**
 * Biriktirmalar (buyurtma, chat xabari, sharh rasmlari) — klient va server uchun umumiy sof yordamchilar.
 * Fayllar faqat /api/upload orqali yuklanadi (hozircha rasm: JPG/PNG/WEBP/GIF, 5 MB gacha):
 *  - disk:  /uploads/<uuid>.<ext>
 *  - Vercel Blob: https://<store>.public.blob.vercel-storage.com/uploads/<uuid>.<ext>
 * Boshqa tashqi havolalar biriktirma sifatida qabul qilinmaydi (kuzatuv pikseli / fishing havolasi bo'lmasin).
 */
export type Attachment = FileAttachment;

/** Buyurtma formasida va bitta chat xabarida */
export const MAX_ATTACHMENTS = 5;
/** Buyurtmaga jami (keyin qo'shilganlari bilan) */
export const MAX_ORDER_ATTACHMENTS = 15;
/** Sharh rasmlari */
export const MAX_REVIEW_MEDIA = 4;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export const UPLOAD_URL_RE = /^(?:\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif))$/i;

const EXT_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/** URL kengaytmasidan haqiqiy tur (mijoz bergan `type`ga ishonmaymiz) */
export function mimeFromUrl(url: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(url);
  return m ? (EXT_MIME[m[1].toLowerCase()] ?? null) : null;
}

/** Fayl nomi URL'dan: /uploads/<nom> — upload audit yozuvidagi targetId bilan bir xil */
export function uploadName(url: string): string {
  return url.slice(url.lastIndexOf("/") + 1);
}

export function isImageAttachment(a: Pick<Attachment, "url" | "type">): boolean {
  return a.type.startsWith("image/") || /\.(?:jpe?g|png|webp|gif)$/i.test(a.url);
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

type UploadResponse = { ok: true; data: { url: string } } | { ok: false; error: string };

/** Brauzerda: faylni /api/upload ga yuborib, biriktirma obyektini qaytaradi (xato bo'lsa Error tashlaydi) */
export async function uploadAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`«${file.name}» 5 MB dan katta`);
  if (!/^image\/(?:jpeg|png|webp|gif)$/.test(file.type)) throw new Error(`«${file.name}»: hozircha faqat JPG, PNG, WEBP yoki GIF rasm yuklanadi`);
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = (await res.json().catch(() => null)) as UploadResponse | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.error);
  return { url: json.data.url, name: file.name.slice(0, 120) || "rasm", size: file.size, type: mimeFromUrl(json.data.url) ?? file.type };
}
