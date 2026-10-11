"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

type DeleteResponse = { ok: true; data: { deleted: boolean } } | { ok: false; error: string };

/** Admin moderatsiyasi: boshqa muallifning sharhini o'chirish (inline ikki bosqichli tasdiq, window.confirm emas) */
export function ReviewDeleteButton({ specialistId, authorId }: { specialistId: string; authorId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/reviews?specialistId=${encodeURIComponent(specialistId)}&authorId=${encodeURIComponent(authorId)}`, { method: "DELETE" });
      const json = (await res.json()) as DeleteResponse;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi");
    } finally {
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 animate-fade-up" style={{ animationDuration: "0.2s" }} role="group" aria-label="O'chirishni tasdiqlash">
        <span className="text-[12px] font-medium text-fg-2">O'chirilsinmi?</span>
        <Button type="button" size="sm" variant="danger" className="!h-8 !px-2.5 text-[12px]" onClick={remove} disabled={busy}>
          Ha
        </Button>
        <Button type="button" size="sm" variant="outline" className="!h-8 !px-2.5 text-[12px]" onClick={() => setConfirming(false)} autoFocus>
          Yo'q
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {error && (
        <span role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 transition hover:bg-danger-soft hover:text-danger"
        aria-label="Sharhni o'chirish (moderatsiya)"
      >
        <Trash2 size={13} /> O'chirish
      </button>
    </span>
  );
}
