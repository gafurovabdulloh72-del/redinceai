"use client";

import { lazy, Suspense, useState } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallStartDetail } from "./CallCenter";

// Guruh qo'ng'iroq xonasi og'ir (LiveKit SDK) — faqat bosilganda yuklanadi (lazy)
const CallRoom = lazy(() => import("./CallRoom"));

/**
 * Chatdagi «Video qo'ng'iroq» tugmasi. NEXT_PUBLIC_LIVEKIT_URL o'rnatilmagan bo'lsa ko'rinmaydi.
 * - DM (1:1): `kasb:call-start` hodisasini yuboradi → global CallCenter chaqiruvni boshlaydi
 *   (qarshi tomonda jiringlash ekrani chiqadi — Telegram uslubi).
 * - Guruh: to'g'ridan-to'g'ri xonaga qo'shiladi (jiringlash yo'q — Telegram guruh qo'ng'irog'i kabi).
 */
export function CallButton({ kind, id, title, className }: { kind: "dm" | "group"; id: string; title: string; className?: string }) {
  const [groupOpen, setGroupOpen] = useState(false);
  const enabled = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  if (!enabled) return null;

  const onClick = () => {
    if (kind === "dm") {
      const detail: CallStartDetail = { conversationId: id, name: title };
      window.dispatchEvent(new CustomEvent("kasb:call-start", { detail }));
    } else {
      setGroupOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Video qo'ng'iroq"
        title="Video qo'ng'iroq"
        className={cn("grid h-9 w-9 place-items-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg", className)}
      >
        <Video size={17} />
      </button>
      {groupOpen && (
        <Suspense fallback={null}>
          <CallRoom target={{ kind: "group", id }} title={title} onClose={() => setGroupOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
