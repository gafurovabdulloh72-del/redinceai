"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, ImagePlus, Loader2, MessageCircle, Send, X } from "lucide-react";
import { CommentsSheet } from "@/components/reels/CommentsSheet";
import { EmojiSticker } from "@/components/social/EmojiSticker";
import { SafeImage } from "@/components/specialists/SafeImage";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Page } from "@/components/groups/GroupFeed";
import { REACTIONS, type ReactionKind } from "@/lib/groups/limits";
import type { PostView } from "@/lib/groups/service";
import { cn, compactCount } from "@/lib/utils";

/**
 * KANAL = TELEGRAM (2026-11-02, foydalanuvchi so'rovi «dizayn telegramdagidek bo'lsin»):
 * kanal postlari ijtimoiy karta emas — Telegram kanalidagidek XABAR-PUFAKCHALAR:
 * xronologik tartib (eski tepada, oxirgisi pastda, ochilganda pastga tushadi), sana ajratgichlari,
 * pufakcha ichida media + izoh + reaksiya pill'lari + 👁 ko'rishlar + vaqt; izohlar CommentsSheet'da.
 * Egasi/admin uchun pastda Telegram uslubidagi yozish paneli (matn + rasm biriktirish).
 */

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

const T = {
  older: { uz: "Oldingi postlar", ru: "Предыдущие посты" },
  empty: { uz: "Kanal e'lonlari shu yerda chiqadi", ru: "Посты канала появятся здесь" },
  composer: { uz: "Kanal e'loni…", ru: "Пост канала…" },
  edited: { uz: "tahrirlangan", ru: "изменено" },
  comments: { uz: "izoh", ru: "комм." },
  sendErr: { uz: "Yuborilmadi", ru: "Не отправлено" },
} as const;

const timeOf = (ms: number) => {
  const d = new Date(ms + 5 * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const dayKey = (ms: number) => new Date(ms + 5 * 3_600_000).toISOString().slice(0, 10);
const MONTHS = { uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"], ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"] } as const;
function dayLabel(ms: number, til: "uz" | "ru") {
  const d = new Date(ms + 5 * 3_600_000);
  const now = new Date(Date.now() + 5 * 3_600_000);
  const y = d.getUTCFullYear() === now.getUTCFullYear() ? "" : ` ${d.getUTCFullYear()}`;
  return `${d.getUTCDate()}-${MONTHS[til][d.getUTCMonth()]}${y}`;
}

export function ChannelPosts({ slug, canPost, canInteract, loggedIn, initial, highlightId = null }: { slug: string; canPost: boolean; canInteract: boolean; loggedIn: boolean; initial: Page; highlightId?: string | null }) {
  const til = useLocale();
  const { toast } = useToast();
  // Telegram tartibi: qat'iy xronologik (API qadalganni birinchi beradi — bu yerda sof vaqt bo'yicha)
  const sortChrono = (l: PostView[]) => [...l].sort((a, b) => a.createdAt - b.createdAt);
  const [items, setItems] = useState<PostView[]>(sortChrono(initial.items));
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [commentsOf, setCommentsOf] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  // Ochilganda pastga (oxirgi postga) yoki deep-link postga tushamiz
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const el = scrollRef.current;
    if (!el) return;
    if (highlightId) {
      const t = el.querySelector(`[data-post="${highlightId}"]`);
      if (t) {
        t.scrollIntoView({ block: "center" });
        return;
      }
    }
    el.scrollTop = el.scrollHeight;
  }, [highlightId]);

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevH = el?.scrollHeight ?? 0;
    try {
      const j = (await (await fetch(`/api/groups/${encodeURIComponent(slug)}/posts?cursor=${cursor}`)).json()) as ApiResp<Page>;
      if (j.ok && j.data) {
        const older = j.data.items;
        setItems((l) => sortChrono([...older, ...l]));
        setCursor(j.data.nextCursor);
        // Scroll o'rni saqlanadi (Telegram'dagidek)
        requestAnimationFrame(() => {
          if (el) el.scrollTop += el.scrollHeight - prevH;
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  async function react(p: PostView, kind: ReactionKind) {
    if (!canInteract) return;
    const prev = items;
    setItems((l) =>
      l.map((x) => {
        if (x.id !== p.id) return x;
        const r = { ...x.reactions };
        if (x.myReaction) r[x.myReaction] = Math.max(0, (r[x.myReaction] ?? 1) - 1);
        const next = x.myReaction === kind ? null : kind;
        if (next) r[next] = (r[next] ?? 0) + 1;
        return { ...x, myReaction: next, reactions: r, likesCount: Math.max(0, x.likesCount + (next ? 1 : -1) + (x.myReaction && next ? 0 : 0)) };
      }),
    );
    const res = await fetch(`/api/posts/${encodeURIComponent(p.id)}/like`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction: kind }) }).catch(() => null);
    if (!res?.ok) setItems(prev);
  }

  /* ---------- Egasi uchun Telegram uslubidagi yozish paneli ---------- */
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<Array<{ url: string; name: string; type: string; size: number }>>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function attach(file: File) {
    if (files.length >= 4 || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const j = (await (await fetch("/api/upload", { method: "POST", body: fd })).json()) as ApiResp<{ url: string }>;
      if (j.ok && j.data) setFiles((l) => [...l, { url: j.data!.url, name: file.name, type: file.type, size: file.size }]);
      else toast(j.error ?? T.sendErr[til], "error");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (sending || (!draft.trim() && files.length === 0)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(slug)}/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: draft.trim(), media: files }) });
      const j = (await res.json()) as ApiResp<{ id: string }>;
      if (!res.ok || !j.ok) throw new Error(j.error);
      // API faqat {id} qaytaradi — birinchi sahifani qayta o'qib ro'yxatni yangilaymiz
      const fresh = (await (await fetch(`/api/groups/${encodeURIComponent(slug)}/posts`)).json()) as ApiResp<Page>;
      if (fresh.ok && fresh.data) {
        setItems(sortChrono(fresh.data.items));
        setCursor(fresh.data.nextCursor);
      }
      setDraft("");
      setFiles([]);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : T.sendErr[til], "error");
    } finally {
      setSending(false);
    }
  }

  let lastDay = "";
  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-2 px-3 py-4 sm:px-5">
        <div className="mx-auto flex max-w-[560px] flex-col gap-2.5">
          {cursor && (
            <button type="button" onClick={() => void loadOlder()} className="mx-auto mb-1 inline-flex items-center gap-1.5 rounded-full bg-bg px-3.5 py-1.5 text-[12px] font-semibold text-fg-3 shadow-sm transition hover:text-fg">
              {loadingOlder && <Loader2 size={12} className="animate-spin" />} {T.older[til]}
            </button>
          )}
          {items.length === 0 && <p className="py-16 text-center text-[13.5px] text-fg-3">{T.empty[til]}</p>}
          {items.map((p) => {
            const dk = dayKey(p.createdAt);
            const sep = dk !== lastDay;
            lastDay = dk;
            const reacted = (Object.entries(p.reactions) as Array<[ReactionKind, number]>).filter(([, n]) => n > 0);
            return (
              <div key={p.id} data-post={p.id} className="flex flex-col">
                {sep && <span className="mx-auto my-2 rounded-full bg-fg/8 px-3 py-0.5 text-[11.5px] font-semibold text-fg-3">{dayLabel(p.createdAt, til)}</span>}
                {/* Pufakcha — Telegram kanal xabari */}
                <div className={cn("relative w-fit max-w-full overflow-hidden rounded-[16px] rounded-bl-[6px] bg-bg shadow-sm", highlightId === p.id && "ring-2 ring-accent/60")}>
                  {p.media.length > 0 && (
                    <div className={cn("grid gap-0.5", p.media.length > 1 && "grid-cols-2")}>
                      {p.media.slice(0, 4).map((m, i) =>
                        m.type?.startsWith("video") ? (
                          <video key={i} src={m.url} controls playsInline preload="metadata" className="max-h-[420px] w-full bg-black object-contain" />
                        ) : (
                          <SafeImage key={i} optimize={560} src={m.url} alt="" className={cn("w-full object-cover", p.media.length === 1 ? "max-h-[440px]" : "aspect-square")} />
                        ),
                      )}
                    </div>
                  )}
                  {p.body && <p className="whitespace-pre-line px-3.5 pb-1.5 pt-2.5 text-[14.5px] leading-[1.5] text-fg">{p.body}</p>}
                  {/* Pastki qator: reaksiyalar · ko'rishlar · vaqt (Telegram'dagidek pufakcha ichida) */}
                  <div className="flex flex-wrap items-end gap-1.5 px-3 pb-2 pt-1">
                    {reacted.map(([k, n]) => {
                      const def = REACTIONS.find((r) => r.key === k);
                      if (!def) return null;
                      return (
                        <button
                          key={k}
                          type="button"
                          disabled={!canInteract}
                          onClick={() => void react(p, k)}
                          className={cn("inline-flex h-[26px] items-center gap-1 rounded-full px-2 text-[12.5px] font-bold transition", p.myReaction === k ? "bg-accent text-white" : "bg-fg/8 text-fg-2 hover:bg-fg/12", !canInteract && "pointer-events-none")}
                        >
                          <EmojiSticker e={def.emoji} size={14} /> {compactCount(n)}
                        </button>
                      );
                    })}
                    {reacted.length === 0 && canInteract && (
                      <button type="button" onClick={() => void react(p, "heart")} aria-label="Yoqdi" className="inline-flex h-[26px] items-center gap-1 rounded-full bg-fg/8 px-2 text-[12.5px] font-bold text-fg-3 transition hover:bg-fg/12">
                        <EmojiSticker e="❤️" size={14} />
                      </button>
                    )}
                    <span className="ml-auto inline-flex items-center gap-2.5 pl-3 text-[11.5px] text-fg-4">
                      {p.viewsCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Eye size={12} /> {compactCount(p.viewsCount)}
                        </span>
                      )}
                      {p.edited && <span className="italic">{T.edited[til]}</span>}
                      <time dateTime={new Date(p.createdAt).toISOString()}>{timeOf(p.createdAt)}</time>
                    </span>
                  </div>
                </div>
                {/* Izohlar chipi (Telegram «Leave a comment» qatori) */}
                <button type="button" onClick={() => setCommentsOf(p.id)} className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold text-fg-3 transition hover:text-fg">
                  <MessageCircle size={13} /> {p.commentsCount > 0 ? `${compactCount(p.commentsCount)} ${T.comments[til]}` : T.comments[til]}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {/* Egasi/admin: yozish paneli (Telegram uslubi) */}
      {canPost && (
        <div className="shrink-0 border-t border-line bg-bg p-2">
          {files.length > 0 && (
            <div className="mb-1.5 flex gap-1.5 px-1">
              {files.map((f, i) => (
                <span key={i} className="relative h-12 w-12 overflow-hidden rounded-[8px] border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label="Olib tashlash" className="absolute right-0 top-0 rounded-bl-[8px] bg-black/60 p-0.5 text-white">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <label className={cn("flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg", uploading && "pointer-events-none opacity-50")}>
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && void attach(e.target.files[0])} />
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={T.composer[til]}
              className="field max-h-32 min-h-10 flex-1 resize-none py-2 text-[14px]"
            />
            <button type="button" onClick={() => void send()} disabled={sending || (!draft.trim() && files.length === 0)} aria-label="Yuborish" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition disabled:opacity-40">
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        </div>
      )}
      {commentsOf && (
        <CommentsSheet
          postId={commentsOf}
          open
          onClose={() => setCommentsOf(null)}
          loggedIn={loggedIn}
          onCount={(n) => setItems((l) => l.map((x) => (x.id === commentsOf ? { ...x, commentsCount: n } : x)))}
        />
      )}
    </>
  );
}
