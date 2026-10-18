"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Grid3x3, Images, PenSquare, Play, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Composer } from "@/components/groups/GroupFeed";
import { PortfolioGallery } from "@/components/specialists/PortfolioGallery";
import { isVideoAttachment } from "@/components/chat/attachments";
import type { PostView } from "@/lib/groups/service";
import { cn } from "@/lib/utils";
import { MediaTile, type MediaTileData } from "./MediaTile";
import { PostModal, type ModalItem, type WorkLite } from "./PostModal";

type Tab = "postlar" | "videolar" | "ishlar";
type Page = { items: PostView[]; nextCursor: number | null };
type ApiResp<T> = { ok: boolean; data?: T; error?: string };

const T = {
  uz: { feed: "Lenta", posts: "Postlar", videos: "Videolar", works: "Ishlar", post: "post", video: "video", work: "ish", newPost: "Post joylash", close: "Yopish", more: "Yana yuklash", loading: "Yuklanmoqda…", emptyPostsOwn: "Birinchi postingizni joylang — ish jarayoni, natija yoki fikr. Obunachilaringizga xabar boradi.", emptyPosts: "Hali postlar yo'q.", emptyVideos: "Hali videolar yo'q.", emptyWorks: "Hali ishlar qo'shilmagan.", placeholder: "Nima yangilik? Ish jarayoni, natija, fikr…" },
  ru: { feed: "Лента", posts: "Посты", videos: "Видео", works: "Работы", post: "постов", video: "видео", work: "работ", newPost: "Опубликовать", close: "Закрыть", more: "Показать ещё", loading: "Загрузка…", emptyPostsOwn: "Опубликуйте первый пост — процесс, результат или мысль. Подписчики получат уведомление.", emptyPosts: "Постов пока нет.", emptyVideos: "Видео пока нет.", emptyWorks: "Работы пока не добавлены.", placeholder: "Что нового? Процесс, результат, мысль…" },
} as const;

function tileOf(p: PostView): MediaTileData {
  const first = p.media[0];
  const video = first ? isVideoAttachment(first) : false;
  return {
    thumbUrl: first && !video ? first.url : null,
    videoUrl: first && video ? first.url : null,
    isVideo: video,
    textOnly: p.media.length === 0,
    count: p.media.length,
    caption: p.body,
    likes: p.likesCount,
    comments: p.commentsCount,
  };
}
function workTile(w: WorkLite): MediaTileData {
  return { thumbUrl: w.type === "image" ? w.url : w.thumbnailUrl, videoUrl: w.type === "video" ? w.url : null, isVideo: w.type === "video", textOnly: false, count: 1, caption: w.title };
}
const hasVideo = (p: PostView) => p.media.some((m) => isVideoAttachment(m));

/**
 * Profil lentasi (Instagram uslubi): Postlar / Videolar / Ishlar bo'limlari, kvadrat plitkalar, post oynasi.
 * URL bilan sinxron: ?tab=postlar|videolar|ishlar, ?post=<id> (ulashish havolasi). Egasi shu yerdan post joylaydi.
 */
export function ProfileTabs({
  til,
  slug,
  userId,
  name,
  isOwner,
  loggedIn,
  isAdmin,
  viewerId,
  avatarUrl,
  counts,
  initialPosts,
  openPost,
  initialTab,
  works,
}: {
  til: "uz" | "ru";
  slug: string;
  userId: string;
  name: string;
  isOwner: boolean;
  loggedIn: boolean;
  isAdmin: boolean;
  viewerId: string | null;
  avatarUrl: string | null;
  counts: { posts: number; videos: number; works: number };
  initialPosts: Page;
  openPost: PostView | null;
  initialTab: Tab;
  works: WorkLite[];
}) {
  const t = T[til];
  const [tab, setTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState(initialPosts.items);
  const [cursor, setCursor] = useState(initialPosts.nextCursor);
  const [videoPosts, setVideoPosts] = useState<PostView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [composer, setComposer] = useState(false);
  const [n, setN] = useState(counts);
  const [openItem, setOpenItem] = useState<ModalItem | null>(openPost ? { kind: "post", post: openPost } : null);
  const base = `/api/profil/postlar?user=${encodeURIComponent(userId)}`;
  const shareBase = `/mutaxassislar/${slug}`;

  const syncUrl = useCallback((patch: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const loadVideos = useCallback(async () => {
    const res = await fetch(`${base}&filter=video&limit=48`, { cache: "no-store" });
    const j = (await res.json()) as ApiResp<Page>;
    if (j.ok && j.data) setVideoPosts(j.data.items);
  }, [base]);

  useEffect(() => {
    if (tab === "videolar" && videoPosts === null) void loadVideos();
  }, [tab, videoPosts, loadVideos]);

  function selectTab(next: Tab) {
    setTab(next);
    syncUrl({ tab: next });
  }
  function open(item: ModalItem) {
    setOpenItem(item);
    if (item.kind === "post") syncUrl({ post: item.post.id });
  }
  const close = useCallback(() => {
    setOpenItem(null);
    syncUrl({ post: null });
  }, [syncUrl]);

  const reload = useCallback(async () => {
    const res = await fetch(`${base}&limit=18`, { cache: "no-store" });
    const j = (await res.json()) as ApiResp<Page>;
    if (j.ok && j.data) {
      setItems(j.data.items);
      setCursor(j.data.nextCursor);
    }
    setVideoPosts(null);
  }, [base]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}&limit=18&cursor=${cursor}`, { cache: "no-store" });
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
      setLoading(false);
    }
  }

  const onPosted = useCallback(async () => {
    setComposer(false);
    await reload();
    setN((c) => ({ ...c, posts: c.posts + 1 }));
    setTab("postlar");
  }, [reload]);

  function onDeleted(id: string) {
    const gone = items.find((p) => p.id === id) ?? videoPosts?.find((p) => p.id === id);
    setItems((prev) => prev.filter((p) => p.id !== id));
    setVideoPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    setN((c) => ({ ...c, posts: Math.max(0, c.posts - 1), videos: gone && hasVideo(gone) ? Math.max(0, c.videos - 1) : c.videos }));
  }
  function onLiked(id: string, liked: boolean, likes: number) {
    const upd = (p: PostView) => (p.id === id ? { ...p, likedByMe: liked, likesCount: likes } : p);
    setItems((prev) => prev.map(upd));
    setVideoPosts((prev) => (prev ? prev.map(upd) : prev));
  }

  const videoWorks = useMemo(() => works.filter((w) => w.type === "video"), [works]);
  const videoList = videoPosts ?? items.filter(hasVideo);
  const totalVideos = n.videos + videoWorks.length;

  const tabs: Array<{ key: Tab; label: string; icon: typeof Grid3x3; count: number }> = [
    { key: "postlar", label: t.posts, icon: Grid3x3, count: n.posts },
    { key: "videolar", label: t.videos, icon: Play, count: totalVideos },
    { key: "ishlar", label: t.works, icon: Images, count: n.works },
  ];

  return (
    <div className="card overflow-hidden">
      {/* Sarlavha: eyebrow + sonlar + egasi uchun "Post joylash" */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div>
          <span className="eyebrow">{t.feed}</span>
          <p className="mt-1 text-[13.5px] text-fg-2">
            <b className="font-semibold text-fg tabular-nums">{n.posts}</b> {t.post} · <b className="font-semibold text-fg tabular-nums">{totalVideos}</b> {t.video} · <b className="font-semibold text-fg tabular-nums">{n.works}</b> {t.work}
          </p>
        </div>
        {isOwner && (
          <Button type="button" variant={composer ? "outline" : "accent"} size="md" onClick={() => setComposer((v) => !v)} className="icon-spin-hover">
            {composer ? <X size={15} /> : <PenSquare size={15} />} {composer ? t.close : t.newPost}
          </Button>
        )}
      </div>
      {isOwner && composer && (
        <div className="expand-in px-4 pt-4 sm:px-6">
          <Composer base="/api/profil/postlar" onPosted={onPosted} kind="channel" placeholder={t.placeholder} />
        </div>
      )}

      {/* Bo'limlar — Instagram uslubida ustki chiziq bilan */}
      <div role="tablist" aria-label={t.feed} className="mt-4 flex border-t border-line">
        {tabs.map((x) => {
          const active = tab === x.key;
          const Icon = x.icon;
          return (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(x.key)}
              className={cn(
                "relative -mt-px flex h-12 flex-1 items-center justify-center gap-1.5 border-t-2 text-[12px] font-bold uppercase tracking-[0.08em] transition sm:flex-none sm:px-6",
                active ? "border-fg text-fg" : "border-transparent text-fg-3 hover:text-fg",
              )}
            >
              <Icon size={15} aria-hidden /> {x.label} <span className={cn("tabular-nums", active ? "text-fg-2" : "text-fg-4")}>{x.count}</span>
            </button>
          );
        })}
      </div>

      <div className="p-1.5 sm:p-3">
        {tab === "postlar" && (
          <div key="postlar" className="animate-fade-in">
            {items.length === 0 ? (
              <Empty text={isOwner ? t.emptyPostsOwn : t.emptyPosts} />
            ) : (
              <ul className="stagger grid grid-cols-3 gap-1 sm:gap-2" aria-label={t.posts}>
                {items.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => open({ kind: "post", post: p })} className="press block w-full rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:rounded-[14px]" aria-label={p.body.slice(0, 80) || "Post"}>
                      <MediaTile d={tileOf(p)} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cursor && (
              <div className="flex justify-center py-4">
                <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                  {loading ? t.loading : t.more}
                </Button>
              </div>
            )}
          </div>
        )}
        {tab === "videolar" && (
          <div key="videolar" className="animate-fade-in">
            {videoList.length === 0 && videoWorks.length === 0 ? (
              <Empty text={t.emptyVideos} />
            ) : (
              <ul className="stagger grid grid-cols-3 gap-1 sm:gap-2" aria-label={t.videos}>
                {videoList.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => open({ kind: "post", post: p })} className="press block w-full rounded-[10px] sm:rounded-[14px]" aria-label={p.body.slice(0, 80) || "Video"}>
                      <MediaTile d={tileOf(p)} />
                    </button>
                  </li>
                ))}
                {videoWorks.map((w) => (
                  <li key={w.id}>
                    <button type="button" onClick={() => open({ kind: "work", work: w })} className="press block w-full rounded-[10px] sm:rounded-[14px]" aria-label={w.title}>
                      <MediaTile d={workTile(w)} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === "ishlar" && (
          <div key="ishlar" className="animate-fade-in p-1.5 sm:p-2">
            {works.length === 0 ? <Empty text={t.emptyWorks} /> : <PortfolioGallery items={works} />}
          </div>
        )}
      </div>

      <PostModal item={openItem} author={{ name, avatarUrl, slug }} loggedIn={loggedIn} viewerId={viewerId} isAdmin={isAdmin} shareBase={shareBase} onClose={close} onDeleted={onDeleted} onLiked={onLiked} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-12 text-center text-[14px] text-fg-3">{text}</p>;
}
