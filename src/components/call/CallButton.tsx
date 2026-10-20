"use client";

import { lazy, Suspense, useState } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";

// Qo'ng'iroq xonasi og'ir (LiveKit SDK) — faqat bosilganda yuklanadi (lazy)
const CallRoom = lazy(() => import("./CallRoom"));

/**
 * Chatdagi «Video qo'ng'iroq» tugmasi. NEXT_PUBLIC_LIVEKIT_URL o'rnatilmagan bo'lsa umuman
 * ko'rinmaydi (Google kirish tugmasi naqshi) — ya'ni server qo'ng'iroqni sozlamaguncha chiqmaydi.
 * Haqiqiy ruxsat serverda (`/api/qongiroq/token`): begona xonaga token berilmaydi.
 */
export function CallButton({ kind, id, title, className }: { kind: "dm" | "group"; id: string; title: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const enabled = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Video qo'ng'iroq"
        title="Video qo'ng'iroq"
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg",
          className,
        )}
      >
        <Video size={17} />
      </button>
      {open && (
        <Suspense fallback={null}>
          <CallRoom target={{ kind, id }} title={title} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
