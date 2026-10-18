"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ApiResp = { ok: boolean; data?: { blocked: boolean }; error?: string };

/**
 * Bloklash / blokdan chiqarish (profil sahifasi, chat sarlavhasi). Bloklash ikki bosqichli (tasdiq);
 * server obunalarni ikki tomonlama uzadi; yozish, izoh, reaksiya, lenta — yopiladi.
 */
export function BlockButton({ userId, name, initialBlocked, size = "sm", className, onChange }: { userId: string; name: string; initialBlocked: boolean; size?: "sm" | "md"; className?: string; onChange?: (blocked: boolean) => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function apply(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/blocks/${encodeURIComponent(userId)}`, { method: next ? "POST" : "DELETE" });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok) throw new Error(j.error || "Bo'lmadi");
      setBlocked(next);
      setConfirm(false);
      onChange?.(next);
      toast(next ? `${name} bloklandi — u sizga yoza olmaydi, obunalar uzildi` : `${name} blokdan chiqarildi`, next ? "info" : "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  if (confirm && !blocked) {
    return (
      <span className={cn("expand-in inline-flex flex-wrap items-center gap-1.5 text-[12.5px]", className)} role="group" aria-label="Bloklashni tasdiqlash">
        <span className="font-medium text-fg-2">Bloklaysizmi?</span>
        <Button size="sm" variant="danger" className="!h-8" onClick={() => void apply(true)} disabled={busy}>
          Ha, bloklash
        </Button>
        <Button size="sm" variant="ghost" className="!h-8" onClick={() => setConfirm(false)} disabled={busy}>
          Bekor
        </Button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => (blocked ? void apply(false) : setConfirm(true))}
      disabled={busy}
      aria-pressed={blocked}
      title={blocked ? "Blokdan chiqarish" : "Bloklash — u sizga yoza olmaydi, izoh/reaksiya qo'ya olmaydi"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 font-semibold transition disabled:opacity-50",
        size === "md" ? "h-10 text-[13px]" : "h-8 text-[12px]",
        blocked ? "bg-danger-soft text-danger-text hover:brightness-95" : "text-fg-3 hover:bg-fg/6 hover:text-fg",
        className,
      )}
    >
      {blocked ? <ShieldCheck size={13} /> : <Ban size={13} />} {blocked ? "Blokdan chiqarish" : "Bloklash"}
    </button>
  );
}
