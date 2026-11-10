import "server-only";
import { MAINTENANCE_OFF, readSiteNotice, type MaintenanceSetting, type SiteBannerSetting } from "@/lib/payments/settings";

/**
 * SAYT E'LONI + TEXNIK ISHLAR — keshlangan o'qish (2026-11-10).
 *
 * Bu ikki sozlama HAR sahifada (layout: e'lon chizig'i) va HAR mutatsiyada (handler(): texnik ishlar to'sig'i) kerak —
 * shuning uchun bazaga har so'rovda borilmaydi: xotiradagi kesh, TTL 15 s (har server nusxasida alohida). Admin
 * saqlaganda o'z nusxasidagi kesh darhol yangilanadi (`invalidateSiteNotice`), qolgan nusxalar ≤15 s da yetib oladi.
 *
 * Xavfsiz tomon: baza javob bermasa oxirgi ma'lum holat (bo'lmasa «e'lon yo'q, texnik ishlar o'chiq») qaytadi —
 * sozlamani o'qib bo'lmagani uchun sayt yozishga yopilib qolmasligi kerak.
 */
export interface SiteNotice {
  banner: SiteBannerSetting | null;
  maintenance: MaintenanceSetting;
}

export const SITE_NOTICE_TTL_MS = 15_000;
/** Baza xatosidan keyin qayta urinishgacha (har so'rovda yiqilgan bazaga urilmaslik uchun) */
const ERROR_RETRY_MS = 5_000;

interface Slot {
  value: SiteNotice;
  /** Shu vaqtgacha yangi deb hisoblanadi */
  freshUntil: number;
  inflight: Promise<SiteNotice> | null;
}
const EMPTY: SiteNotice = { banner: null, maintenance: { ...MAINTENANCE_OFF } };
// Dev HMR'da modul qayta yuklanadi — kesh globalda (db/index.ts naqshi)
const g = globalThis as { __keSiteNotice?: Slot };
const slot: Slot = (g.__keSiteNotice ??= { value: EMPTY, freshUntil: 0, inflight: null });

export async function getSiteNotice(): Promise<SiteNotice> {
  const now = Date.now();
  if (now < slot.freshUntil) return slot.value;
  // Bir vaqtda kelgan so'rovlar bitta o'qishni kutadi
  slot.inflight ??= readSiteNotice()
    .then((v) => {
      slot.value = v;
      slot.freshUntil = Date.now() + SITE_NOTICE_TTL_MS;
      return v;
    })
    .catch((e) => {
      console.error("[site-notice] o'qib bo'lmadi — oxirgi ma'lum holat ishlatiladi", e instanceof Error ? e.message : e);
      slot.freshUntil = Date.now() + ERROR_RETRY_MS;
      return slot.value;
    })
    .finally(() => {
      slot.inflight = null;
    });
  return slot.inflight;
}

/** Admin saqlagandan keyin: shu nusxadagi kesh darhol yangilanadi (yangi qiymat berilsa — bazaga qayta borilmaydi) */
export function invalidateSiteNotice(next?: Partial<SiteNotice>): void {
  if (next) {
    slot.value = { ...slot.value, ...next };
    slot.freshUntil = Date.now() + SITE_NOTICE_TTL_MS;
  } else {
    slot.freshUntil = 0;
  }
}

/** Hozir ko'rsatiladigan e'lon: muddati o'tgan bo'lsa — yo'q */
export function activeBanner(notice: SiteNotice, now = Date.now()): SiteBannerSetting | null {
  const b = notice.banner;
  if (!b || !b.textUz) return null;
  if (b.until != null && b.until <= now) return null;
  return b;
}
