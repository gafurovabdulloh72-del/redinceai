"use client";

import { useEffect } from "react";

/**
 * Saqlanmagan o'zgarishlar himoyasi: forma «iflos» (dirty) bo'lsa, brauzer yopilishi / sahifani yangilash /
 * tashqi havolaga o'tishda standart «O'zgarishlar saqlanmagan» dialogi chiqadi (`beforeunload`).
 * Next.js ichki navigatsiyasini to'xtatmaydi — u uchun forma pastidagi «hali saqlanmagan» holati qoladi.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Eski brauzerlar uchun (matn ko'rsatilmaydi, lekin dialog chiqishi uchun kerak)
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [dirty]);
}
