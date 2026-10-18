"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Link2, MessageCircle, Trash2, X } from "lucide-react";
import { useViewTracker } from "@/components/groups/useViewTracker";
import { compactCount } from "@/lib/utils";
import { ReactionButton, SaveButton, type ReactionState } from "@/components/groups/Reactions";
import { Avatar, Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePresence } from "@/components/motion/usePresence";
import { Comments } from "@/components/groups/GroupFeed";
import { RichText } from "@/components/groups/RichText";
import { isVideoAttachment } from "@/components/chat/attachments";
import type { PostView } from "@/lib/groups/service";
import { cn, timeAgo } from "@/lib/utils";

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

/**
 * Post / ish oynasi (Instagram uslubi): chapda media (varaqlanadi), o'ngda muallif, matn, like, izohlar.
 * `item` null bo'lganda chiqish animatsiyasi o'ynab yopiladi (usePresence). Esc / fon / × yopadi.
 */
export function PostModal({
  item,
  author,
  loggedIn,
  viewerId,
  isAdmin,
  shareBase,
  onClose,
  onDeleted,
  onLiked,
}: {
  item: ModalItem | null;
  author: ModalAuthor;
  loggedIn: boolean;
  viewerId: string | null;
  isAdmin: boolean;
  /** Ulashish havolasi asosi: /mutaxassislar/<slug> */
  shareBase: string;
  onClose: () => void;
  onDeleted: (postId: string) => void;
  onLiked?: (postId: string, state: ReactionState) => void;
}) {
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
    <div
      className={cn("fixed inset-0 z-[120] flex items-center justify-center bg-ink/70 p-0 backdrop-blur-sm sm:p-6", closing ? "animate-fade-out" : "animate-fade-in")}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={shown.kind === "post" ? "Post" : shown.work.title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "card-elevated flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden !rounded-none sm:max-h-[90vh] sm:!rounded-[24px] md:flex-row",
          closing ? "animate-modal-out" : "animate-modal-in",
        )}
      >
        <button type="button" onClick={onClose} aria-label="Yopish" className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink/60 text-white backdrop-blur transition hover:bg-ink/80 md:bg-fg/10 md:text-fg md:hover:bg-fg/20">
          <X size={18} />
        </button>
        {shown.kind === "post" ? (
          <PostBody key={key} post={shown.post} loggedIn={loggedIn} viewerId={viewerId} isAdmin={isAdmin} shareBase={shareBase} onClose={onClose} onDeleted={onDeleted} onLiked={onLiked} />
        ) : (
          <WorkBody key={key} work={shown.work} author={author} />
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Media varaqlagich                                                   */
/* ------------------------------------------------------------------ */
function MediaPane({ media, alt }: { media: Array<{ url: string; type: string }>; alt: string }) {
  const [i, setI] = useState(0);
  const m = media[i];
  if (!m) return null;
  const video = isVideoAttachment(m) || PLAYABLE.test(m.url);
  return (
    <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-ink sm:min-h-[360px] md:min-h-[520px]">
      {video ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video key={m.url} src={m.url} controls playsInline className="max-h-[70vh] w-full object-contain md:max-h-[90vh]" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={m.url} src={m.url} alt={alt} className="animate-fade-in max-h-[70vh] w-full object-contain md:max-h-[90vh]" />
      )}
      {media.length > 1 && (
        <>
          <button type="button" onClick={() => setI((v) => (v - 1 + media.length) % media.length)} aria-label="Oldingi" className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setI((v) => (v + 1) % media.length)} aria-label="Keyingi" className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5" aria-hidden>
            {media.map((x, k) => (
              <span key={x.url + k} className={cn("h-1.5 w-1.5 rounded-full transition", k === i ? "bg-white" : "bg-white/40")} />
            ))}
          </div>
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
  loggedIn,
  viewerId,
  isAdmin,
  shareBase,
  onClose,
  onDeleted,
  onLiked,
}: {
  post: PostView;
  loggedIn: boolean;
  viewerId: string | null;
  isAdmin: boolean;
  shareBase: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onLiked?: (postId: string, state: ReactionState) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { views } = useViewTracker(post.id, post.viewsCount, { immediate: true });
  const [comments, setComments] = useState(post.commentsCount);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const canDelete = Boolean(viewerId && (viewerId === post.author.id || isAdmin));
  const textOnly = post.media.length === 0;

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
      if (!res.ok || !j.ok) throw new Error(j.error || "O'chirilmadi");
      toast("Post o'chirildi");
      onDeleted(post.id);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "O'chirilmadi", "error");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const url = `${window.location.origin}${shareBase}?post=${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Havola nusxalandi");
    } catch {
      toast(url, "info");
    }
  }

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
        <p className="text-[12px] text-fg-3" suppressHydrationWarning>
          {timeAgo(post.createdAt)}
          {post.edited && " · tahrirlangan"}
        </p>
      </div>
    </div>
  );
  const actions = (
    <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
      <ReactionButton postId={post.id} initial={post} canInteract size="lg" requireLogin={requireLogin} onChange={(st) => onLiked?.(post.id, st)} />
      <span className="inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-semibold text-fg-2">
        <MessageCircle size={18} /> <span className="tabular-nums">{comments}</span>
      </span>
      <span className="inline-flex h-10 items-center gap-1.5 px-2 text-[13px] text-fg-3" title={`${views} ta ko'rish`}>
        <Eye size={17} /> <span className="tabular-nums">{compactCount(views)}</span>
      </span>
      <button type="button" onClick={share} className="press inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-fg/6 hover:text-fg">
        <Link2 size={17} /> Ulashish
      </button>
      <SaveButton postId={post.id} initial={post.savedByMe} requireLogin={requireLogin} size="lg" />
      {canDelete && (
        <span className="ml-auto">
          {confirm ? (
            <span className="inline-flex items-center gap-1.5 expand-in">
              <Button size="sm" variant="danger" className="!h-9" onClick={remove} disabled={busy}>
                Ha, o&apos;chirish
              </Button>
              <Button size="sm" variant="outline" className="!h-9" onClick={() => setConfirm(false)}>
                Yo&apos;q
              </Button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} aria-label="Postni o'chirish" title="O'chirish" className="flex h-10 w-10 items-center justify-center rounded-full text-fg-3 transition hover:bg-danger-soft hover:text-danger-text">
              <Trash2 size={16} />
            </button>
          )}
        </span>
      )}
    </div>
  );

  return (
    <>
      {!textOnly && <MediaPane media={post.media} alt={post.body.slice(0, 120)} />}
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
function WorkBody({ work, author }: { work: WorkLite; author: ModalAuthor }) {
  const media = work.type === "link" ? (work.thumbnailUrl ? [{ url: work.thumbnailUrl, type: "image/*" }] : []) : [{ url: work.url, type: work.type === "video" ? "video/mp4" : "image/*" }];
  const playable = work.type !== "video" || PLAYABLE.test(work.url);
  return (
    <>
      {media.length > 0 && playable ? (
        <MediaPane media={media} alt={work.title} />
      ) : (
        <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-3 bg-ink p-6 text-center text-white sm:min-h-[360px]">
          <p className="text-[15px] font-semibold">{work.type === "video" ? "Video tashqi manbada" : "Havola"}</p>
          <a href={work.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-ink">
            Ochish <ExternalLink size={15} />
          </a>
        </div>
      )}
      <div className="flex min-h-0 flex-col bg-surface md:w-[380px] md:shrink-0 md:border-l md:border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Avatar name={author.name} src={author.avatarUrl} size={36} decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">{author.name}</p>
            <p className="text-[12px] text-fg-3">Portfolio ishi</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <h3 className="font-display text-[18px] font-semibold text-fg">{work.title}</h3>
          {work.description && <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-fg-2">{work.description}</p>}
          {work.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Teglar">
              {work.tags.map((t) => (
                <li key={t} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-fg-2">
                  #{t}
                </li>
              ))}
            </ul>
          )}
          {work.type === "link" && (
            <a href={work.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg transition hover:border-fg">
              Manbani ochish <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
