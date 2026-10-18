"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, ImagePlus, MessageCircle, Pencil, Pin, PinOff, RadioTower, Send, Trash2, X } from "lucide-react";
import { RichText } from "./RichText";
import { MentionField } from "./MentionInput";
import { postPermalink, ReactionButton, SaveButton, ShareAction } from "./Reactions";
import { ReportButton } from "@/components/specialists/ReportButton";
import { useViewTracker } from "./useViewTracker";
import { CalendarLinks } from "./CalendarLinks";
import { useToast } from "@/components/ui/toast";
import { Avatar, Button } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { isVideoAttachment, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import { COMMENT_MAX, POST_BODY_MAX, POST_MEDIA_MAX } from "@/lib/groups/limits";
import type { CommentView, PostView, UserBrief } from "@/lib/groups/service";
import { cn, compactCount, formatDateTime, timeAgo } from "@/lib/utils";

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
  kind = "group",
  canPost,
  canInteract,
  canSchedule = false,
  loggedIn,
  initial,
  highlightId = null,
  apiBase,
  composerPlaceholder,
}: {
  slug: string;
  kind?: "group" | "channel";
  /** Post yoza oladimi (guruhda a'zo, kanalda egasi/admin) */
  canPost: boolean;
  /** Yoqtirish/izoh — faol a'zo */
  canInteract: boolean;
  /** Efir/yig'ilish e'lon qila oladimi (egasi/admin) */
  canSchedule?: boolean;
  loggedIn: boolean;
  initial: Page;
  highlightId?: string | null;
  /** Boshqa manba (profil postlari: /api/profil/postlar) — berilsa slug ishlatilmaydi */
  apiBase?: string;
  composerPlaceholder?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const base = apiBase ?? `/api/groups/${encodeURIComponent(slug)}/posts`;

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
    <div className="stagger grid gap-4">
      {canPost ? (
        <Composer base={base} onPosted={reload} allowEvent={canSchedule} kind={kind} placeholder={composerPlaceholder} />
      ) : canInteract && kind === "channel" ? (
        <p className="card-outline rounded-[16px] px-4 py-3 text-[13px] text-fg-3">Kanalga faqat egasi va adminlar yozadi — siz postlarni yoqtirishingiz va izoh qoldirishingiz mumkin.</p>
      ) : (
        <p className="card-outline rounded-[16px] px-4 py-3 text-[13px] text-fg-3">{kind === "channel" ? "Izoh qoldirish va yoqtirish uchun kanalga qo'shiling." : "Post yozish, yoqtirish va izoh qoldirish uchun guruhga qo'shiling."}</p>
      )}
      {items.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-fg">Lenta hali bo&apos;sh</p>
          <p className="mt-1 text-[13px] text-fg-3">{canPost ? "Birinchi postni siz yozing — ish, savol yoki e'lon." : kind === "channel" ? "Kanal e'lonlari shu yerda chiqadi." : "A'zolar yozgan postlar shu yerda chiqadi."}</p>
        </div>
      ) : (
        items.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            canInteract={canInteract}
            canPin={canSchedule}
            loggedIn={loggedIn}
            requireLogin={requireLogin}
            highlighted={p.id === highlightId}
            groupSlug={apiBase ? null : slug}
            onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== p.id))}
            onChanged={reload}
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
/** datetime-local qiymati → ms (mahalliy vaqt) */
function localToMs(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function Composer({ base, onPosted, allowEvent = false, kind = "group", placeholder }: { base: string; onPosted: () => Promise<void>; allowEvent?: boolean; kind?: "group" | "channel"; placeholder?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<Attachment[]>([]);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventAt, setEventAt] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventMs = eventOpen ? localToMs(eventAt) : null;
  const eventInvalid = eventOpen && (!eventMs || (eventUrl.trim() !== "" && !/^https:\/\/\S+$/.test(eventUrl.trim())));
  const canSend = (body.trim().length > 0 || media.length > 0) && !busy && !uploading && !eventInvalid;

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
      const payload = { body: body.trim(), media, eventAt: eventOpen ? eventMs : null, eventUrl: eventOpen ? eventUrl.trim() : "" };
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = (await res.json()) as ApiResp<{ id: string }>;
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Yuborilmadi");
      setBody("");
      setMedia([]);
      setEventOpen(false);
      setEventAt("");
      setEventUrl("");
      await onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuborilmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <MentionField
        multiline
        value={body}
        onChange={setBody}
        maxLength={POST_BODY_MAX}
        rows={3}
        placeholder={eventOpen ? "Efir mavzusi va qisqa tavsif — birinchi qator sarlavha bo'ladi" : (placeholder ?? (kind === "channel" ? "Kanal e'loni: yangilik, imkoniyat, natija…" : "Jamoa bilan bo'lishing: ish, savol, e'lon… (@ism — eslatish)"))}
        className="field w-full resize-y py-2.5 text-[14px] leading-relaxed"
      />
      {eventOpen && (
        <div className="expand-in mt-2.5 grid gap-2.5 rounded-[14px] border border-accent/30 bg-accent-soft/40 p-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg-3">Efir vaqti</span>
            <input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="field h-10 w-full text-[13.5px]" required />
          </label>
          <label className="grid gap-1">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-fg-3">Havola (Zoom, Meet, YouTube, Telegram) — ixtiyoriy</span>
            <input type="url" value={eventUrl} onChange={(e) => setEventUrl(e.target.value)} placeholder="https://…" dir="ltr" className="field h-10 w-full text-[13.5px]" />
          </label>
          <p className="text-[12px] leading-relaxed text-fg-3 sm:col-span-2">A&apos;zolarga «Jonli efir» bildirishnomasi boradi (sayt + Telegram). Havolani keyinroq izohda ham berishingiz mumkin.</p>
        </div>
      )}
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
        {allowEvent && (
          <button
            type="button"
            onClick={() => setEventOpen((v) => !v)}
            aria-pressed={eventOpen}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition",
              eventOpen ? "border-accent bg-accent-soft text-accent-text" : "border-line-2 text-fg-2 hover:text-fg",
            )}
          >
            <RadioTower size={15} /> Efir / yig&apos;ilish
          </button>
        )}
        <span className="ml-auto text-[11.5px] text-fg-4">
          {body.length}/{POST_BODY_MAX}
        </span>
        <Button type="button" variant="primary" size="sm" onClick={submit} disabled={!canSend}>
          <Send size={14} /> {busy ? "Yuborilmoqda…" : eventOpen ? "Efirni e'lon qilish" : "E'lon qilish"}
        </Button>
      </div>
      {error && <p className="mt-2 text-[12.5px] font-semibold text-danger-text">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Post                                                                */
/* ------------------------------------------------------------------ */
export function PostCard({
  post,
  canInteract,
  canPin,
  loggedIn,
  requireLogin,
  highlighted,
  groupSlug = null,
  onDeleted,
  onChanged,
}: {
  post: PostView;
  canInteract: boolean;
  /** Egasi/admin — qadash va olish */
  canPin: boolean;
  loggedIn: boolean;
  requireLogin: () => boolean;
  highlighted: boolean;
  /** Jamoa slug'i (ulashish havolasi uchun); profil posti — null */
  groupSlug?: string | null;
  onDeleted: () => void;
  onChanged: () => Promise<void>;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const { ref: viewRef, views } = useViewTracker(post.id, post.viewsCount);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [body, setBody] = useState(post.body);
  const [edited, setEdited] = useState(post.edited);
  const [pinned, setPinned] = useState(post.isPinned);
  const [comments, setComments] = useState(post.commentsCount);
  const [open, setOpen] = useState(highlighted);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);

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

  async function patch(payload: Record<string, unknown>) {
    const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = (await res.json()) as ApiResp<{ isPinned: boolean; body: string }>;
    if (!res.ok || !j.ok || !j.data) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Bo'lmadi");
    return j.data;
  }
  async function togglePin() {
    try {
      const d = await patch({ isPinned: !pinned });
      setPinned(d.isPinned);
      toast(d.isPinned ? "Post qadaldi — lentada tepada" : "Qadash olindi");
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bo'lmadi", "error");
    }
  }
  async function saveEdit() {
    const t = draft.trim();
    if (!t || t === body) {
      setEditing(false);
      return;
    }
    try {
      const d = await patch({ body: t });
      setBody(d.body);
      setEdited(true);
      setEditing(false);
      toast("Post yangilandi");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Saqlab bo'lmadi", "error");
    }
  }
  const isAuthor = post.canDelete && loggedIn;

  const media = post.media;
  const single = media.length === 1;
  const lockedLike = loggedIn && !canInteract;
  const permalink = postPermalink(post, groupSlug);

  return (
    <article
      ref={(el) => {
        ref.current = el;
        viewRef.current = el;
      }}
      id={`post-${post.id}`}
      className={cn("card p-4 transition-shadow duration-300 hover:shadow-[var(--shadow-2)] sm:p-5", highlighted && "ring-2 ring-accent/40")}
    >
      <header className="flex items-center gap-2.5">
        <Avatar name={post.author.name} src={post.author.avatarUrl} size={36} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
            <AuthorLink u={post.author} />
            {pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">
                <Pin size={11} /> Qadalgan
              </span>
            )}
          </div>
          <p className="text-[12px] text-fg-3">
            {timeAgo(post.createdAt)}
            {edited && <span className="text-fg-4"> · tahrirlangan</span>}
          </p>
        </div>
        {canPin && (
          <button type="button" onClick={() => void togglePin()} aria-label={pinned ? "Qadashni olish" : "Postni qadash"} title={pinned ? "Qadashni olish" : "Tepaga qadash"} className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            {pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
        )}
        {loggedIn && !post.canDelete && <ReportButton targetType="post" targetId={post.id} loggedIn compact modal />}
        {isAuthor && !editing && post.author.id !== "" && (
          <button type="button" onClick={() => setEditing(true)} aria-label="Postni tahrirlash" className="flex h-8 w-8 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <Pencil size={15} />
          </button>
        )}
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

      {editing ? (
        <div className="mt-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={POST_BODY_MAX} rows={4} className="field w-full resize-y py-2.5 text-[14px] leading-relaxed" autoFocus />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" variant="primary" size="sm" onClick={() => void saveEdit()} disabled={!draft.trim()}>
              Saqlash
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setDraft(body); }}>
              Bekor
            </Button>
          </div>
        </div>
      ) : (
        body && (
          <p className="mt-3 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-fg">
            <RichText text={body} />
          </p>
        )
      )}

      {post.eventAt && <EventBlock at={post.eventAt} url={post.eventUrl} title={body.split("\n")[0] || "Jonli efir"} />}

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

      <footer className="mt-3 flex items-center gap-1 border-t border-line pt-2.5">
        <ReactionButton postId={post.id} initial={post} canInteract={canInteract} requireLogin={requireLogin} lockedTitle={lockedLike ? "Reaksiya qo'yish uchun jamoaga qo'shiling" : undefined} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn("press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition", open ? "bg-fg/6 text-fg" : "text-fg-2 hover:bg-fg/6 hover:text-fg")}
        >
          <MessageCircle size={16} /> {comments}
        </button>
        {permalink && <ShareAction url={permalink} title={body.split("\n")[0] || post.author.name} />}
        <span className="ml-auto inline-flex h-9 items-center gap-1 px-1.5 text-[12.5px] tabular-nums text-fg-3" title={`${views} ta ko'rish`} aria-label={`${views} ta ko'rish`}>
          <Eye size={14} /> {compactCount(views)}
        </span>
        <SaveButton postId={post.id} initial={post.savedByMe} requireLogin={requireLogin} />
      </footer>

      {open && (
        <div className="expand-in">
          <Comments postId={post.id} canWrite={canInteract} loggedIn={loggedIn} onCount={setComments} />
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Izohlar                                                             */
/* ------------------------------------------------------------------ */
export function Comments({ postId, canWrite, onCount, loggedIn = canWrite }: { postId: string; canWrite: boolean; onCount: (n: number) => void; /** Shikoyat tugmasi uchun (yoza olmasa ham kirgan bo'lishi mumkin) */ loggedIn?: boolean }) {
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
            <li key={c.id} className="group flex items-start gap-2">
              <Avatar name={c.author.name} src={c.author.avatarUrl} size={28} decorative />
              <div className="min-w-0 flex-1 rounded-[14px] bg-fg/4 px-3 py-2">
                <div className="flex min-w-0 items-baseline gap-2 text-[12.5px]">
                  <AuthorLink u={c.author} />
                  <span className="shrink-0 text-fg-4">{timeAgo(c.createdAt)}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-0.5">
                    {loggedIn && !c.canDelete && <ReportButton targetType="comment" targetId={c.id} loggedIn compact modal triggerClassName="!h-6 !w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60" />}
                    {c.canDelete && (
                      <button type="button" onClick={() => void remove(c.id)} aria-label="Izohni o'chirish" className="flex h-6 w-6 items-center justify-center rounded-full text-fg-4 transition hover:text-danger-text">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-fg">
                  <RichText text={c.body} />
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <MentionField value={text} onChange={setText} maxLength={COMMENT_MAX} placeholder="Izoh yozing… (@ism — eslatish)" ariaLabel="Izoh" wrapperClassName="min-w-0 flex-1" className="field h-10 w-full text-[13.5px]" />
          <Button type="submit" variant="primary" size="sm" disabled={!text.trim() || busy} aria-label="Izohni yuborish">
            <Send size={14} />
          </Button>
        </form>
      )}
      {error && <p className="mt-1.5 text-[12.5px] font-semibold text-danger-text">{error}</p>}
    </div>
  );
}

/** Efir/yig'ilish bloki: holat (kutilmoqda / jonli / o'tkazildi), vaqt va havola */
function EventBlock({ at, url, title }: { at: number; url: string | null; title: string }) {
  const now = Date.now();
  const live = now >= at && now < at + 2 * 60 * 60 * 1000;
  const past = now >= at + 2 * 60 * 60 * 1000;
  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3", past ? "border-line bg-fg/4" : "border-accent/30 bg-accent-soft/60")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", past ? "bg-fg/6 text-fg-3" : "bg-accent text-white")}>
        <RadioTower size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-fg">{past ? "Efir o'tkazildi" : live ? "Hozir jonli efirda" : "Jonli efir / yig'ilish"}</p>
        <p className="text-[12.5px] text-fg-2">
          {formatDateTime(at)}
          {!past && !live && <span className="text-fg-3"> · {untilLabel(at - now)}</span>}
        </p>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold", live ? "btn-accent" : "border border-line-2 text-fg hover:border-fg")}>
          {live ? "Qo'shilish" : past ? "Yozuv/havola" : "Havola"} <ExternalLink size={14} />
        </a>
      ) : (
        !past && <span className="text-[12px] text-fg-3">Havola efir oldidan qo&apos;shiladi</span>
      )}
      {!past && (
        <div className="basis-full">
          <CalendarLinks title={title} at={at} url={url} compact />
        </div>
      )}
    </div>
  );
}

function untilLabel(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} daqiqadan keyin`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} soatdan keyin`;
  return `${Math.round(h / 24)} kundan keyin`;
}
