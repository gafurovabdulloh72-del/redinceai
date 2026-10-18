"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Nomzod o'z arizasini qaytarib oladi (faqat hali qaror qilinmagan holatda) */
export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/arizalar/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Bajarilmadi");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bajarilmadi");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[12.5px]">
      {confirm ? (
        <span className="expand-in inline-flex items-center gap-2" role="group" aria-label="Arizani qaytarib olishni tasdiqlang">
          <span className="text-fg-2">Qaytarib olinsinmi?</span>
          <button type="button" onClick={go} disabled={busy} className="press font-semibold text-danger-text underline-offset-2 hover:underline disabled:opacity-50">
            Ha
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="press text-fg-3 hover:text-fg">
            Yo&apos;q
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="press font-semibold text-fg-3 underline-offset-2 hover:text-danger-text hover:underline">
          Qaytarib olish
        </button>
      )}
      {error && (
        <span role="alert" className="text-danger-text">
          {error}
        </span>
      )}
    </span>
  );
}
