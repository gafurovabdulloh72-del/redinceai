"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Payme/Click'dan qaytgach hisob holatini kuzatish: provayder webhook'i (Perform/Complete) biroz kechikishi mumkin.
 * Har 4 soniyada GET /api/subscription/invoices/[id]; holat o'zgarsa — sahifa yangilanadi. 2 daqiqadan keyin to'xtaydi.
 */
export function InvoiceStatusWatcher({ invoiceId, state }: { invoiceId: string; state: string }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      if (stopped || tries++ > 30) return;
      try {
        const res = await fetch(`/api/subscription/invoices/${encodeURIComponent(invoiceId)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { ok: boolean; data?: { state: string } } | null;
        if (json?.ok && json.data && json.data.state !== state) {
          router.refresh();
          return;
        }
      } catch {
        /* tarmoq — keyingi urinish */
      }
      if (!stopped) timer = window.setTimeout(tick, 4000);
    };
    let timer = window.setTimeout(tick, 3000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [invoiceId, state, router]);
  return null;
}
