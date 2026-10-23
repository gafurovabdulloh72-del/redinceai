"use client";

import { useEffect, useState } from "react";
import { Check, FolderPlus, Loader2, Lock, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  title: string;
  itemsCount: number;
  isPublic: boolean;
  has: boolean;
}
type Resp<T> = { ok: boolean; data?: T; error?: string };

/**
 * «To'plamga qo'shish» oynasi (YouTube pleylisti kabi): mening to'plamlarim ro'yxati, belgilash/olib tashlash,
 * pastda yangi to'plam yaratish. Har bosish darhol serverga yoziladi (toggle).
 */
export function CollectionSheet({ open, onClose, postId }: { open: boolean; onClose: () => void; postId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows(null);
    fetch(`/api/posts/${encodeURIComponent(postId)}/toplamlar`)
      .then((r) => r.json())
      .then((j: Resp<{ items: Row[] }>) => setRows(j.data?.items ?? []))
      .catch(() => setRows([]));
  }, [open, postId]);

  async function toggle(c: Row) {
    if (busy) return;
    setBusy(c.id);
    try {
      const res = await fetch(`/api/toplamlar/${encodeURIComponent(c.id)}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId }) });
      const j = (await res.json()) as Resp<{ added: boolean; itemsCount: number }>;
      if (!res.ok || !j.data) throw new Error(j.error || "Bo'lmadi");
      const d = j.data;
      setRows((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, has: d.added, itemsCount: d.itemsCount } : x)));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    const t = title.trim();
    if (!t || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/toplamlar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
      const j = (await res.json()) as Resp<{ id: string; title: string; itemsCount: number; isPublic: boolean }>;
      if (!res.ok || !j.data) throw new Error(j.error || "Yaratilmadi");
      const fresh = { ...j.data, has: false } as Row;
      setRows((l) => [fresh, ...(l ?? [])]);
      setTitle("");
      await toggle(fresh);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yaratilmadi", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="To'plamga qo'shish" size="sm">
      <div className="space-y-3">
        {rows === null ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="animate-spin text-fg-3" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-2 text-center text-[13.5px] text-fg-3">Hali to&apos;plam yo&apos;q — quyida yarating.</p>
        ) : (
          <ul className="max-h-[42vh] space-y-1 overflow-y-auto">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => void toggle(c)}
                  disabled={busy === c.id}
                  aria-pressed={c.has}
                  className="press flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition hover:bg-fg/5 disabled:opacity-60"
                >
                  <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border", c.has ? "border-fg bg-fg text-bg" : "border-line-2")}>
                    {busy === c.id ? <Loader2 size={12} className="animate-spin" /> : c.has ? <Check size={13} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-fg">{c.title}</span>
                    <span className="block text-[12px] text-fg-3">{c.itemsCount} ta post</span>
                  </span>
                  {!c.isPublic && <Lock size={13} className="shrink-0 text-fg-4" aria-label="Yopiq to'plam" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="flex gap-2 border-t border-line pt-3"
        >
          <div className="relative min-w-0 flex-1">
            <FolderPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Yangi to'plam nomi" aria-label="Yangi to'plam nomi" maxLength={80} className="field h-10 w-full pl-8 text-[14px]" />
          </div>
          <button type="submit" disabled={!title.trim() || creating} className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-line-2 px-3 text-[13px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Yaratish
          </button>
        </form>
      </div>
    </Sheet>
  );
}
