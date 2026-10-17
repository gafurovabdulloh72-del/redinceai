"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, Clock3, LogOut, Settings2, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { MembershipState } from "@/lib/groups/service";

/** Jamoa sarlavhasidagi asosiy tugma: qo'shilish / so'rov / chiqish / sozlash (egasi) */
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
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<MembershipState>(membership);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE") {
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(`/jamoalar/${slug}`)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/join`, { method });
      const j = (await res.json()) as { ok: boolean; data?: { membership: MembershipState }; error?: string };
      if (!j.ok) throw new Error(j.error || "Bajarib bo'lmadi");
      setState(j.data?.membership ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bajarib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  if (state === "owner") {
    return (
      <Link href={`/jamoalar/${slug}/sozlash`} className="inline-flex h-10 items-center gap-2 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
        <Settings2 size={14} /> Sozlash
      </Link>
    );
  }
  if (state === "banned") return <span className="text-[13px] font-semibold text-danger-text">Siz bu jamoadan chiqarilgansiz</span>;
  if (official && (state === "member" || state === "admin")) {
    return (
      <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-soft px-4 text-[13px] font-semibold text-accent-text" title="Rasmiy kanal — barcha foydalanuvchilar a'zo">
        <BadgeCheck size={15} /> A&apos;zosiz · rasmiy kanal
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      {state === "pending" ? (
        <Button type="button" variant="outline" size="md" onClick={() => call("DELETE")} disabled={busy} title="So'rovni qaytarib olish">
          <Clock3 size={15} /> So'rov yuborildi
        </Button>
      ) : state ? (
        <Button type="button" variant="outline" size="md" onClick={() => call("DELETE")} disabled={busy}>
          <LogOut size={15} /> Chiqish
        </Button>
      ) : (
        <Button type="button" variant="accent" size="md" onClick={() => call("POST")} disabled={busy}>
          <UserPlus size={15} /> {isPrivate ? "So'rov yuborish" : "Qo'shilish"}
        </Button>
      )}
      {error && <span className="text-[12px] font-semibold text-danger-text">{error}</span>}
    </span>
  );
}
