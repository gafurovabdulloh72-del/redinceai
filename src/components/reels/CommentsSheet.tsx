"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CornerDownRight, Heart, Send, X } from "lucide-react";
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
  /** Javob berilgan izoh (iqtibos) */
  replyTo?: { id: string; authorName: string } | null;
}

/** Reels izohlari varag'i: ro'yxat (eskisi tepada), izohga ❤️, pastda yozish maydoni. Mavjud /api/posts/[id]/comments ustida */
export function CommentsSheet({ postId, open, onClose, loggedIn, onCount }: { postId: string; open: boolean; onClose: () => void; loggedIn: boolean; onCount: (n: number) => void }) {
  const [items, setItems] = useState<C[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Instagram/TikTok kabi «Javob»: kimga javob yozilayotgani chip bo'lib turadi, so'rov replyToId bilan ketadi
  const [reply, setReply] = useState<{ id: string; name: string } | null>(null);

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
      const res = await fetch(`/api/posts/${postId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, replyToId: reply?.id ?? null }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? "Yuborilmadi");
      setText("");
      setReply(null);
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
          <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
            {reply && (
              <span className="flex w-full items-center gap-1.5 text-[12.5px] text-fg-3">
                <CornerDownRight size={13} /> <span className="truncate"><span className="font-semibold text-fg">{reply.name}</span>ga javob</span>
                <button type="button" onClick={() => setReply(null)} aria-label="Javobni bekor qilish" className="ml-auto grid h-6 w-6 place-items-center rounded-full hover:bg-fg/6">
                  <X size={13} />
                </button>
              </span>
            )}
            <input id="reels-comment-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={reply ? `${reply.name}ga javob…` : "Izoh yozing…"} aria-label="Izoh" className="field h-11 min-w-0 flex-1 text-[14px]" />
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
                  {c.replyTo && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-fg-4">
                      <CornerDownRight size={11} className="shrink-0" /> <span className="font-semibold">{c.replyTo.authorName}</span>ga javob
                    </p>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-snug text-fg-2">{c.body}</p>
                  {loggedIn && (
                    <button
                      type="button"
                      onClick={() => {
                        setReply({ id: c.replyTo?.id ?? c.id, name: c.author.name });
                        document.getElementById("reels-comment-input")?.focus();
                      }}
                      className="mt-1 text-[12px] font-semibold text-fg-3 hover:text-fg"
                    >
                      Javob
                    </button>
                  )}
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
