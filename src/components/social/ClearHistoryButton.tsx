"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";

/** Ko'rish tarixini butunlay tozalash (tasdiq so'raladi) */
export function ClearHistoryButton() {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (busy) return;
    if (!(await confirm({ title: "Tarix tozalansinmi?", text: "Barcha ko'rish yozuvlari o'chadi. Videolar o'chmaydi.", confirmLabel: "Tozalash", danger: true }))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/library/tarix", { method: "DELETE" });
      if (!res.ok) throw new Error("Tozalanmadi");
      showToast("Tarix tozalandi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={() => void run()} disabled={busy} className="press inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-danger hover:text-danger-text disabled:opacity-60">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Tarixni tozalash
    </button>
  );
}
