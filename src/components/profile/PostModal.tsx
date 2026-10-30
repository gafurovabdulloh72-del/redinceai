"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Check, Eye, ImagePlus, Link2, MessageCircle, Pin, PinOff, Send, Trash2, X, MessageSquareText } from "lucide-react";
import { useViewTracker } from "@/components/groups/useViewTracker";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { compactCount } from "@/lib/utils";
import { ReactionButton, SaveButton, type ReactionState } from "@/components/groups/Reactions";
import { Avatar, Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ShareSheet } from "@/components/social/ShareSheet";
import { uploadAttachment } from "@/components/chat/attachments";
import { VideoCoverPicker } from "@/components/ui/VideoCoverPicker";
import { usePresence } from "@/components/motion/usePresence";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Comments } from "@/components/groups/GroupFeed";
import { RichText } from "@/components/groups/RichText";
import { isVideoAttachment } from "@/components/chat/attachments";
import type { PostView } from "@/lib/groups/service";
import { tr, type Locale } from "@/lib/i18n";
import { POST_OYNA } from "@/lib/i18n/dict/profile";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { cn } from "@/lib/utils";

export interface WorkLite {
  id: string;
  title: string;
  type: "image" | "video" | "link";
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  tags: string[];
  beforeUrl: string | null;
}
export type ModalItem = { kind: "post"; post: PostView } | { kind: "work"; work: WorkLite };
export interface ModalAuthor {
  name: string;
  avatarUrl: string | null;
  slug: string | null;
}

const PLAYABLE = /\.(?:mp4|webm|mov)(?:$|\?)/i;
const EDITABLE = /^(INPUT|TEXTAREA|SELECT)$/;

/**
 * Post / ish oynasi (Instagram uslubi): chapda media (varaqlanadi — tugma yoki ←/→), o'ngda muallif, matn, like, izohlar.
 * `item` null bo'lganda chiqish animatsiyasi o'ynab yopiladi (usePresence). Esc / fon / × yopadi; fokus oyna ichida qoladi
 * va yopilganda ochgan elementga qaytadi (useFocusTrap). Matnlar — POST_OYNA lug'ati (uz/ru).
 */
export function PostModal({
  item,
  author,
  loggedIn,
  viewerId,
  isAdmin,
  shareBase,
  canPin = false,
  onClose,
  onDeleted,
  onLiked,
  onPinned,
  onPoster,
}: {
  item: ModalItem | null;
  author: ModalAuthor;
  loggedIn: boolean;
  viewerId: string | null;
  isAdmin: boolean;
  /** Ulashish havolasi asosi: /mutaxassislar/<slug> */
  shareBase: string;
  /** Profil egasi — postni qadash/olish */
  canPin?: boolean;
  onClose: () => void;
  onDeleted: (postId: string) => void;
  onLiked?: (postId: string, state: ReactionState) => void;
  onPinned?: (postId: string, pinned: boolean) => void;
  /** Video muqovasi almashtirildi (ota ro'yxat plitkasini yangilaydi) */
  onPoster?: (postId: string, index: number, url: string) => void;
}) {
  const til = useLocale();
  const open = item !== null;
  const { mounted, closing } = usePresence(open, 200);
  // Portal: ota-element (karta) animatsiya transform'i va overflow-hidden tufayli fixed oyna cheklanmasin
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);
  // Yopilish animatsiyasi davomida oxirgi element ko'rinib turadi
  const [shown, setShown] = useState<ModalItem | null>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, mounted && !closing && portalReady);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !shown || !portalReady) return null;
  const key = shown.kind === "post" ? shown.post.id : shown.work.id;
  return createPortal(
    <div className={cn("fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-0 sm:p-6", closing ? "overlay-out" : "overlay-in")} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={shown.kind === "post" ? tr(til, POST_OYNA.post) : shown.work.title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "card-elevated relative flex max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden !rounded-none sm:max-h-[90vh] sm:!rounded-[var(--r-lg)] md:flex-row",
          closing ? "pop-out" : "pop-in",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={tr(til, POST_OYNA.close)}
          className="press absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 md:bg-fg/10 md:text-fg md:hover:bg-fg/20"
        >
          <X size={18} />
        </button>
        {shown.kind === "post" ? (
          <PostBody key={key} post={shown.post} til={til} loggedIn={loggedIn} viewerId={viewerId} isAdmin={isAdmin} shareBase={shareBase} canPin={canPin} onClose={onClose} onDeleted={onDeleted} onLiked={onLiked} onPinned={onPinned} onPoster={onPoster} />
        ) : (
          <WorkBody key={key} work={shown.work} author={author} til={til} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Media varaqlagich — tugmalar va ←/→ (matn maydonida emas)             */
/* ------------------------------------------------------------------ */
function MediaPane({ media, alt, til, postId, resumeAt = 0 }: { media: Array<{ url: string; type: string; poster?: string }>; alt: string; til: Locale; /** Ko'rish holatini saqlash (davom ettirish + tarix) */ postId?: string; resumeAt?: number }) {
  const [i, setI] = useState(0);
  const total = media.length;
  const prev = useCallback(() => setI((v) => (v - 1 + total) % total), [total]);
  const next = useCallback(() => setI((v) => (v + 1) % total), [total]);
  useEffect(() => {
    if (total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (EDITABLE.test(el.tagName) || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, prev, next]);
  // Telefon: chap/o'ng surish — keyingi/oldingi rasm (Instagram karuseli); vertikal harakat scroll'ga qoldiriladi
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current;
    touch.current = null;
    if (!st || total < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) (dx < 0 ? next : prev)();
  };
  const m = media[i];
  if (!m) return null;
  const video = isVideoAttachment(m) || PLAYABLE.test(m.url);
  return (
    <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-black sm:min-h-[360px] md:min-h-[520px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {video ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={m.url}
          src={m.url}
          poster={m.poster}
          ref={(el) => {
            if (!el || !postId) return;
            // Davom ettirish: saqlangan joydan (oxiriga 10 s qolmagan bo'lsa)
            if (resumeAt && !el.dataset.resumed) {
              el.dataset.resumed = "1";
              const apply = () => {
                if (el.duration && resumeAt < el.duration - 10) el.currentTime = resumeAt;
              };
              if (el.readyState >= 1) apply();
              else el.addEventListener("loadedmetadata", apply, { once: true });
            }
            if (el.dataset.tracked) return;
            el.dataset.tracked = "1";
            let last = 0;
            const send = (force = false) => {
              const now = Date.now();
              if ((!force && now - last < 15_000) || !el.currentTime) return;
              last = now;
              void fetch(`/api/posts/${encodeURIComponent(postId)}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ position: Math.floor(el.currentTime), duration: Math.floor(el.duration || 0) }),
                keepalive: true,
              }).catch(() => undefined);
            };
            el.addEventListener("timeupdate", () => send());
            el.addEventListener("pause", () => send(true));
            el.addEventListener("ended", () => send(true));
          }}
          controls playsInline className="max-h-[70vh] w-full object-contain md:max-h-[90vh]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.url} src={m.url} alt={alt} className="animate-fade-in max-h-[70vh] w-full object-contain md:max-h-[90vh]" />
      )}
      {total > 1 && (
        <>
          {/* Telefonda strelkalar yo'q (surish bilan), o'ngda «1/3» hisoblagich */}
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-white sm:hidden" aria-hidden>
            {i + 1}/{total}
          </span>
          <button type="button" onClick={prev} aria-label={tr(til, POST_OYNA.prev)} className="press absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink transition hover:bg-white max-sm:hidden">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={next} aria-label={tr(til, POST_OYNA.next)} className="press absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink transition hover:bg-white max-sm:hidden">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
            {media.map((x, k) => (
              <span key={x.url + k} className={cn("h-1.5 w-1.5 rounded-full transition", k === i ? "bg-white" : "bg-white/40")} />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            {i + 1} / {total}
          </span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Post: muallif, matn, like, izohlar                                  */
/* ------------------------------------------------------------------ */
function PostBody({
  post,
  til,
  loggedIn,
  viewerId,
  isAdmin,
  shareBase,
  canPin,
  onClose,
  onDeleted,
  onLiked,
  onPinned,
  onPoster,
}: {
  post: PostView;
  til: Locale;
  loggedIn: boolean;
  viewerId: string | null;
  isAdmin: boolean;
  shareBase: string;
  canPin: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onLiked?: (postId: string, state: ReactionState) => void;
  onPinned?: (postId: string, pinned: boolean) => void;
  /** Video muqovasi almashtirildi (ota ro'yxat plitkasini yangilaydi) */
  onPoster?: (postId: string, index: number, url: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { views } = useViewTracker(post.id, post.viewsCount, { immediate: true });
  const [comments, setComments] = useState(post.commentsCount);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState(post.isPinned);
  const [mediaList, setMediaList] = useState(post.media);
  const [posterOpen, setPosterOpen] = useState(false);
  const videoIdx = mediaList.findIndex((m) => isVideoAttachment(m));
  const canDelete = Boolean(viewerId && (viewerId === post.author.id || isAdmin));
  const textOnly = post.media.length === 0;
  const shareUrl = `${window.location.origin}${shareBase}?post=${post.id}`;

  function requireLogin(): boolean {
    if (loggedIn) return true;
    router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return false;
  }
  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, POST_OYNA.deleteFailed));
      toast(tr(til, POST_OYNA.deleted));
      onDeleted(post.id);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, POST_OYNA.deleteFailed), "error");
    } finally {
      setBusy(false);
    }
  }
  // Havolani nusxalash: ikonka vaqtincha ✓ ga almashadi (pop animatsiyasi bilan)
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(shareUrl, "info");
    }
  }
  async function changePoster(file: File) {
    try {
      const up = await uploadAttachment(file);
      const res = await fetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ poster: { index: videoIdx, url: up.url } }) });
      const j = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string> };
      if (!res.ok || !j.ok) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || "Muqova saqlanmadi");
      setMediaList((l) => l.map((m, i) => (i === videoIdx ? { ...m, poster: up.url } : m)));
      onPoster?.(post.id, videoIdx, up.url);
      toast("Muqova yangilandi");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Muqova saqlanmadi", "error");
    }
  }
  async function togglePin() {
    if (busy) return;
    setBusy(true);
    const next = !pinned;
    try {
      const res = await fetch(`/api/profil/postlar/${encodeURIComponent(post.id)}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: next }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, POST_OYNA.pinFailed));
      setPinned(next);
      onPinned?.(post.id, next);
      toast(tr(til, next ? POST_OYNA.pinnedDone : POST_OYNA.unpinnedDone));
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, POST_OYNA.pinFailed), "error");
    } finally {
      setBusy(false);
    }
  }

  const iconBtn = "press flex h-10 w-10 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg";
  const header = (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <Avatar name={post.author.name} src={post.author.avatarUrl} size={36} decorative />
      <div className="min-w-0 flex-1">
        {post.author.slug ? (
          <Link href={`/mutaxassislar/${post.author.slug}`} className="block truncate text-[14px] font-semibold text-fg hover:underline">
            {post.author.name}
          </Link>
        ) : (
          <p className="truncate text-[14px] font-semibold text-fg">{post.author.name}</p>
        )}
        <p className="flex items-center gap-1.5 text-[12px] text-fg-3" suppressHydrationWarning>
          {timeAgoLabel(til, post.createdAt)}
          {post.edited && <span>· {tr(til, POST_OYNA.edited)}</span>}
          {pinned && (
            <span className="inline-flex items-center gap-0.5 text-fg-2">
              · <Pin size={11} aria-hidden /> {tr(til, POST_OYNA.pinned)}
            </span>
          )}
        </p>
      </div>
      {/* Mijoz post/videoni ko'rayotganda ijodkor bilan darhol gaplashish */}
      {post.author.username && viewerId !== post.author.id && (
        <Link href={loggedIn ? `/yozish/${post.author.username}` : `/auth/kirish?next=${encodeURIComponent(`/yozish/${post.author.username}`)}`} className="btn-accent inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
          <MessageSquareText size={15} /> Yozish
        </Link>
      )}
      {canPin && (
        <button type="button" onClick={togglePin} disabled={busy} aria-pressed={pinned} aria-label={tr(til, pinned ? POST_OYNA.unpin : POST_OYNA.pin)} title={tr(til, pinned ? POST_OYNA.unpin : POST_OYNA.pin)} className={cn(iconBtn, "mr-9", pinned && "text-fg")}>
          {pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      )}
    </div>
  );
  const actions = (
    <div className="flex items-center gap-0.5 border-t border-line px-2 py-1.5">
      <ReactionButton postId={post.id} initial={post} canInteract size="lg" requireLogin={requireLogin} onChange={(st) => onLiked?.(post.id, st)} />
      <span className="inline-flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-semibold text-fg-2" aria-label={POST_OYNA.comments[til](comments)}>
        <MessageCircle size={18} aria-hidden /> <span className="tabular-nums">{comments}</span>
      </span>
      <span className="inline-flex h-10 items-center gap-1.5 px-2 text-[13px] text-fg-3" aria-label={POST_OYNA.views[til](views)} title={POST_OYNA.views[til](views)}>
        <Eye size={17} aria-hidden /> <span className="tabular-nums">{compactCount(views)}</span>
      </span>
      <button type="button" onClick={share} aria-label={tr(til, copied ? POST_OYNA.linkCopied : POST_OYNA.share)} title={tr(til, copied ? POST_OYNA.linkCopied : POST_OYNA.share)} className={cn(iconBtn, copied && "text-success-text")}>
        {copied ? <Check key="ok" size={18} className="animate-pop" /> : <Link2 key="link" size={17} />}
      </button>
      <span role="status" className="sr-only">{copied ? tr(til, POST_OYNA.linkCopied) : ""}</span>
      <button type="button" onClick={() => setShareOpen(true)} aria-label={tr(til, POST_OYNA.sendTo)} title={tr(til, POST_OYNA.sendTo)} className={iconBtn}>
        <Send size={16} />
      </button>
      {shareOpen && <ShareSheet open onClose={() => setShareOpen(false)} loggedIn={loggedIn} title={post.body.slice(0, 80) || "Post"} url={shareUrl} />}
      {canDelete && videoIdx >= 0 && (
        <>
          <button type="button" onClick={() => setPosterOpen(true)} aria-label="Muqovani o'zgartirish" title="Muqovani o'zgartirish" className={iconBtn}>
            <ImagePlus size={17} />
          </button>
          {posterOpen && <VideoCoverPicker open onClose={() => setPosterOpen(false)} src={mediaList[videoIdx].url} onPick={(f) => changePoster(f)} />}
        </>
      )}
      <SaveButton postId={post.id} initial={post.savedByMe} requireLogin={requireLogin} size="lg" />
      {canDelete && (
        <span className="ml-auto">
          {confirm ? (
            <span className="expand-in inline-flex items-center gap-1.5">
              <Button size="sm" variant="danger" className="!h-9" onClick={remove} disabled={busy}>
                {tr(til, POST_OYNA.yesDelete)}
              </Button>
              <Button size="sm" variant="outline" className="!h-9" onClick={() => setConfirm(false)}>
                {tr(til, POST_OYNA.no)}
              </Button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} aria-label={tr(til, POST_OYNA.deletePost)} title={tr(til, POST_OYNA.deleteShort)} className={cn(iconBtn, "hover:bg-danger-soft hover:text-danger-text")}>
              <Trash2 size={16} />
            </button>
          )}
        </span>
      )}
    </div>
  );

  return (
    <>
      {!textOnly && <MediaPane media={mediaList} alt={post.body.slice(0, 120)} til={til} postId={post.id} resumeAt={post.resumeAt} />}
      <div className={cn("flex min-h-0 flex-col bg-surface", textOnly ? "w-full" : "md:w-[380px] md:shrink-0 md:border-l md:border-line")}>
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {post.body && <RichText text={post.body} className={cn("whitespace-pre-wrap break-words leading-relaxed text-fg", textOnly ? "text-[17px] sm:text-[19px]" : "text-[14.5px]")} />}
          <div className="mt-4">
            <Comments postId={post.id} canWrite={loggedIn} onCount={setComments} />
          </div>
        </div>
        {actions}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio ishi                                                      */
/* ------------------------------------------------------------------ */
function WorkBody({ work, author, til }: { work: WorkLite; author: ModalAuthor; til: Locale }) {
  const media = work.type === "link" ? (work.thumbnailUrl ? [{ url: work.thumbnailUrl, type: "image/*" }] : []) : [{ url: work.url, type: work.type === "video" ? "video/mp4" : "image/*" }];
  const playable = work.type !== "video" || PLAYABLE.test(work.url);
  return (
    <>
      {media.length > 0 && playable ? (
        <MediaPane media={media} alt={work.title} til={til} />
      ) : (
        <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white sm:min-h-[360px]">
          <p className="text-[15px] font-semibold">{tr(til, work.type === "video" ? POST_OYNA.externalVideo : POST_OYNA.link)}</p>
          <a href={work.url} target="_blank" rel="noopener noreferrer" className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-ink">
            {tr(til, POST_OYNA.open)} <ExternalLink size={15} />
          </a>
        </div>
      )}
      <div className="flex min-h-0 flex-col bg-surface md:w-[380px] md:shrink-0 md:border-l md:border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Avatar name={author.name} src={author.avatarUrl} size={36} decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">{author.name}</p>
            <p className="text-[12px] text-fg-3">{tr(til, POST_OYNA.work)}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <h3 className="font-display text-[18px] font-semibold text-fg">{work.title}</h3>
          {work.description && <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-fg-2">{work.description}</p>}
          {work.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={tr(til, POST_OYNA.tags)}>
              {work.tags.map((t) => (
                <li key={t} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-fg-2">
                  #{t}
                </li>
              ))}
            </ul>
          )}
          {work.type === "link" && (
            <a href={work.url} target="_blank" rel="noopener noreferrer" className="press mt-4 inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg">
              {tr(til, POST_OYNA.openSource)} <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
