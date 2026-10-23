"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe, ListVideo, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface CollectionRow {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  itemsCount: number;
}
type Resp<T> = { ok: boolean; data?: T; error?: string };

/** Kabinetdagi to'plamlar (pleylist) ro'yxati: yaratish, ochiq/yopiq qilish, o'chirish */
export function CollectionsManager({ initial }: { initial: CollectionRow[] }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState(initial);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/toplamlar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
      const j = (await res.json()) as Resp<CollectionRow>;
      if (!res.ok || !j.data) throw new Error(j.error || "Yaratilmadi");
      setRows((l) => [j.data as CollectionRow, ...l]);
      setTitle("");
      showToast("To'plam yaratildi", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Yaratilmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublic(c: CollectionRow) {
    const next = !c.isPublic;
    setRows((l) => l.map((x) => (x.id === c.id ? { ...x, isPublic: next } : x)));
    try {
      const res = await fetch(`/api/toplamlar/${encodeURIComponent(c.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: next }) });
      if (!res.ok) throw new Error();
    } catch {
      setRows((l) => l.map((x) => (x.id === c.id ? { ...x, isPublic: !next } : x)));
      showToast("Saqlanmadi", "error");
    }
  }

  async function remove(c: CollectionRow) {
    if (!(await confirm({ title: `«${c.title}» o'chirilsinmi?`, text: "To'plam o'chadi; ichidagi postlar o'chmaydi.", confirmLabel: "O'chirish", danger: true }))) return;
    setRows((l) => l.filter((x) => x.id !== c.id));
    try {
      const res = await fetch(`/api/toplamlar/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setRows((l) => [c, ...l]);
      showToast("O'chirilmadi", "error");
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Yangi to'plam nomi" aria-label="Yangi to'plam nomi" maxLength={80} className="field h-11 min-w-0 flex-1 text-[14px]" />
        <button type="submit" disabled={!title.trim() || busy} className="btn-accent inline-flex h-11 items-center gap-1.5 px-4 text-[14px] font-semibold disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Yaratish
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-[14px] text-fg-3">Hali to&apos;plam yo&apos;q. Postning «…» menyusidagi «To&apos;plamga qo&apos;shish» orqali ham yaratish mumkin.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id} className="card overflow-hidden">
              <Link href={`/toplam/${c.id}`} className="block">
                <div className="relative aspect-[16/9] bg-surface-2">
                  {c.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-fg-4">
                      <ListVideo size={28} />
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{c.itemsCount} ta</span>
                </div>
                <h2 className="truncate px-3 pt-3 text-[14.5px] font-semibold text-fg">{c.title}</h2>
              </Link>
              <div className="flex items-center gap-1 px-3 pb-3 pt-1.5">
                <button type="button" onClick={() => void togglePublic(c)} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] font-semibold transition hover:bg-fg/6", c.isPublic ? "text-fg-2" : "text-fg-3")}>
                  {c.isPublic ? <Globe size={13} /> : <Lock size={13} />} {c.isPublic ? "Ommaviy" : "Yopiq"}
                </button>
                <button type="button" onClick={() => void remove(c)} aria-label="O'chirish" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-danger-soft hover:text-danger-text">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
