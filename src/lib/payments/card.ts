/**
 * Karta raqami tekshiruvi — mijoz (jonli ko'rsatkich) va server (saqlashdan oldin) uchun umumiy.
 * "Avtomatik tekshirish": Luhn nazorat raqami + BIN bo'yicha tizim (Uzcard/Humo/Visa/…) aniqlanadi.
 * Bank tomonidagi haqiqiy tekshiruv (karta egasi, faol-faolmas) faqat to'lov provayderi API'si bilan
 * bo'ladi — Payme/Click merchant shartnomasi ulangandan keyin shu modul ustiga qo'shiladi.
 */

export type CardBrand = "uzcard" | "humo" | "visa" | "mastercard" | "unionpay" | "mir";

export const CARD_BRAND_LABEL: Record<CardBrand, string> = {
  uzcard: "Uzcard",
  humo: "Humo",
  visa: "Visa",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  mir: "Mir",
};

/** Faqat raqamlar (bo'shliq/defislar olib tashlanadi) */
export function cardDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/** "8600123412341234" → "8600 1234 1234 1234" */
export function formatCard(input: string): string {
  return cardDigits(input).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** BIN bo'yicha tizim: O'zbekiston kartalari (8600 — Uzcard, 9860 — Humo) birinchi tekshiriladi */
export function cardBrand(input: string): CardBrand | null {
  const d = cardDigits(input);
  if (d.startsWith("8600") || d.startsWith("5614")) return "uzcard";
  if (d.startsWith("9860")) return "humo";
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^62/.test(d)) return "unionpay";
  if (/^22[0-4]/.test(d)) return "mir";
  return null;
}

/** Luhn nazorat raqami — terishdagi xatoni (raqam almashgan/noto'g'ri) avtomatik ushlaydi */
export function luhnValid(input: string): boolean {
  const d = cardDigits(input);
  if (d.length < 12) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export interface CardCheck {
  ok: boolean;
  /** ok=false bo'lsa — foydalanuvchiga ko'rsatiladigan sabab */
  error?: string;
  brand: CardBrand | null;
  digits: string;
}

/** To'liq tekshiruv: uzunlik (16, UnionPay 16–19) + Luhn + tizim */
export function checkCard(input: string): CardCheck {
  const digits = cardDigits(input);
  const brand = cardBrand(digits);
  if (digits.length === 0) return { ok: false, error: "Karta raqamini kiriting", brand, digits };
  if (digits.length < 16) return { ok: false, error: "Karta raqami 16 raqamdan iborat bo'lishi kerak", brand, digits };
  if (digits.length > 19 || (digits.length > 16 && brand !== "unionpay")) {
    return { ok: false, error: "Karta raqami juda uzun", brand, digits };
  }
  if (!luhnValid(digits)) return { ok: false, error: "Karta raqamida xatolik bor — qayta tekshiring (nazorat raqami mos emas)", brand, digits };
  return { ok: true, brand, digits };
}
