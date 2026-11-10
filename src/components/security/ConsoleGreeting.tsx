"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";

/**
 * BRAUZER KONSOLIDAGI OGOHLANTIRISH (2026-11-10) — ikki maqsad:
 *  1) Self-XSS himoyasi (Facebook/Discord naqshi): firibgar «F12 bosib mana bu kodni joylang» desa, foydalanuvchi
 *     konsolda katta «To'xtang!» ogohlantirishini ko'radi — kod joylash hisobni o'g'irlatadi.
 *  2) Haker/tadqiqotchiga hazil aralash iltimos: buzmang, kamchilik bo'lsa /xavfsizlik orqali yozing.
 * Server DOM'iga tegmaydi; har sahifa yuklanishida bir marta (window bayrog'i — SPA o'tishlarida takrorlanmaydi).
 */
export function ConsoleGreeting() {
  const til = useLocale();
  useEffect(() => {
    const w = window as unknown as { __keGreeted?: boolean };
    if (w.__keGreeted) return;
    w.__keGreeted = true;
    const ru = til === "ru";
    try {
      console.log(`%c${ru ? "Стоп!" : "To'xtang!"}`, "font:800 44px system-ui,sans-serif;color:#ff5a36;-webkit-text-stroke:1px #1a1a1c");
      console.log(
        `%c${
          ru
            ? "Это окно для разработчиков. Если кто-то попросил вас вставить сюда код — это мошенничество: так крадут аккаунты. Ничего не вставляйте."
            : "Bu oyna dasturchilar uchun. Kimdir sizdan bu yerga kod joylashni so'ragan bo'lsa — bu firibgarlik: hisoblar shunday o'g'irlanadi. Hech narsa joylamang."
        }`,
        "font:600 15px/1.5 system-ui,sans-serif;color:#1a1a1c;background:#f6f4ee;padding:6px 10px;border-radius:8px",
      );
      console.log(
        `%c${
          ru
            ? "А если вы хакер 👋 — пожалуйста, не взламывайте нас 🙏 Нашли уязвимость? Напишите: /xavfsizlik — скажем спасибо (и чай с нас ☕)."
            : "Agar haker bo'lsangiz 👋 — iltimos, bizni buzib kirmang 🙏 Kamchilik topdingizmi? Yozing: /xavfsizlik — rahmat aytamiz (choy ham bizdan ☕)."
        }`,
        "font:500 13px/1.5 system-ui,sans-serif;color:#8a8a8f",
      );
    } catch {
      /* konsol yopiq/bloklangan — jim */
    }
  }, [til]);
  return null;
}
