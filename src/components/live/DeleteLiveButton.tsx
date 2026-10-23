"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/** Tugagan efirni (yozuvi va tarixi bilan) o'chirish — ustoz/admin; o'chirishdan oldin tasdiq so'raladi */
export function DeleteLiveButton({ id, title, className }: { id: string; title: string; className?: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (busy) return;
    if (!(await confirm({ title: `«${title}» o'chirilsinmi?`, text: "Efir yozuvi va uning tarixi (chat, savollar) butunlay o'chadi. Buni qaytarib bo'lmaydi.", confirmLabel: "O'chirish", danger: true }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/live/${id}/yozuv`, { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "O'chirilmadi");
      showToast("Efir o'chirildi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={() => void run()} disabled={busy} aria-label="O'chirish" title="O'chirish" className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-3 transition hover:bg-danger-soft hover:text-danger-text disabled:opacity-60", className)}>
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );
}
