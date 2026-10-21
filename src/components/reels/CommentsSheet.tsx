"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Heart, Send } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";

interface C {
  id: string;
  body: string;
  createdAt: number;
  author: { name: string; avatarUrl: string | null; slug: string | null };
  likesCount: number;
  likedByMe: boolean;
}

/** Reels izohlari varag'i: ro'yxat (eskisi tepada), izohga ❤️, pastda yozish maydoni. Mavjud /api/posts/[id]/comments ustida */
export function CommentsSheet({ postId, open, onClose, loggedIn, onCount }: { postId: string; open: boolean; onClose: () => void; loggedIn: boolean; onCount: (n: number) => void }) {
  const [items, setItems] = useState<C[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: { items: C[]; total: number } }) => {
        setItems(j.data?.items ?? []);
        if (j.data) onCount(j.data.total);
      })
      .catch(() => setItems([]));

  useEffect(() => {
    void load();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Yuborilmadi");
      setText("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Yuborilmadi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function like(c: C) {
    if (!loggedIn) return;
    setItems((l) => l?.map((x) => (x.id === c.id ? { ...x, likedByMe: !x.likedByMe, likesCount: x.likesCount + (x.likedByMe ? -1 : 1) } : x)) ?? l);
    await fetch(`/api/comments/${c.id}/like`, { method: "POST" }).catch(() => undefined);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Izohlar${items ? ` · ${items.length}` : ""}`}
      size="md"
      footer={
        loggedIn ? (
          <form onSubmit={submit} className="flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Izoh yozing…" aria-label="Izoh" className="field h-11 flex-1 text-[14px]" />
            <button type="submit" disabled={!text.trim() || busy} aria-label="Yuborish" className="btn-accent grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50">
              {busy ? <Spinner /> : <Send size={17} />}
            </button>
          </form>
        ) : (
          <Link href="/auth/kirish" className="btn-accent flex h-11 items-center justify-center rounded-full text-[14px] font-semibold">
            Izoh yozish uchun kiring
          </Link>
        )
      }
    >
      <div className="min-h-[200px]">
        {items === null ? (
          <div className="grid h-[200px] place-items-center text-fg-3">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="grid h-[200px] place-items-center text-[14px] text-fg-3">Birinchi bo'lib izoh qoldiring</p>
        ) : (
          <ul className="space-y-4">
            {items.map((c) => (
              <li key={c.id} className="flex gap-3">
                <Avatar name={c.author.name} src={c.author.avatarUrl} size={36} decorative />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]">
                    <span className="font-semibold text-fg">{c.author.name}</span> <span className="text-fg-4">· {timeAgo(c.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-snug text-fg-2">{c.body}</p>
                </div>
                <button type="button" onClick={() => void like(c)} aria-label="Izohni yoqtirish" aria-pressed={c.likedByMe} className="press flex shrink-0 flex-col items-center gap-0.5 pt-1 text-fg-3">
                  <Heart size={15} className={cn(c.likedByMe && "fill-[#ff3b5c] text-[#ff3b5c]")} />
                  {c.likesCount > 0 && <span className="text-[11px] tabular-nums">{c.likesCount}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
