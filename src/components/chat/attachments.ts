import type { FileAttachment } from "@/lib/db/schema";

/**
 * Biriktirmalar (buyurtma, chat xabari, sharh rasmlari) — klient va server uchun umumiy sof yordamchilar.
 * Fayllar faqat /api/upload orqali yuklanadi (rasm: JPG/PNG/WEBP/GIF; buyurtma/chat'da hujjat: PDF/DOC/DOCX — 5 MB gacha):
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
/** Video kattaroq bo'ladi — Blob'ga to'g'ridan-to'g'ri (brauzerdan) yuklanadi, server orqali o'tmaydi */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
/** Buyurtma/chat biriktirmalari: rasmlar + hujjatlar (PDF, DOC, DOCX) + video (MP4, WebM, MOV) */
export const UPLOAD_ACCEPT_DOCS = `${UPLOAD_ACCEPT},application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.mp4,.webm,.mov`;

export const UPLOAD_URL_RE = /^(?:\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif|pdf|docx?|mp4|webm|mov)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif|pdf|docx?|mp4|webm|mov))$/i;
/** Faqat rasm (sharh rasmlari, avatar) — hujjat URL o'tmaydi */
export const IMAGE_URL_RE = /^(?:\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif)|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/[\w-]+\.(?:jpe?g|png|webp|gif))$/i;

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

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

export function isVideoAttachment(a: Pick<Attachment, "url" | "type">): boolean {
  return a.type.startsWith("video/") || /\.(?:mp4|webm|mov)$/i.test(a.url);
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

type UploadResponse = { ok: true; data: { url: string } } | { ok: false; error: string };

const VIDEO_EXT_RE = /\.(mp4|webm|mov)$/i;
const VIDEO_MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

/** Oddiy (multipart) yuklash — rasm/hujjat va dev'dagi video fallback */
async function uploadViaApi(file: File, purpose: boolean): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  if (purpose) fd.append("purpose", "attachment");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const json = (await res.json().catch(() => null)) as UploadResponse | null;
  if (!json) throw new Error("Server javob bermadi");
  if (!json.ok) throw new Error(json.error);
  return json.data.url;
}

/**
 * Video: brauzerdan to'g'ridan-to'g'ri Vercel Blob'ga (server tanasi 4.5 MB bilan cheklangani uchun).
 * Blob sozlanmagan muhitda (dev) oddiy /api/upload orqali yuklanadi.
 */
async function uploadVideo(file: File): Promise<string> {
  const ext = (VIDEO_EXT_RE.exec(file.name)?.[1] ?? (file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4")).toLowerCase();
  try {
    const { upload } = await import("@vercel/blob/client");
    const blob = await upload(`uploads/${crypto.randomUUID()}.${ext}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload/video",
      contentType: VIDEO_MIME[ext],
    });
    return blob.url;
  } catch {
    // Blob yo'q (dev) yoki tarmoq uzildi — server orqali (5 MB ichida bo'lsa) urinamiz
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`«${file.name}»: video yuklash xizmati hozircha ulanmagan — 5 MB dan kichik video yuboring`);
    return uploadViaApi(file, true);
  }
}

/** Brauzerda: faylni yuklab, biriktirma obyektini qaytaradi (xato bo'lsa Error tashlaydi) */
export async function uploadAttachment(file: File, opts?: { docs?: boolean }): Promise<Attachment> {
  const isImage = /^image\/(?:jpeg|png|webp|gif)$/.test(file.type);
  const isDoc = /\.(?:pdf|docx?)$/i.test(file.name) || /^application\/(?:pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(file.type);
  const isVideo = VIDEO_EXT_RE.test(file.name) || /^video\/(?:mp4|webm|quicktime)$/.test(file.type);
  if (!isImage && !(opts?.docs && (isDoc || isVideo))) {
    throw new Error(opts?.docs ? `«${file.name}»: faqat rasm (JPG, PNG, WEBP, GIF), hujjat (PDF, DOC, DOCX) yoki video (MP4, WebM, MOV)` : `«${file.name}»: hozircha faqat JPG, PNG, WEBP yoki GIF rasm yuklanadi`);
  }
  if (opts?.docs && isVideo && !isImage) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error(`«${file.name}» 50 MB dan katta`);
    const url = await uploadVideo(file);
    return { url, name: file.name.slice(0, 120) || "video", size: file.size, type: mimeFromUrl(url) ?? file.type };
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`«${file.name}» 5 MB dan katta`);
  const url = await uploadViaApi(file, Boolean(opts?.docs));
  return { url, name: file.name.slice(0, 120) || "rasm", size: file.size, type: mimeFromUrl(url) ?? file.type };
}
