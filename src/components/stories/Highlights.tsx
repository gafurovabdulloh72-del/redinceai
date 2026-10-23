"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/toast";
import { STORY_BACKGROUNDS } from "@/lib/social/limits";
import { cn } from "@/lib/utils";

export interface HighlightRow {
  id: string;
  title: string;
  coverUrl: string | null;
  itemsCount: number;
}
interface Item {
  id: string;
  media: { url: string; type: string } | null;
  caption: string | null;
  bg: string | null;
}
type Resp<T> = { ok: boolean; data?: T; error?: string };

/**
 * Profildagi Highlights qatori (Instagram naqshi): doimiy story to'plamlari.
 * Egasi yangi to'plam yaratadi va o'chiradi; bosilganda to'plam ichidagi kadrlar ko'rinadi.
 */
export function Highlights({ initial, canManage, archive }: { initial: HighlightRow[]; canManage: boolean; /** Egasiga: to'plamga qo'shish uchun story arxivi */ archive?: Array<{ id: string; media: { url: string; type: string } | null; caption: string | null; bg: string | null; createdAt: number }> }) {
  const confirm = useConfirm();
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<HighlightRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/highlights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
      const j = (await res.json()) as Resp<HighlightRow>;
      if (!res.ok || !j.data) throw new Error(j.error || "Yaratilmadi");
      setRows((l) => [j.data as HighlightRow, ...l]);
      setTitle("");
      setCreating(false);
      showToast("To'plam yaratildi — endi story qo'shing", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yaratilmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(h: HighlightRow) {
    if (!(await confirm({ title: `«${h.title}» o'chirilsinmi?`, confirmLabel: "O'chirish", danger: true }))) return;
    setRows((l) => l.filter((x) => x.id !== h.id));
    setOpen(null);
    try {
      const res = await fetch(`/api/highlights/${encodeURIComponent(h.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setRows((l) => [h, ...l]);
      showToast("O'chirilmadi", "error");
    }
  }

  async function addStory(highlightId: string, storyId: string) {
    try {
      const res = await fetch(`/api/highlights/${encodeURIComponent(highlightId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId }) });
      const j = (await res.json()) as Resp<{ itemsCount: number }>;
      if (!res.ok || !j.data) throw new Error(j.error || "Qo'shilmadi");
      const count = j.data.itemsCount;
      setRows((l) => l.map((x) => (x.id === highlightId ? { ...x, itemsCount: count } : x)));
      showToast("To'plamga qo'shildi", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Qo'shilmadi", "error");
    }
  }

  if (!rows.length && !canManage) return null;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {canManage && (
          <button type="button" onClick={() => setCreating(true)} className="press flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-line-2 text-fg-3">
              <Plus size={20} />
            </span>
            <span className="truncate text-[11.5px] text-fg-3">Yangi</span>
          </button>
        )}
        {rows.map((h) => (
          <button key={h.id} type="button" onClick={() => setOpen(h)} className="press flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-line bg-surface-2">
              {h.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-semibold text-fg-3">{h.itemsCount}</span>
              )}
            </span>
            <span className="w-16 truncate text-center text-[11.5px] text-fg-2">{h.title}</span>
          </button>
        ))}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Yangi to'plam" size="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
          className="flex gap-2"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Nomi (masalan, Ishlarim)" aria-label="To'plam nomi" className="field h-11 min-w-0 flex-1 text-[14px]" autoFocus />
          <button type="submit" disabled={!title.trim() || busy} className="btn-accent inline-flex h-11 items-center px-4 text-[14px] font-semibold disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : "Yaratish"}
          </button>
        </form>
      </Sheet>

      {open && <HighlightViewer h={open} canManage={canManage} archive={archive} onClose={() => setOpen(null)} onDelete={() => void remove(open)} onAdd={(sid) => void addStory(open.id, sid)} />}
    </>
  );
}

/** To'plam ko'rgichi: kadrlar ketma-ket, egasiga «story qo'shish» va «o'chirish» */
function HighlightViewer({
  h,
  canManage,
  archive,
  onClose,
  onDelete,
  onAdd,
}: {
  h: HighlightRow;
  canManage: boolean;
  archive?: Array<{ id: string; media: { url: string; type: string } | null; caption: string | null; bg: string | null; createdAt: number }>;
  onClose: () => void;
  onDelete: () => void;
  onAdd: (storyId: string) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [picker, setPicker] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    fetch(`/api/highlights/${encodeURIComponent(h.id)}`)
      .then((r) => r.json())
      .then((j: Resp<{ items: Item[] }>) => setItems(j.data?.items ?? []))
      .catch(() => setItems([]));
  }, [h.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((n) => Math.min((items?.length ?? 1) - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onClose]);

  if (!mounted) return null;
  const cur = items?.[i];
  const bgCss = cur?.bg ? STORY_BACKGROUNDS[cur.bg as keyof typeof STORY_BACKGROUNDS] : null;

  return createPortal(
    <div className="fixed inset-0 z-[136] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={h.title}>
      <div className="flex items-center gap-2 px-3 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{h.title}</p>
        {canManage && archive && (
          <button type="button" onClick={() => setPicker(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/12 px-3 text-[13px] font-semibold hover:bg-white/20">
            <Plus size={15} /> Story qo&apos;shish
          </button>
        )}
        {canManage && (
          <button type="button" onClick={onDelete} aria-label="To'plamni o'chirish" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
            <Trash2 size={17} />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Yopish" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-3 pb-6">
        {items === null ? (
          <Loader2 className="animate-spin text-white/70" />
        ) : items.length === 0 ? (
          <p className="text-center text-[14px] text-white/70">To&apos;plam bo&apos;sh{canManage ? " — «Story qo'shish» tugmasidan foydalaning" : ""}.</p>
        ) : (
          <>
            <div className="relative mx-auto aspect-[9/16] h-full max-h-[80vh] w-auto overflow-hidden rounded-[18px] bg-[#111]" style={bgCss ? { background: bgCss } : undefined}>
              {cur?.media ? (
                cur.media.type.startsWith("video/") ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={cur.media.url} controls playsInline className="h-full w-full object-contain" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cur.media.url} alt="" className="h-full w-full object-contain" />
                )
              ) : (
                <p className="grid h-full place-items-center px-6 text-center text-[18px] font-semibold text-white">{cur?.caption}</p>
              )}
              {cur?.media && cur.caption && <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10 text-[14px] text-white">{cur.caption}</p>}
            </div>
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} aria-label="Oldingi" className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/12 text-white hover:bg-white/20">
                <ChevronLeft size={20} />
              </button>
            )}
            {i < items.length - 1 && (
              <button type="button" onClick={() => setI(i + 1)} aria-label="Keyingi" className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/12 text-white hover:bg-white/20">
                <ChevronRight size={20} />
              </button>
            )}
          </>
        )}
      </div>

      {picker && archive && (
        <Sheet open onClose={() => setPicker(false)} title="Arxivdan tanlang" size="md">
          {archive.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-fg-3">Arxiv bo&apos;sh.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {archive.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(a.id);
                      setPicker(false);
                    }}
                    className={cn("press block aspect-[9/16] w-full overflow-hidden rounded-[10px] bg-surface-2")}
                    style={a.bg ? { background: STORY_BACKGROUNDS[a.bg as keyof typeof STORY_BACKGROUNDS] } : undefined}
                  >
                    {a.media ? (
                      a.media.type.startsWith("video/") ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={a.media.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.media.url} alt="" className="h-full w-full object-cover" />
                      )
                    ) : (
                      <span className="grid h-full place-items-center px-1 text-center text-[10px] font-semibold text-white">{a.caption?.slice(0, 40)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </div>,
    document.body,
  );
}
