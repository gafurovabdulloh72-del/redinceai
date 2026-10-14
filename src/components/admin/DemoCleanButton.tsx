"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser } from "lucide-react";

/**
 * Admin: demo (seed) foydalanuvchilari va ularga bog'liq hamma narsani bir tugmada o'chirish.
 * Ikki bosqich: birinchi bosish — tasdiq so'raydi, ikkinchisi — o'chiradi (modal talab qilmaydi).
 */
export function DemoCleanButton({ count }: { count: number }) {
  const router = useRouter();
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (count <= 0) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/demo", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "O'chirib bo'lmadi");
      setBusy(false);
      setArm(false);
    }
  };

  return (
    <span className="relative inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => (arm ? run() : setArm(true))}
        onBlur={() => !busy && setArm(false)}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 text-[13px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-60"
        title="Seed (demo) foydalanuvchilar, profillar, buyurtmalar va sharhlar butunlay o'chadi"
      >
        <Eraser size={14} />
        {busy ? "O'chirilmoqda…" : arm ? `Tasdiqlash — ${count} ta demo o'chadi` : `Demo ma'lumotlarni o'chirish (${count})`}
      </button>
      {error && <span className="text-[11.5px] font-medium text-danger-text">{error}</span>}
    </span>
  );
}
