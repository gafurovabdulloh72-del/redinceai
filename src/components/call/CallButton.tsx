"use client";

import { lazy, Suspense, useState } from "react";
import { Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallStartDetail } from "./CallCenter";

// Guruh qo'ng'iroq xonasi og'ir (LiveKit SDK) — faqat bosilganda yuklanadi (lazy)
const CallRoom = lazy(() => import("./CallRoom"));

/**
 * Chatdagi qo'ng'iroq tugmalari: 📞 ovozli (oddiy) + 🎥 video. NEXT_PUBLIC_LIVEKIT_URL yo'q bo'lsa ko'rinmaydi.
 * - DM (1:1): `kasb:call-start` hodisasi (video=true/false) → global CallCenter chaqiruvni boshlaydi
 *   (qarshi tomonda jiringlash ekrani — Telegram uslubi). Qo'ng'iroq ichida kamerani yoqish/o'chirish mumkin.
 * - Guruh: to'g'ridan-to'g'ri xonaga qo'shiladi (jiringlash yo'q — Telegram guruh qo'ng'irog'i kabi).
 */
export function CallButton({ kind, id, title, className }: { kind: "dm" | "group"; id: string; title: string; className?: string }) {
  const [group, setGroup] = useState<null | { video: boolean }>(null);
  const enabled = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  if (!enabled) return null;

  const start = (video: boolean) => {
    if (kind === "dm") {
      const detail: CallStartDetail = { conversationId: id, name: title, video };
      window.dispatchEvent(new CustomEvent("kasb:call-start", { detail }));
    } else {
      setGroup({ video });
    }
  };

  const btn = "grid h-9 w-9 place-items-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg";

  return (
    <>
      <button type="button" onClick={() => start(false)} aria-label="Ovozli qo'ng'iroq" title="Ovozli qo'ng'iroq" className={cn(btn, className)}>
        <Phone size={17} />
      </button>
      <button type="button" onClick={() => start(true)} aria-label="Video qo'ng'iroq" title="Video qo'ng'iroq" className={cn(btn, className)}>
        <Video size={17} />
      </button>
      {group && (
        <Suspense fallback={null}>
          <CallRoom target={{ kind: "group", id }} title={title} startWithVideo={group.video} onClose={() => setGroup(null)} />
        </Suspense>
      )}
    </>
  );
}
