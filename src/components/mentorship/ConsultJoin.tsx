"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { Video } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const CallRoom = lazy(() => import("@/components/call/CallRoom"));

/** 1:1 konsultatsiyaga kirish: boshlanishidan 10 daqiqa oldin tugma ochiladi, vaqt tugagach yopiladi */
export function ConsultJoin({ id, startsAt, durationMin, title }: { id: string; startsAt: number; durationMin: number; title: string }) {
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const opensAt = startsAt - 10 * 60_000;
  const endsAt = startsAt + (durationMin + 15) * 60_000;
  const state = !now ? "wait" : now < opensAt ? "early" : now > endsAt ? "over" : "live";
  return (
    <>
      {state === "live" ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-accent inline-flex h-12 items-center gap-2 px-7 text-[15px] font-semibold">
          <Video size={18} /> Konsultatsiyaga kirish
        </button>
      ) : (
        <p className="rounded-[12px] bg-surface-2 px-4 py-3 text-[14px] text-fg-2">
          {state === "over" ? "Konsultatsiya vaqti tugagan." : state === "early" ? `Tugma ${formatDateTime(opensAt)} dan ochiladi (boshlanishiga 10 daqiqa qolganda).` : "…"}
        </p>
      )}
      {open && (
        <Suspense fallback={null}>
          <CallRoom target={{ kind: "consult", id }} title={title} startWithVideo onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
