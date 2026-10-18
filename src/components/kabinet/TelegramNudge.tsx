"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, X } from "lucide-react";

/** Yopilganini eslab qolish kaliti (shu brauzerda qayta chiqmaydi) */
const DISMISS_KEY = "tg-nudge-yopildi";
/** «Keyinroq»: shu vaqtgacha (ms) ko'rsatilmaydi */
const SNOOZE_KEY = "tg-nudge-keyinroq";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Eslatma: Telegram ulanmagan bo'lsa yangi buyurtma/javob/e'lon xabarini o'tkazib yuborishi mumkin.
 * Server (kabinet layout) faqat bot sozlangan va hisob ulanmagan bo'lsa render qiladi;
 * «Keyinroq» — 7 kunga kechiktiradi, «×» — shu brauzerda boshqa chiqmaydi (localStorage).
 * `forClient` — mijozga mos matn (mutaxassisnikida "yangi buyurtma" urg'usi).
 */
export function TelegramNudge({ forClient = false }: { forClient?: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      setVisible(localStorage.getItem(DISMISS_KEY) !== "1" && snoozedUntil < Date.now());
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  const hide = (key: string, value: string) => {
    setVisible(false);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* maxfiy rejim — shunchaki yopiladi */
    }
  };
  return (
    <div role="status" className="expand-in mb-5 flex min-h-12 items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
        <Send size={15} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-fg">
        <strong className="font-semibold">{forClient ? "Muhim xabarni o'tkazib yubormang." : "Yangi buyurtmani o'tkazib yubormang."}</strong>{" "}
        <span className="hidden text-fg-2 sm:inline">{forClient ? "Buyurtma holati va javoblar Telegramga darhol keladi." : "Mijoz buyurtma yuborganida bot darhol yozadi."}</span>
      </p>
      <button type="button" onClick={() => hide(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))} className="hidden h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg sm:inline-flex">
        Keyinroq
      </button>
      <Link href="/kabinet/profil#telegram" className="btn-ink inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold">
        Ulash
      </Link>
      <button type="button" aria-label="Eslatmani yopish" title="Boshqa ko'rsatilmasin" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg" onClick={() => hide(DISMISS_KEY, "1")}>
        <X size={15} />
      </button>
    </div>
  );
}
