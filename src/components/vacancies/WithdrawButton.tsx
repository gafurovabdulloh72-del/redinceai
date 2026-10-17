"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Nomzod o'z arizasini qaytarib oladi (faqat "yangi" holatda) */
export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await fetch(`/api/arizalar/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return confirm ? (
    <span className="inline-flex items-center gap-2 text-[12.5px]">
      <span className="text-fg-2">Qaytarib olinsinmi?</span>
      <button type="button" onClick={go} disabled={busy} className="font-semibold text-danger-text underline-offset-2 hover:underline">
        Ha
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="text-fg-3 hover:text-fg">
        Yo&apos;q
      </button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} className="text-[12.5px] font-semibold text-fg-3 underline-offset-2 hover:text-danger-text hover:underline">
      Qaytarib olish
    </button>
  );
}
