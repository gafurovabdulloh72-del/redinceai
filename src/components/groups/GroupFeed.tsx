"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ImagePlus, MessageCircle, Pin, Send, Trash2, X } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { isVideoAttachment, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { COMMENT_MAX, POST_BODY_MAX, POST_MEDIA_MAX } from "@/lib/groups/limits";
import type { CommentView, PostView, UserBrief } from "@/lib/groups/service";
import { cn, timeAgo } from "@/lib/utils";

type Page = { items: PostView[]; nextCursor: number | null };
type ApiResp<T> = { ok: boolean; data?: T; error?: string; fields?: Record<string, string> };

/** Postga faqat rasm yoki video (hujjat emas) */
const POST_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";

function AuthorLink({ u, className }: { u: UserBrief; className?: string }) {
  const inner = <span className={cn("truncate font-semibold text-fg", className)}>{u.name}</span>;
  return u.slug ? (
    <Link href={`/mutaxassislar/${u.slug}`} className="min-w-0 underline-offset-2 hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * Jamoa lentasi: kompozitor (a'zolar uchun), postlar (like/izoh/o'chirish), cursor bo'yicha "yana yuklash".
 * `highlightId` — bildirishnomadan kelganda (?post=) shu post ochiq izohlar bilan ko'rsatiladi.
 */
export function GroupFeed({
  slug,
  canPost,
  loggedIn,
  initial,
  highlightId = null,
}: {
  slug: string;
  canPost: boolean;
  loggedIn: boolean;
  initial: Page;
  highlightId?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const base = `/api/groups/${encodeURIComponent(slug)}/posts`;

  const reload = useCallback(async () => {
    const res = await fetch(base, { cache: "no-store" });
    const j = (await res.json()) as ApiResp<Page>;
    if (j.ok && j.data) {
      setItems(j.data.items);
      setCursor(j.data.nextCursor);
    }
  }, [base]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${base}?cursor=${cursor}`, { cache: "no-store" });
      const j = (await res.json()) as ApiResp<Page>;
      if (j.ok && j.data) {
        const more = j.data.items;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...more.filter((p) => !seen.has(p.id))];
        });
        setCursor(j.data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function requireLogin(): boolean {
    if (loggedIn) return true;
    router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return false;
  }

  return (
    <div className="grid gap-4">
      {canPost ? (
        <Composer base={base} onPosted={reload} />
      ) : (
        <p className="card-outline rounded-[16px] px-4 py-3 text-[13px] text-fg-3">Post yozish, yoqtirish va izoh qoldirish uchun jamoaga qo&apos;shiling.</p>
      )}
      {items.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-fg">Lenta hali bo&apos;sh</p>
          <p className="mt-1 text-[13px] text-fg-3">{canPost ? "Birinchi postni siz yozing — ish, savol yoki e'lon." : "A'zolar yozgan postlar shu yerda chiqadi."}</p>
        </div>
      ) : (
        items.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            canInteract={canPost}
            loggedIn={loggedIn}
            requireLogin={requireLogin}
            highlighted={p.id === highlightId}
            onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== p.id))}
          />
        ))
      )}
      {cursor && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Yuklanmoqda…" : "Yana yuklash"}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kompozitor                                                          */
/* ------------------------------------------------------------------ */
function Composer({ base, onPosted }: { base: string; onPosted: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSend = (body.trim().length > 0 || media.length > 0) && !busy && !uploading;

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    const room = POST_MEDIA_MAX - media.length;
    if (room <= 0) {
      setError(`Ko'pi bilan ${POST_MEDIA_MAX} ta fayl`);
      return;
    }
    const list = Array.from(files).slice(0, room);
    setUploading(true);
    setError(null);
    try {
      const added: Attachment[] = [];
      for (const f of list) {
        if (!/^(image|video)\//.test(f.type)) throw new Error(`«${f.name}»: faqat rasm yoki video`);
        added.push(await uploadAttachment(f, { docs: true }));
      }
      setMedia((m) => [...m, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklanmadi");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim(), media }) });
      const j = (await res.json()) as ApiResp<{ id: string }>;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
      setBody("");
      setMedia([]);
      await onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={POST_BODY_MAX}
        rows={3}
        placeholder="Jamoa bilan bo'lishing: ish, savol, e'lon…"
        className="field w-full resize-y py-2.5 text-[14px] leading-relaxed"
      />
      {media.length > 0 && (
        <ul className="mt-2.5 grid grid-cols-4 gap-2">
          {media.map((a, i) => (
            <li key={a.url} className="relative aspect-square overflow-hidden rounded-[12px] border border-line bg-surface-2">
              {isVideoAttachment(a) ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={a.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <SafeImage src={a.url} alt={a.name} width={160} height={160} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                aria-label="Olib tashlash"
                onClick={() => setMedia((m) => m.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || media.length >= POST_MEDIA_MAX}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[13px] font-semibold text-fg-2 transition hover:text-fg disabled:opacity-50"
        >
          <ImagePlus size={15} /> {uploading ? "Yuklanmoqda…" : `Rasm/video ${media.length}/${POST_MEDIA_MAX}`}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={POST_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void pick(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="ml-auto text-[11.5px] text-fg-4">
          {body.length}/{POST_BODY_MAX}
        </span>
        <Button type="button" variant="primary" size="sm" onClick={submit} disabled={!canSend}>
          <Send size={14} /> {busy ? "Yuborilmoqda…" : "E'lon qilish"}
        </Button>
      </div>
      {error && <p className="mt-2 text-[12.5px] font-semibold text-danger-text">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Post                                                                */
/* ------------------------------------------------------------------ */
function PostCard({
  post,
  canInteract,
  loggedIn,
  requireLogin,
  highlighted,
  onDeleted,
}: {
  post: PostView;
  canInteract: boolean;
  loggedIn: boolean;
  requireLogin: () => boolean;
  highlighted: boolean;
  onDeleted: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likesCount);
  const [comments, setComments] = useState(post.commentsCount);
  const [open, setOpen] = useState(highlighted);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);

  async function like() {
    if (!requireLogin() || !canInteract || busy) return;
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes((n) => Math.max(0, n + (liked ? -1 : 1)));
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}/like`, { method: "POST" });
      const j = (await res.json()) as ApiResp<{ liked: boolean; likesCount: number }>;
      if (!j.ok || !j.data) throw new Error();
      setLiked(j.data.liked);
      setLikes(j.data.likesCount);
    } catch {
      setLiked(prev.liked);
      setLikes(prev.likes);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      const j = (await res.json()) as ApiResp<unknown>;
      if (!res.ok || !j.ok) throw new Error();
      onDeleted();
    } catch {
      setBusy(false);
      setConfirm(false);
    }
  }

  const media = post.media;
  const single = media.length === 1;
  const lockedLike = loggedIn && !canInteract;

  return (
    <article ref={ref} id={`post-${post.id}`} className={cn("card p-4 sm:p-5", highlighted && "ring-2 ring-accent/40")}>
      <header className="flex items-center gap-2.5">
        <Avatar name={post.author.name} src={post.author.avatarUrl} size={36} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
            <AuthorLink u={post.author} />
            {post.isPinned && <Pin size={13} className="shrink-0 text-accent" aria-label="Qadalgan" />}
          </div>
          <p className="text-[12px] text-fg-3">{timeAgo(post.createdAt)}</p>
        </div>
        {post.canDelete &&
          (confirm ? (
            <span className="flex items-center gap-2 text-[12.5px]">
              <button type="button" onClick={remove} disabled={busy} className="font-semibold text-danger-text underline-offset-2 hover:underline">
                O&apos;chirish
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="text-fg-3 hover:text-fg">
                Bekor
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label="Postni o'chirish"
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-danger-text"
            >
              <Trash2 size={15} />
            </button>
          ))}
      </header>

      {post.body && <p className="mt-3 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-fg">{post.body}</p>}

      {media.length > 0 && (
        <div className={cn("mt-3 grid gap-1.5 overflow-hidden rounded-[14px]", single ? "grid-cols-1" : "grid-cols-2")}>
          {media.map((a) =>
            isVideoAttachment(a) ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video key={a.url} src={a.url} controls preload="metadata" playsInline className={cn("w-full bg-black/80", single ? "max-h-[480px]" : "aspect-[4/3] object-cover")} title={a.name} />
            ) : (
              <a key={a.url} href={a.url} target="_blank" rel="noopener" className={cn("block bg-surface-2", !single && "aspect-[4/3]")}>
                <SafeImage src={a.url} alt={a.name} width={960} height={720} className={cn("w-full object-cover", single ? "h-auto max-h-[560px]" : "h-full")} />
              </a>
            ),
          )}
        </div>
      )}

      <footer className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5">
        <button
          type="button"
          onClick={like}
          aria-pressed={liked}
          disabled={lockedLike}
          title={lockedLike ? "Yoqtirish uchun jamoaga qo'shiling" : liked ? "Yoqtirishni bekor qilish" : "Yoqtirish"}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition disabled:opacity-50",
            liked ? "bg-accent-soft text-accent-text" : "text-fg-2 hover:bg-fg/6 hover:text-fg",
          )}
        >
          <Heart size={16} className={liked ? "fill-current" : undefined} /> {likes}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition", open ? "bg-fg/6 text-fg" : "text-fg-2 hover:bg-fg/6 hover:text-fg")}
        >
          <MessageCircle size={16} /> {comments}
        </button>
      </footer>

      {open && <Comments postId={post.id} canWrite={canInteract} onCount={setComments} />}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Izohlar                                                             */
/* ------------------------------------------------------------------ */
function Comments({ postId, canWrite, onCount }: { postId: string; canWrite: boolean; onCount: (n: number) => void }) {
  const [items, setItems] = useState<CommentView[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/posts/${encodeURIComponent(postId)}/comments`;

  const load = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    const j = (await res.json()) as ApiResp<{ items: CommentView[] }>;
    if (j.ok && j.data) {
      setItems(j.data.items);
      onCount(j.data.items.length);
    }
  }, [url, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = (await res.json()) as ApiResp<{ id: string }>;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {!items ? (
        <p className="text-[12.5px] text-fg-3">Yuklanmoqda…</p>
      ) : items.length === 0 ? (
        <p className="text-[12.5px] text-fg-3">Hali izoh yo&apos;q{canWrite ? " — birinchi bo'ling." : "."}</p>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <Avatar name={c.author.name} src={c.author.avatarUrl} size={28} decorative />
              <div className="min-w-0 flex-1 rounded-[14px] bg-fg/4 px-3 py-2">
                <div className="flex min-w-0 items-baseline gap-2 text-[12.5px]">
                  <AuthorLink u={c.author} />
                  <span className="shrink-0 text-fg-4">{timeAgo(c.createdAt)}</span>
                  {c.canDelete && (
                    <button type="button" onClick={() => void remove(c.id)} aria-label="Izohni o'chirish" className="ml-auto shrink-0 text-fg-4 transition hover:text-danger-text">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-fg">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} placeholder="Izoh yozing…" className="field h-10 min-w-0 flex-1 text-[13.5px]" />
          <Button type="submit" variant="primary" size="sm" disabled={!text.trim() || busy} aria-label="Izohni yuborish">
            <Send size={14} />
          </Button>
        </form>
      )}
      {error && <p className="mt-1.5 text-[12.5px] font-semibold text-danger-text">{error}</p>}
    </div>
  );
}
