"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, X } from "lucide-react";

/** Yopilganini eslab qolish kaliti (shu brauzerda qayta chiqmaydi) */
const DISMISS_KEY = "tg-nudge-yopildi";

/**
 * Eslatma: Telegram ulanmagan bo'lsa yangi buyurtma/javob/e'lon xabarini o'tkazib yuborishi mumkin.
 * Server (kabinet layout) faqat bot sozlangan va hisob ulanmagan bo'lsa render qiladi;
 * foydalanuvchi yopsa — localStorage orqali shu brauzerda boshqa chiqmaydi.
 * `forClient` — mijozga mos matn (mutaxassisnikida "yangi buyurtma" urg'usi).
 */
export function TelegramNudge({ forClient = false }: { forClient?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  return (
    <div role="status" className="mb-5 flex min-h-12 items-center gap-3 rounded-[16px] border border-line-2 bg-accent-soft/60 px-4 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        <Send size={15} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-fg">
        <strong className="font-bold">{forClient ? "Muhim xabarni o'tkazib yubormang." : "Yangi buyurtmani o'tkazib yubormang."}</strong>{" "}
        <span className="text-fg-2">
          {forClient ? "Buyurtmangiz holati, mutaxassis javoblari va e'lonlar Telegramga darhol keladi." : "Mijoz buyurtma yuborganida bot sizga Telegramda darhol yozadi."}
        </span>
      </p>
      <Link
        href="/kabinet/profil#telegram"
        className="inline-flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-ink-fg transition hover:opacity-90"
      >
        Ulash
      </Link>
      <button
        type="button"
        aria-label="Eslatmani yopish"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* maxfiy rejim — shunchaki yopiladi */
          }
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
