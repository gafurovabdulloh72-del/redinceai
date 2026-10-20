"use client";

import { useEffect, useState } from "react";
import { Check, GraduationCap, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { categoryLabel } from "@/lib/mentorship/format";

interface Pending {
  id: string;
  headline: string;
  bio: string;
  expertise: string[];
  appliedAt: number | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

/** Admin: mentorlik arizalarini tasdiqlash / rad etish */
export function AdminMentors() {
  const [items, setItems] = useState<Pending[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/mentors")
      .then((r) => r.json() as Promise<{ ok: boolean; data?: { items: Pending[] } }>)
      .then((j) => setItems(j.ok && j.data ? j.data.items : []))
      .catch(() => setItems([]));
  }, []);

  const decide = async (id: string, approve: boolean) => {
    if (busy) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/mentors/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Xatolik");
      setItems((xs) => xs?.filter((x) => x.id !== id) ?? xs);
      showToast(approve ? "Mentor tasdiqlandi" : "Ariza rad etildi", approve ? "success" : "info");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(null);
    }
  };

  if (items === null) return <p className="card p-5 text-[13px] text-fg-3">Yuklanmoqda…</p>;
  if (items.length === 0)
    return (
      <div className="card grid place-items-center gap-1.5 p-8 text-center">
        <GraduationCap size={24} className="text-fg-4" />
        <p className="text-[13.5px] font-semibold text-fg">Yangi ariza yo&apos;q</p>
        <p className="text-[12.5px] text-fg-3">Mentor arizalari shu yerda ko&apos;rinadi.</p>
      </div>
    );

  return (
    <ul className="space-y-3">
      {items.map((m) => (
        <li key={m.id} className="card p-4">
          <div className="flex items-start gap-3">
            <Avatar name={m.user.name} src={m.user.avatarUrl} size={44} decorative />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-fg">{m.user.name}</p>
              <p className="truncate text-[12.5px] text-fg-3">{m.user.email}</p>
              <p className="mt-1 text-[13.5px] font-medium text-fg-2">{m.headline}</p>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-fg-3">{m.bio}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.expertise.map((e) => (
                  <span key={e} className="rounded-full bg-fg/6 px-2 py-0.5 text-[11.5px] font-semibold text-fg-2">{categoryLabel(e)}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => decide(m.id, true)} disabled={busy === m.id} className="btn-accent inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-60">
              {busy === m.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Tasdiqlash
            </button>
            <button onClick={() => decide(m.id, false)} disabled={busy === m.id} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-4 text-[13px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-60">
              <X size={14} /> Rad etish
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
