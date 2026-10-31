/**
 * Admin uchun majburiy 2FA (3-audit, 2026-10-31). Env `ADMIN_REQUIRE_2FA=1` bo'lsa, 2FA yoqmagan admin admin panel
 * sahifalari, admin API'lari (`requireSession(["admin"])`) va Telegram admin boti amallaridan foydalana olmaydi —
 * faqat 2FA'ni yoqishga yo'naltiriladi (oddiy kabinet va 2FA sozlash ochiq qoladi).
 * Standart: O'CHIQ — avval barcha adminlar 2FA'ni yoqsin, keyin env qo'yiladi (aks holda o'zingizni qulflab qo'yasiz).
 * Bog'liqliksiz modul: api.ts, auth.ts va sahifalardan aylanma importsiz chaqiriladi.
 */
export const adminTwoFactorRequired = (): boolean => process.env.ADMIN_REQUIRE_2FA === "1";
export const ADMIN_2FA_MESSAGE = "Admin uchun ikki bosqichli himoya majburiy — Kabinet → Xavfsizlik bo'limida 2FA'ni yoqing";
export const ADMIN_2FA_PATH = "/kabinet/xavfsizlik?admin2fa=1";
