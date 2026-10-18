"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eraser, X } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";

/**
 * Admin: demo (seed) foydalanuvchilari va ularga bog'liq hamma narsani bir tugmada o'chirish.
 * Tugma kichik modal tasdiq oynasini ochadi (Escape yoki fon bosilsa yopiladi) —
 * ikki marta bosib tasodifan o'chirish xavfi yo'q. API haqiqiy havolali seed hisoblarni
 * saqlab qoladi va {deleted, kept} qaytaradi — kept soni muvaffaqiyat xabarida ko'rsatiladi.
 */
export function DemoCleanButton({ count }: { count: number }) {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Modal chiqish animatsiyasi bilan yopiladi (modal-out), darhol o'chmaydi */
  const modal = usePresence(openModal, 200);

  // Escape — modalni yopish (busy paytida yopilmaydi)
  useEffect(() => {
    if (!openModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpenModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openModal, busy]);

  if (count <= 0 && !done) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/demo", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const deleted: number | undefined = json.data?.deleted ?? json.data?.removed;
      const kept: number | undefined = json.data?.kept;
      setDone(`${deleted ?? count} ta demo yozuv o'chirildi${typeof kept === "number" && kept > 0 ? ` · ${kept} tasi saqlab qolindi (haqiqiy havolalari bor)` : ""}`);
      setOpenModal(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "O'chirib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="relative inline-flex flex-col items-end gap-1">
      {count > 0 && (
        <button
          type="button"
          onClick={() => {
            setOpenModal(true);
            setError(null);
          }}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 text-[13px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-60"
          title="Seed (demo) foydalanuvchilar, profillar, buyurtmalar va sharhlar butunlay o'chadi"
        >
          <Eraser size={14} /> Demo ma'lumotlarni o'chirish ({count})
        </button>
      )}
      {done && <span className="text-[11.5px] font-medium text-success-text">{done}</span>}

      {modal.mounted && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 ${modal.closing ? "animate-fade-out" : "animate-fade-in"}`}
          role="presentation"
          onClick={() => !busy && setOpenModal(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="demo-clean-title" className={`card-floating w-full max-w-md p-5 text-left ${modal.closing ? "animate-modal-out" : "animate-modal-in"}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 id="demo-clean-title" className="flex items-center gap-2 font-display text-[17px] font-semibold text-fg">
                <AlertTriangle size={18} className="shrink-0 text-danger" /> Demo ma'lumotlarni o'chirish
              </h3>
              <button type="button" onClick={() => setOpenModal(false)} disabled={busy} aria-label="Yopish" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg disabled:opacity-50">
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-fg-2">
              <span className="font-semibold text-fg">{count} ta</span> seed (demo) foydalanuvchi va ularga bog'liq hamma narsa — profillar, portfolio, buyurtmalar, to'lov yozuvlari, sharhlar, e'lonlar va chatlar — butunlay o'chadi. Bu amalni qaytarib bo'lmaydi.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fg-3">Haqiqiy havolalari (real telegram/instagram va h.k.) bor seed hisoblar o'chirilmaydi — ular saqlab qolinadi va soni natijada ko'rsatiladi.</p>
            {error && (
              <p className="mt-3 rounded-[12px] bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger-text" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpenModal(false)} disabled={busy} className="inline-flex h-10 items-center rounded-full border border-line px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50">
                Bekor
              </button>
              <button type="button" onClick={run} disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-danger px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                <Eraser size={14} /> {busy ? "O'chirilmoqda…" : "Ha, o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
