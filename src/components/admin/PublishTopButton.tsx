"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";

/** Admin: joriy oy reytingini muddatidan oldin e'lon qilish (g'oliblarga premium beriladi — qaytarib bo'lmaydi, shuning uchun tasdiq so'raydi) */
export function PublishTopButton({ monthLabel, month }: { monthLabel: string; month: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  async function run() {
    const okay = await confirm({ title: `${monthLabel} reytingini hozir e'lon qilasizmi?`, text: "TOP-3 ijodkor e'lon qilinadi, ularga keyingi oy oxirigacha premium beriladi va xabar yuboriladi. Bu amalni qaytarib bo'lmaydi.", confirmLabel: "E'lon qilish" });
    if (!okay) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reyting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Xato");
      showToast("Reyting e'lon qilindi", "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xato", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" variant="accent" size="md" onClick={() => void run()} disabled={busy}>
      {busy ? <Spinner /> : <Crown size={15} />} Hozir e&apos;lon qilish
    </Button>
  );
}
