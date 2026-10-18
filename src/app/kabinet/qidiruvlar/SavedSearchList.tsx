"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, Bell, BellOff, Check, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";

export interface SavedSearchItem {
  id: string;
  name: string;
  query: string;
  summary: string;
  notify: boolean;
  /** daily — har kunlik tekshiruvda; weekly — haftada bir */
  frequency: "daily" | "weekly";
  lastNotifiedAt: number | null;
  createdAt: number;
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };
type Patch = { name?: string; notify?: boolean; frequency?: "daily" | "weekly" };

const FREQ: Array<{ value: SavedSearchItem["frequency"]; label: string }> = [
  { value: "daily", label: "Har kuni" },
  { value: "weekly", label: "Haftada bir" },
];

/** Kabinet: saqlangan qidiruvlar — inline nomlash, bildirishnoma kaliti + chastota, «Hozir tekshirish», inline o'chirish tasdig'i */
export function SavedSearchList({ initial }: { initial: SavedSearchItem[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, { n: number; href: string }>>({});
  const [error, setError] = useState<string | null>(null);
  /** Tahrir yopilganda fokus qaytadigan qalam tugmalari */
  const pencilRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const closeEdit = (id: string) => {
    setEditing(null);
    // Fokus yo'qolib body'ga tushmasin — qalam tugmasiga qaytadi
    window.requestAnimationFrame(() => pencilRefs.current[id]?.focus());
  };

  const patch = async (id: string, body: Patch) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as ApiResponse<{ id: string; name: string; notify: boolean; frequency: "daily" | "weekly" }>;
      if (!json.ok) {
        setError(json.fields?.name ?? json.error);
        return false;
      }
      setItems((list) => list.map((x) => (x.id === id ? { ...x, name: json.data.name, notify: json.data.notify, frequency: json.data.frequency } : x)));
      return true;
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResponse<{ deleted: boolean }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setItems((list) => list.filter((x) => x.id !== id));
      setConfirm(null);
      toast("Qidiruv o'chirildi");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  const checkNow = async (s: SavedSearchItem) => {
    if (checking) return;
    setChecking(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/saved-searches/${s.id}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<{ newCount: number; href: string }>;
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setChecked((m) => ({ ...m, [s.id]: { n: json.data.newCount, href: json.data.href } }));
      toast(json.data.newCount > 0 ? `${json.data.newCount} ta yangi mutaxassis mos keladi` : "Yangi mos mutaxassis yo'q", json.data.newCount > 0 ? "success" : "info");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setChecking(null);
    }
  };

  const saveName = async (e: FormEvent, id: string) => {
    e.preventDefault();
    if (await patch(id, { name: draft.trim() })) closeEdit(id);
  };

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <ul className="stagger space-y-3">
        {items.map((s) => {
          const c = checked[s.id];
          return (
            <li key={s.id} className="card animate-fade-up p-4 sm:p-5" aria-busy={busy === s.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  {editing === s.id ? (
                    <form
                      onSubmit={(e) => saveName(e, s.id)}
                      className="expand-in flex items-center gap-2"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") closeEdit(s.id);
                      }}
                    >
                      <label htmlFor={`ss-name-${s.id}`} className="sr-only">
                        Qidiruv nomi
                      </label>
                      <input id={`ss-name-${s.id}`} className="field !h-11" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} autoFocus />
                      <button type="submit" aria-label="Nomni saqlash" disabled={busy === s.id || draft.trim().length < 2} className="btn-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40">
                        {busy === s.id ? <Spinner /> : <Check size={16} />}
                      </button>
                      <button type="button" aria-label="Bekor qilish" onClick={() => closeEdit(s.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                        <X size={16} />
                      </button>
                    </form>
                  ) : (
                    <p className="flex items-center gap-1.5">
                      <span className="truncate font-display text-[16px] font-semibold text-fg">{s.name}</span>
                      <button
                        type="button"
                        ref={(el) => {
                          pencilRefs.current[s.id] = el;
                        }}
                        onClick={() => {
                          setEditing(s.id);
                          setDraft(s.name);
                          setConfirm(null);
                        }}
                        aria-label={`${s.name} — nomini o'zgartirish`}
                        title="Nomini o'zgartirish"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg"
                      >
                        <Pencil size={14} />
                      </button>
                    </p>
                  )}
                  <p className="mt-0.5 text-[13px] text-fg-2">{s.summary}</p>
                  <p className="mt-1 text-[12px] text-fg-4" suppressHydrationWarning>
                    Saqlangan: {formatDate(s.createdAt)}
                    {s.lastNotifiedAt ? ` · oxirgi tekshiruv ${formatDate(s.lastNotifiedAt)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void checkNow(s)}
                    disabled={checking !== null}
                    className="press inline-flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-60"
                    title="Oxirgi tekshiruvdan keyin yangi mos mutaxassislar bormi?"
                  >
                    {checking === s.id ? <Spinner /> : <RefreshCw size={14} />} Hozir tekshirish
                  </button>
                  <Link
                    href={c?.href ?? `/mutaxassislar${s.query ? `?${s.query}` : ""}`}
                    className="icon-nudge inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4"
                  >
                    Ochish <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
              {c && (
                <p className="expand-in mt-2 text-[12.5px] text-fg-2" role="status">
                  {c.n > 0 ? (
                    <>
                      <span className="font-semibold text-fg">{c.n} ta yangi</span> mutaxassis mos keladi — «Ochish» yangilarini birinchi ko&apos;rsatadi.
                    </>
                  ) : (
                    "Oxirgi tekshiruvdan keyin yangi mos mutaxassis yo'q."
                  )}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="flex min-h-11 flex-wrap items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.notify}
                    aria-label={`${s.name} — yangi mutaxassislar haqida xabar berish`}
                    disabled={busy === s.id}
                    onClick={() => void patch(s.id, { notify: !s.notify })}
                    className="switch"
                  />
                  <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", s.notify ? "text-fg" : "text-fg-3")}>
                    {s.notify ? <Bell size={14} /> : <BellOff size={14} />}
                    {s.notify ? "Xabar beramiz" : "Bildirishnoma o'chiq"}
                  </span>
                  {s.notify && (
                    <div className="segment expand-in inline-flex" role="radiogroup" aria-label={`${s.name} — xabar chastotasi`}>
                      {FREQ.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          role="radio"
                          aria-checked={s.frequency === f.value}
                          data-active={s.frequency === f.value}
                          disabled={busy === s.id}
                          onClick={() => s.frequency !== f.value && void patch(s.id, { frequency: f.value })}
                          className="segment-item min-h-8 !px-3 text-[12px]"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {confirm === s.id ? (
                  <div className="expand-in flex items-center gap-2" role="group" aria-label="O'chirishni tasdiqlash">
                    <span className="text-[12.5px] font-medium text-fg-2">O&apos;chirilsinmi?</span>
                    <Button size="sm" variant="danger" className="!h-10" onClick={() => void remove(s.id)} disabled={busy === s.id}>
                      {busy === s.id ? <Spinner /> : "Ha"}
                    </Button>
                    <Button size="sm" variant="outline" className="!h-10" onClick={() => setConfirm(null)} autoFocus>
                      Yo&apos;q
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirm(s.id)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-fg-3 transition hover:bg-danger-soft hover:text-danger-text"
                  >
                    <Trash2 size={14} /> O&apos;chirish
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
