"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Clock3, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { JOIN_NOTE_MAX } from "@/lib/groups/limits";
import type { MembershipState } from "@/lib/groups/service";

/**
 * Jamoa sarlavhasidagi asosiy tugma: qo'shilish / so'rov (izoh bilan) / chiqish (tasdiq bilan).
 * Egasi uchun chiqmaydi (sahifa «Sozlash» beradi). Xatolar toast orqali.
 */
export function JoinButton({
  slug,
  membership,
  isPrivate,
  loggedIn,
  official = false,
}: {
  slug: string;
  membership: MembershipState;
  isPrivate: boolean;
  loggedIn: boolean;
  /** Rasmiy kanal: a'zolikdan chiqib bo'lmaydi — tugma o'rniga belgi */
  official?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<MembershipState>(membership);
  /** Ochiq panel: chiqish tasdig'i yoki so'rov izohi */
  const [panel, setPanel] = useState<"leave" | "note" | null>(null);
  const [note, setNote] = useState("");

  async function call(method: "POST" | "DELETE", body?: Record<string, unknown>) {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(`/jamoalar/${slug}`)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/join`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const j = (await res.json()) as { ok: boolean; data?: { membership: MembershipState; welcome?: string | null }; error?: string };
      if (!j.ok) throw new Error(j.error || "Bajarib bo'lmadi");
      const next = j.data?.membership ?? null;
      setState(next);
      setPanel(null);
      setNote("");
      if (method === "POST") toast(next === "pending" ? "So'rov yuborildi — egasi tasdiqlashini kuting" : j.data?.welcome || "Siz a'zosiz");
      else toast(membership === "pending" || state === "pending" ? "So'rov qaytarib olindi" : "Jamoadan chiqdingiz", "info");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bajarib bo'lmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "owner") return null;
  if (state === "banned") return <span className="text-[13px] font-semibold text-danger-text">Siz bu jamoadan chiqarilgansiz</span>;
  if (official && (state === "member" || state === "admin")) {
    return (
      <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-fg/6 px-4 text-[13px] font-semibold text-fg-2" title="Rasmiy kanal — barcha foydalanuvchilar a'zo">
        <BadgeCheck size={15} /> A&apos;zosiz
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-2">
      <span key={state ?? "none"} className="animate-swap">
        {state === "pending" ? (
          <Button type="button" variant="outline" size="md" onClick={() => setPanel(panel === "leave" ? null : "leave")} disabled={busy} title="So'rovni qaytarib olish" aria-expanded={panel === "leave"}>
            <Clock3 size={15} /> So&apos;rov yuborildi
          </Button>
        ) : state ? (
          <Button type="button" variant="outline" size="md" onClick={() => setPanel(panel === "leave" ? null : "leave")} disabled={busy} aria-expanded={panel === "leave"}>
            <LogOut size={15} /> Chiqish
          </Button>
        ) : isPrivate && loggedIn ? (
          <Button type="button" variant="accent" size="md" onClick={() => setPanel(panel === "note" ? null : "note")} disabled={busy} aria-expanded={panel === "note"}>
            <UserPlus size={15} /> So&apos;rov yuborish
          </Button>
        ) : (
          <Button type="button" variant="accent" size="md" onClick={() => call("POST")} disabled={busy}>
            <UserPlus size={15} /> {isPrivate ? "So'rov yuborish" : "Qo'shilish"}
          </Button>
        )}
      </span>

      {panel === "leave" && (
        <span className="expand-in flex items-center gap-2 text-[13px] text-fg-2" role="group" aria-label="Tasdiqlash">
          {state === "pending" ? "So'rov qaytarib olinsinmi?" : "Jamoadan chiqasizmi?"}
          <Button type="button" variant="danger" size="sm" onClick={() => call("DELETE")} disabled={busy}>
            Ha
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)} disabled={busy}>
            Yo&apos;q
          </Button>
        </span>
      )}

      {panel === "note" && (
        <form
          className="expand-in flex w-full max-w-xs flex-col gap-2 sm:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            void call("POST", { note: note.trim() || null });
          }}
        >
          <label className="grid gap-1 text-[12px] font-semibold text-fg-3">
            O&apos;zingiz haqingizda qisqa (ixtiyoriy)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={JOIN_NOTE_MAX} rows={2} placeholder="Masalan: Buxorolik montajchiman, 3 yil tajriba" className="field w-full resize-none py-2 text-[13px] font-normal" />
          </label>
          <span className="flex items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-fg-4">
              {note.length}/{JOIN_NOTE_MAX}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanel(null)} disabled={busy}>
              Bekor
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              Yuborish
            </Button>
          </span>
        </form>
      )}
    </span>
  );
}
