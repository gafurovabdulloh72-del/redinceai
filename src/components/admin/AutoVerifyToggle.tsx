"use client";

import { useState } from "react";
import { showToast } from "@/components/ui/toast";

/**
 * «Tasdiqlash navbati» tepasidagi kalit: yangi mutaxassislarni avtomatik tasdiqlash.
 * Yoqilganda navbatni kutmasdan profil ochilishi bilan tasdiqlanadi; adminga faqat ma'lumot (Telegramda «Bekor qilish» bilan).
 */
export function AutoVerifyToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setOn(next);
    try {
      const r = await fetch("/api/admin/avto-tasdiq", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: next }) });
      const j = (await r.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Saqlab bo'lmadi");
      showToast(next ? "Avtomatik tasdiqlash yoqildi" : "Avtomatik tasdiqlash o'chirildi");
    } catch (e) {
      setOn(!next);
      showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => void toggle()}
      disabled={busy}
      className="mb-4 flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] border border-line px-4 py-2.5 text-left transition-[border-color,opacity] hover:border-line-2 disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-fg">Yangi mutaxassislarni avtomatik tasdiqlash</span>
        <span className="block text-[12px] text-fg-3">
          {on ? "Yoqilgan — yangi profil ochilishi bilan tasdiqlanadi, sizga faqat xabar keladi" : "O'chiq — har bir yangi profilni shu navbatda qo'lda tasdiqlaysiz"}
        </span>
      </span>
      <span aria-hidden="true" className="switch" aria-checked={on} />
    </button>
  );
}
