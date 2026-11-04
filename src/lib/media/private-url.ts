import type { FileAttachment } from "@/lib/db/schema";

/**
 * Yopiq fayllar uchun imzolangan manzil (5-audit, 2026-11-04, 24-band «imzolangan fayl URL'lari»).
 *
 * Vercel Blob store ommaviy (rejimi o'zgarmaydi), shuning uchun himoya = xom saqlash manzilini mijozga HECH QACHON
 * bermaslik. Bazada URL xom turadi; klientga ketadigan DTO'da u `/api/media/<kind>/<id>` route'iga almashadi:
 * route ruxsatni tekshiradi (suhbat ishtirokchisi / jamoa a'zosi / buyurtma tomoni / kursga yozilgan / admin) va
 * 15 daqiqalik, sessiyaga bog'langan token bilan `…/stream?t=` ga 302 qiladi; `/stream` faylni server orqali oqimlaydi.
 *
 * Fayl identifikatori: `<egaId>_<indeks>` (xabar/buyurtma/dars id + biriktirma indeksi; `_p` — video muqovasi).
 * Egalar id'si UUID yoki `sub_…` — `_` oxirgi ajratgich sifatida o'qiladi. Biriktirmalar ro'yxati faqat butunlay
 * o'chiriladi (DM/guruh) yoki oxiriga qo'shiladi (buyurtma), shuning uchun indeks barqaror; dars materiallari
 * tahrirda almashsa havolalar sahifa qayta ochilganda yangilanadi (token baribir 15 daqiqa).
 *
 * Bu fayl DB'siz — DTO quruvchilar (dm.ts, groups/service.ts, …) aylanma importsiz foydalanadi.
 */
export type PrivateFileKind = "dm" | "group" | "order" | "orderfile" | "material" | "receipt";
export const PRIVATE_FILE_KINDS: readonly PrivateFileKind[] = ["dm", "group", "order", "orderfile", "material", "receipt"];

export const isPrivateFileKind = (k: string): k is PrivateFileKind => (PRIVATE_FILE_KINDS as readonly string[]).includes(k);

export function privateFileUrl(kind: PrivateFileKind, id: string): string {
  return `/api/media/${kind}/${encodeURIComponent(id)}`;
}

/** Biriktirma id'si: `<egaId>_<indeks>` (+`_p` muqova) */
export const attachmentFileId = (ownerId: string, index: number, poster = false) => `${ownerId}_${index}${poster ? "_p" : ""}`;

/** Route id'sini ajratish; mos kelmasa null (chek uchun id = hisob id'si, indekssiz) */
export function parseAttachmentFileId(id: string): { ownerId: string; index: number; poster: boolean } | null {
  const m = /^(.+)_(\d{1,2})(_p)?$/.exec(id);
  if (!m) return null;
  return { ownerId: m[1], index: Number(m[2]), poster: Boolean(m[3]) };
}

/** Xom URL allaqachon route bo'lsa (ikki marta o'rash xatosi) — tegilmaydi */
const isRoute = (u: string) => u.startsWith("/api/media/");

/**
 * Biriktirmalar ro'yxatini klientga xavfsiz ko'rinishga o'tkazish: `url` (va `poster`) xom manzil o'rniga route.
 * Boshqa maydonlar (nom, hajm, tur, davomiylik, round) o'zgarmaydi — klient ularga qarab chizadi.
 */
export function protectAttachments<T extends FileAttachment>(kind: PrivateFileKind, ownerId: string, list: readonly T[] | null | undefined): T[] {
  return (list ?? []).map((a, i) => ({
    ...a,
    url: isRoute(a.url) ? a.url : privateFileUrl(kind, attachmentFileId(ownerId, i)),
    ...(a.poster && !isRoute(a.poster) ? { poster: privateFileUrl(kind, attachmentFileId(ownerId, i, true)) } : {}),
  }));
}
