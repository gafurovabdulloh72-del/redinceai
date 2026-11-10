import { NextResponse } from "next/server";

/**
 * Sayt ICHIDAGI manzilga yo'naltirish — NISBIY `Location` bilan (2026-11-10, sayt QA topilmasi).
 *
 * Ilgari manzil `new URL(path, req.nextUrl.origin)` bilan tuzilardi. O'z serverimizda (Docker/Caddy, `next start`) bu origin
 * `http://localhost:3000` bo'lib chiqadi — brauzer foydalanuvchini mavjud bo'lmagan localhost'ga yuborardi (dars videosi,
 * yopiq fayllar, til almashtirish, Google bilan kirishdan qaytish, eskirgan sessiya). Nisbiy manzilni brauzer O'ZI ochgan
 * domenga nisbatan hal qiladi — proksi/host sozlamasiga bog'liq emas va ochiq redirect ham bo'la olmaydi.
 * `path` — faqat `/…` (boshqa narsa berilsa bosh sahifa).
 */
export function redirectTo(path: string, status: 302 | 303 | 307 = 307, headers: Record<string, string> = {}): NextResponse {
  const safe = path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/";
  return new NextResponse(null, { status, headers: { Location: safe, ...headers } });
}
