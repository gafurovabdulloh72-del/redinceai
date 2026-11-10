import "server-only";
import { after } from "next/server";

/**
 * Og'ir ishni webhook javobidan KEYIN bajarish (Next `after()`): fayl yuklab olish, ommaviy yuborish, ko'p xabarli
 * ro'yxatlar. Telegram javobni tez oladi — handler uzoq ishlasa u update'ni qayta yuborardi (ikki marta post, takror javob).
 * So'rov kontekstidan tashqarida (cron, skript) — oddiy fon promise. Xato faqat logga yoziladi.
 */
export function defer(task: () => Promise<unknown>, label = "bot"): void {
  const run = () => Promise.resolve().then(task).catch((e) => console.error(`[telegram:${label}]`, e));
  try {
    after(run);
  } catch {
    void run();
  }
}
