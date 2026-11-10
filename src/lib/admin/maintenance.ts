import "server-only";
import { MAINTENANCE } from "@/lib/i18n/dict/system";
import { getSiteNotice } from "./site-notice";

/**
 * TEXNIK ISHLAR («faqat o'qish») REJIMI (2026-11-10).
 *
 * Admin panel → Tizim → «Texnik ishlar rejimi» yoqilganda admin bo'lmagan foydalanuvchilarning o'zgartirishlari
 * (POST/PUT/PATCH/DELETE) to'xtatiladi — migratsiya, to'lov provayderini almashtirish yoki nosozlik paytida.
 * O'qish (GET) ishlayveradi, sayt tepasida ogohlantirish chizig'i ko'rinadi, adminlar to'liq ishlaydi.
 *
 * To'siqning o'zi `handler()` (lib/api.ts) ichida — bu modul faqat holatni beradi:
 *
 *   const m = await maintenanceState();              // kesh ≤15 s, hech qachon xato tashlamaydi
 *   if (m.on && !maintenanceExempt(pathname) && session?.role !== "admin") throw new ApiError(503, m.message[til]);
 *
 * Aylanma import yo'q: bu modul `lib/api.ts`ni import qilmaydi.
 */
export interface MaintenanceState {
  on: boolean;
  /** 503 javobida foydalanuvchiga ko'rsatiladigan xabar (admin o'z matnini yozgan bo'lsa — o'sha) */
  message: { uz: string; ru: string };
}

const OFF: MaintenanceState = { on: false, message: { uz: MAINTENANCE.api.uz, ru: MAINTENANCE.api.ru } };

export async function maintenanceState(): Promise<MaintenanceState> {
  try {
    const { maintenance: m } = await getSiteNotice();
    if (!m.on) return OFF;
    // Admin matni bitta tilda yozilgan bo'lsa ikkinchi tilga standart matn (aralash til chiqmasin)
    return { on: true, message: { uz: m.messageUz || MAINTENANCE.api.uz, ru: m.messageRu || MAINTENANCE.api.ru } };
  } catch {
    // Xavfsiz tomon: holatni bilib bo'lmasa sayt yopilmaydi
    return OFF;
  }
}

/**
 * Texnik ishlar paytida ham ISHLASHI SHART bo'lgan API yo'llari:
 *  · /api/auth/…   — kirish/chiqish/2FA/parol tiklash: aks holda chiqib ketgan admin qayta kira olmaydi (rejimni o'chirib bo'lmaydi);
 *  · /api/tg/auth  — Mini App kirishi (admin Telegram ichidan kirsa);
 *  · /api/admin/…  — admin API'lari (baribir faqat admin); sessiya tekshiruvi kechiksa ham rejimni o'chirish yo'li ochiq qolsin;
 *  · /api/xato     — brauzer xato hisobotlari (nosozlik paytida aynan shular kerak);
 *  · /api/til      — til almashtirish (faqat cookie yozadi).
 * Tashqi webhook'lar (Payme/Click/Telegram — `handler(fn, { csrf: false })`) va cron `handler()`dan o'tmaydi yoki
 * to'siqdan oldin ajratiladi: to'lov tasdig'i texnik ishlar paytida ham yo'qolmasligi kerak.
 */
const EXEMPT_PREFIXES = ["/api/auth", "/api/tg/auth", "/api/admin", "/api/xato", "/api/til"] as const;

/** `pathname` — so'rov yo'li (query'siz): `new URL(req.url).pathname` */
export function maintenanceExempt(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "");
  return EXEMPT_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}
