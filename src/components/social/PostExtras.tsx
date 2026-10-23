"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Loader2, MapPin, Search, Users, UsersRound, X } from "lucide-react";
import { Avatar } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface TaggedUser {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}
type Resp<T> = { ok: boolean; data?: T; error?: string };

/** Odam qidirish va belgilash (tag): @taxallus/ism bo'yicha, ko'p tanlanadi */
export function TagPeopleSheet({ open, onClose, value, onChange, max = 20 }: { open: boolean; onClose: () => void; value: TaggedUser[]; onChange: (v: TaggedUser[]) => void; max?: number }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<TaggedUser[] | null>(null);
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
        .then((j: Resp<{ items: TaggedUser[] }>) => setFound(j.data?.items ?? []))
        .catch(() => setFound([]));
    }, 250);
  }, [q]);

  const toggle = (u: TaggedUser) => {
    const has = value.some((v) => v.id === u.id);
    if (has) onChange(value.filter((v) => v.id !== u.id));
    else if (value.length >= max) showToast(`Ko'pi bilan ${max} ta odam`, "info");
    else onChange([...value, u]);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Odamlarni belgilash" size="sm">
      <div className="space-y-3">
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {value.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => toggle(u)} className="press inline-flex items-center gap-1 rounded-full bg-fg/8 py-1 pl-2 pr-1.5 text-[12.5px] font-semibold text-fg">
                  {u.name}
                  <X size={12} className="text-fg-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki @taxallus" aria-label="Odam qidirish" className="field h-11 w-full pl-9 text-[14px]" autoFocus />
        </div>
        {found && (
          <ul className="max-h-[40vh] space-y-0.5 overflow-y-auto">
            {found.length === 0 && <li className="py-4 text-center text-[13px] text-fg-3">Topilmadi</li>}
            {found.map((u) => {
              const picked = value.some((v) => v.id === u.id);
              return (
                <li key={u.id}>
                  <button type="button" onClick={() => toggle(u)} className={cn("flex w-full items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-left transition hover:bg-fg/5", picked && "bg-fg/5")}>
                    <Avatar name={u.name} src={u.avatarUrl} size={32} decorative />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-fg">{u.name}</span>
                      {u.username && <span className="block truncate text-[12px] text-fg-3">@{u.username}</span>}
                    </span>
                    {picked && <span className="text-[12px] font-semibold text-accent">Belgilandi</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/** Auditoriya tanlash: hamma yoki yaqin do'stlar */
export function AudiencePicker({ value, onChange, className }: { value: "public" | "close"; onChange: (v: "public" | "close") => void; className?: string }) {
  return (
    <div className={cn("inline-flex rounded-full border border-line p-0.5", className)} role="radiogroup" aria-label="Kim ko'radi">
      {(
        [
          ["public", "Hamma", UsersRound],
          ["close", "Yaqin do'stlar", Users],
        ] as const
      ).map(([k, label, Icon]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold transition", value === k ? "bg-fg text-bg" : "text-fg-3 hover:text-fg")}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}

/** Joy belgisi (oddiy matn maydoni — xarita xizmatisiz) */
export function PlaceField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Joy (masalan, Toshkent, Qodirov School)" aria-label="Joy" maxLength={80} className="field h-10 w-full pl-9 text-[13.5px]" />
    </div>
  );
}

/** Rejalashtirish: sana-vaqt maydoni (bo'sh bo'lsa darhol joylanadi) */
export function SchedulePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const min = new Date(Date.now() + 6 * 60_000).toISOString().slice(0, 16);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-2" htmlFor="sched-at">
        <CalendarClock size={14} /> Vaqti
      </label>
      <input id="sched-at" type="datetime-local" value={value} min={min} onChange={(e) => onChange(e.target.value)} className="field h-10 min-w-0 flex-1 text-[13.5px]" />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-[12.5px] font-semibold text-fg-3 hover:text-fg">
          Bekor
        </button>
      )}
    </div>
  );
}

/** Rejalashtirilgan postlar ro'yxati (kabinet) */
export function ScheduledList({ initial }: { initial: Array<{ id: string; body: string; runAt: number; status: string; error: string | null }> }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  async function cancel(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/rejalashtirilgan/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Bekor qilinmadi");
      setRows((l) => l.filter((r) => r.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setBusy(null);
    }
  }
  if (!rows.length) return <p className="card p-8 text-center text-[14px] text-fg-3">Rejalashtirilgan post yo&apos;q.</p>;
  return (
    <ul className="grid gap-2">
      {rows.map((r) => (
        <li key={r.id} className="card flex items-start gap-3 p-3.5">
          <CalendarClock size={16} className="mt-0.5 shrink-0 text-fg-3" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14px] text-fg">{r.body || "(rasm/video)"}</p>
            <p className="mt-0.5 text-[12.5px] text-fg-3">
              {new Date(r.runAt).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" })}
              {r.status === "failed" && <span className="text-danger-text"> · xato: {r.error}</span>}
              {r.status === "done" && <span className="text-success-text"> · joylandi</span>}
            </p>
          </div>
          {r.status === "pending" && (
            <button type="button" onClick={() => void cancel(r.id)} disabled={busy === r.id} className="shrink-0 text-[12.5px] font-semibold text-fg-3 transition hover:text-danger-text disabled:opacity-60">
              {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : "Bekor qilish"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
