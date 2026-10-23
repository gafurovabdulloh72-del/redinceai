"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Search, UserMinus, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Person {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}
type Resp<T> = { ok: boolean; data?: T; error?: string };

/** Yaqin do'stlar ro'yxati: qidirib qo'shish, bosib olib tashlash (faqat egasiga ko'rinadi) */
export function CloseFriendsPanel({ initial }: { initial: Person[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const needle = q.trim();
    if (!needle) {
      setFound(null);
      return;
    }
    timer.current = window.setTimeout(() => {
      fetch(`/api/users/mention?q=${encodeURIComponent(needle)}`)
        .then((r) => r.json())
        .then((j: Resp<{ items: Person[] }>) => setFound(j.data?.items ?? []))
        .catch(() => setFound([]));
    }, 250);
  }, [q]);

  async function toggle(u: Person) {
    if (busy) return;
    setBusy(u.id);
    const had = rows.some((r) => r.id === u.id);
    try {
      const res = await fetch("/api/yaqin-doslar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: u.id }) });
      const j = (await res.json()) as Resp<{ added: boolean }>;
      if (!res.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      setRows((l) => (j.data!.added ? [u, ...l.filter((r) => r.id !== u.id)] : l.filter((r) => r.id !== u.id)));
      showToast(j.data.added ? "Yaqin do'stlarga qo'shildi" : "Ro'yxatdan olindi", "success");
      void had;
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki @taxallus bo'yicha qidiring" aria-label="Odam qidirish" className="field h-11 w-full pl-9 text-[14px]" />
      </div>

      {found && (
        <ul className="card divide-y divide-line">
          {found.length === 0 && <li className="px-4 py-6 text-center text-[13.5px] text-fg-3">Topilmadi</li>}
          {found.map((u) => {
            const has = rows.some((r) => r.id === u.id);
            return (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={u.name} src={u.avatarUrl} size={36} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                  {u.username && <span className="block truncate text-[12.5px] text-fg-3">@{u.username}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => void toggle(u)}
                  disabled={busy === u.id}
                  className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition disabled:opacity-60", has ? "border border-line-2 text-fg-2 hover:text-fg" : "btn-accent")}
                >
                  {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : has ? <Check size={14} /> : null}
                  {has ? "Ro'yxatda" : "Qo'shish"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-fg">
          <Users size={16} className="text-fg-3" /> Ro&apos;yxat <span className="font-semibold text-fg-3">{rows.length}</span>
        </h2>
        {rows.length === 0 ? (
          <p className="card mt-3 p-8 text-center text-[14px] text-fg-3">Ro&apos;yxat bo&apos;sh. Post yoki story joylashda «Yaqin do&apos;stlar»ni tanlasangiz, faqat shu ro&apos;yxatdagilar ko&apos;radi.</p>
        ) : (
          <ul className="card mt-3 divide-y divide-line">
            {rows.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={u.name} src={u.avatarUrl} size={36} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-fg">{u.name}</span>
                  {u.username && <span className="block truncate text-[12.5px] text-fg-3">@{u.username}</span>}
                </span>
                <button type="button" onClick={() => void toggle(u)} disabled={busy === u.id} aria-label="Ro'yxatdan olish" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-3 transition hover:bg-danger-soft hover:text-danger-text disabled:opacity-60">
                  {busy === u.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={16} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
