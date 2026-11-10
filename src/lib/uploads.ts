import path from "node:path";

/** Yuklangan fayllar papkasi: UPLOAD_DIR (Railway Volume: /data/uploads) yoki public/uploads */
export function uploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

/**
 * O'Z Vercel Blob do'konimiz xosti — TAXMIN (7-audit, past daraja). Token ko'rinishi `vercel_blob_rw_<storeId>_<sir>`,
 * ommaviy manzil `https://<storeId>.public.blob.vercel-storage.com/…` (@vercel/blob `parseStoreIdFromReadWriteToken`).
 * Token yo'q (lokal disk / R2) yoki ko'rinishi boshqacha — null. Faqat haqiqiy yuklama bilan TASDIQLANGACH ishlatiladi
 * (`api/orders/_lib/attachments.ts`) — token formati o'zgarsa yuklashlar to'xtab qolmasin.
 */
export function ownBlobHost(): string | null {
  const id = (process.env.BLOB_READ_WRITE_TOKEN ?? "").split("_")[3]?.trim().toLowerCase();
  return id && /^[a-z0-9-]+$/.test(id) ? `${id}.public.blob.vercel-storage.com` : null;
}

/** Manzil Vercel Blob ommaviy do'konida bo'lsa — xosti (kichik harfda), aks holda null */
export function blobHostOf(url: string): string | null {
  return /^https:\/\/([a-z0-9-]+\.public\.blob\.vercel-storage\.com)\//i.exec(url)?.[1]?.toLowerCase() ?? null;
}
