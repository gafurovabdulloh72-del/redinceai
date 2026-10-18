"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, ShieldBan, ShieldCheck } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Admin: foydalanuvchini bloklash / blokdan chiqarish (F87) — PATCH /api/admin/users/[id] {isBanned, reason}.
 * Bloklashda sabab majburiy (inline maydon), blokdan chiqarish bir bosishda. Ro'yxatlar (so'nggi foydalanuvchilar,
 * shikoyatlar) ichida ixcham ishlatiladi; tasdiqlash jadvalidagi mutaxassislar uchun AdminSpecialistsTable o'zi bor.
 */
export function AdminBanToggle({ userId, name, initialBanned, initialReason = null, className }: { userId: string; name: string; initialBanned: boolean; initialReason?: string | null; className?: string }) {
  const router = useRouter();
  const [banned, setBanned] = useState(initialBanned);
  const [why, setWhy] = useState<string | null>(initialReason);
  const [ask, setAsk] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `ban-u-${userId}`;

  const submit = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: next, reason: next ? reason.trim() : undefined }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ isBanned: boolean; bannedReason: string | null }> | null;
      if (!json) throw new Error("Server javob bermadi");
      if (!json.ok) throw new Error(json.fields ? Object.values(json.fields)[0] || json.error : json.error);
      setBanned(json.data.isBanned);
      setWhy(json.data.bannedReason);
      setAsk(false);
      setReason("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(false);
    }
  };

  if (ask) {
    return (
      <div className={cn("card-outline expand-in flex w-full flex-col gap-2 !rounded-[14px] p-2.5 text-left", className)} role="group" aria-label={`${name}: bloklash sababi`}>
        <p className="flex items-start gap-1.5 text-[12px] font-medium text-fg">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-danger" /> {name} bloklansinmi? Tizimga kira olmaydi, sessiyalari bekor qilinadi, profili ro'yxatdan yashiriladi.
        </p>
        <label htmlFor={inputId} className="sr-only">
          Bloklash sababi
        </label>
        <input id={inputId} className="field !min-h-10 !py-1.5 text-[13px]" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Sabab: masalan, spam, soxta profil" autoFocus />
        {error && <p className="field-error !mt-0">{error}</p>}
        <div className="flex gap-1.5">
          <Button size="sm" variant="danger" className="h-11 md:h-9" onClick={() => submit(true)} disabled={busy || reason.trim().length < 3}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <ShieldBan size={14} />} Bloklash
          </Button>
          <Button size="sm" variant="ghost" className="h-11 md:h-9" onClick={() => setAsk(false)} disabled={busy}>
            Bekor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={() => (banned ? void submit(false) : (setAsk(true), setError(null)))}
        disabled={busy}
        aria-pressed={banned}
        title={banned ? `Bloklangan${why ? `: ${why}` : ""} — blokdan chiqarish` : "Bloklash"}
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition disabled:opacity-50 md:h-9",
          banned ? "border-danger/40 bg-danger-soft text-danger-text hover:border-danger" : "border-line-2 text-fg-2 hover:border-danger hover:text-danger-text",
        )}
      >
        {busy ? <Spinner className="h-3.5 w-3.5" /> : banned ? <ShieldCheck size={14} /> : <ShieldBan size={14} />}
        {banned ? "Blokdan chiqarish" : "Bloklash"}
      </button>
      {error && <span className="text-[11px] font-medium text-danger">{error}</span>}
    </span>
  );
}
