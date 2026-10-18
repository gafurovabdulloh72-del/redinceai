"use client";

import type { ReactionState } from "@/components/groups/Reactions";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Grid3x3, Images, PenSquare, Play, X } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { Composer } from "@/components/groups/GroupFeed";
import { PortfolioGallery } from "@/components/specialists/PortfolioGallery";
import { isVideoAttachment } from "@/components/chat/attachments";
import type { PostView } from "@/lib/groups/service";
import { tr } from "@/lib/i18n";
import { POST_OYNA } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";
import { MediaTile, type MediaTileData } from "./MediaTile";
import { PostModal, type ModalItem, type WorkLite } from "./PostModal";

type Tab = "postlar" | "videolar" | "ishlar";
type Page = { items: PostView[]; nextCursor: number | null };
type ApiResp<T> = { ok: boolean; data?: T; error?: string };

const TABS: Tab[] = ["postlar", "videolar", "ishlar"];
const T = {
  uz: { feed: "Lenta", posts: "Postlar", videos: "Videolar", works: "Ishlar", newPost: "Post joylash", close: "Yopish", more: "Yana yuklash", loading: "Yuklanmoqda…", emptyPostsOwn: "Birinchi postingizni joylang — ish jarayoni, natija yoki fikr. Obunachilaringizga xabar boradi.", emptyPosts: "Hali postlar yo'q.", emptyVideos: "Hali videolar yo'q.", emptyWorks: "Hali ishlar qo'shilmagan.", placeholder: "Nima yangilik? Ish jarayoni, natija, fikr…" },
  ru: { feed: "Лента", posts: "Посты", videos: "Видео", works: "Работы", newPost: "Опубликовать", close: "Закрыть", more: "Показать ещё", loading: "Загрузка…", emptyPostsOwn: "Опубликуйте первый пост — процесс, результат или мысль. Подписчики получат уведомление.", emptyPosts: "Постов пока нет.", emptyVideos: "Видео пока нет.", emptyWorks: "Работы пока не добавлены.", placeholder: "Что нового? Процесс, результат, мысль…" },
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
    views: p.viewsCount,
    comments: p.commentsCount,
    pinned: p.isPinned,
  };
}
function workTile(w: WorkLite): MediaTileData {
  return { thumbUrl: w.type === "image" ? w.url : w.thumbnailUrl, videoUrl: w.type === "video" ? w.url : null, isVideo: w.type === "video", textOnly: false, count: 1, caption: w.title };
}
const hasVideo = (p: PostView) => p.media.some((m) => isVideoAttachment(m));
/** Qadalgan post birinchi, qolganlari sana bo'yicha (yangisi yuqorida) */
const orderPosts = (list: PostView[]) => [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt - a.createdAt);

/**
 * Profil lentasi (Instagram uslubi): Postlar / Videolar / Ishlar bo'limlari, kvadrat plitkalar, post oynasi.
 * URL bilan sinxron: ?tab=postlar|videolar|ishlar, ?post=<id>, ?ish=<id> (ulashish havolalari). Egasi shu yerdan post joylaydi/qadaydi.
 * Tablar — WAI-ARIA (tab/tabpanel, ←/→/Home/End), faol tab ostida siljuvchi chiziq.
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
  openWork = null,
  missingPost = false,
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
  /** ?ish=<id> — ochiladigan portfolio ishi */
  openWork?: WorkLite | null;
  /** ?post= berilgan, lekin post topilmadi — bildirishnoma */
  missingPost?: boolean;
  initialTab: Tab;
  works: WorkLite[];
}) {
  const t = T[til];
  const [tab, setTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState(() => orderPosts(initialPosts.items));
  const [cursor, setCursor] = useState(initialPosts.nextCursor);
  const [videoPosts, setVideoPosts] = useState<PostView[] | null>(null);
  const [videosLoading, setVideosLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [composer, setComposer] = useState(false);
  const [n, setN] = useState(counts);
  const [missing, setMissing] = useState(missingPost);
  const [openItem, setOpenItem] = useState<ModalItem | null>(openPost ? { kind: "post", post: openPost } : openWork ? { kind: "work", work: openWork } : null);
  const base = `/api/profil/postlar?user=${encodeURIComponent(userId)}`;
  const shareBase = `/mutaxassislar/${slug}`;
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ postlar: null, videolar: null, ishlar: null });
  const [ink, setInk] = useState<{ left: number; width: number } | null>(null);

  const syncUrl = useCallback((patch: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Topilmagan ?post= — URL'dan olib tashlanadi (yangilansa yana chiqmasin)
  useEffect(() => {
    if (missingPost) syncUrl({ post: null });
  }, [missingPost, syncUrl]);

  // Siljuvchi chiziq: faol tab o'lchamini o'lchaydi (resize'da ham)
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[tab];
      if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tab]);

  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const res = await fetch(`${base}&filter=video&limit=48`, { cache: "no-store" });
      const j = (await res.json()) as ApiResp<Page>;
      if (j.ok && j.data) setVideoPosts(j.data.items);
    } finally {
      setVideosLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (tab === "videolar" && videoPosts === null) void loadVideos();
  }, [tab, videoPosts, loadVideos]);

  function selectTab(next: Tab) {
    setTab(next);
    syncUrl({ tab: next });
  }
  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.indexOf(tab);
    let next: Tab | null = null;
    if (e.key === "ArrowRight") next = TABS[(i + 1) % TABS.length];
    else if (e.key === "ArrowLeft") next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === "Home") next = TABS[0];
    else if (e.key === "End") next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    selectTab(next);
    tabRefs.current[next]?.focus();
  }
  function open(item: ModalItem) {
    setOpenItem(item);
    if (item.kind === "post") syncUrl({ post: item.post.id, ish: null });
    else syncUrl({ ish: item.work.id, post: null });
  }
  const close = useCallback(() => {
    setOpenItem(null);
    syncUrl({ post: null, ish: null });
  }, [syncUrl]);

  const reload = useCallback(async (): Promise<PostView[]> => {
    const res = await fetch(`${base}&limit=18`, { cache: "no-store" });
    const j = (await res.json()) as ApiResp<Page>;
    if (j.ok && j.data) {
      setItems(orderPosts(j.data.items));
      setCursor(j.data.nextCursor);
      setVideoPosts(null);
      return j.data.items;
    }
    return [];
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
    const before = new Set(items.map((p) => p.id));
    const fresh = await reload();
    // Yangi post video bo'lsa — "Videolar" soni ham oshadi
    const added = fresh.filter((p) => !before.has(p.id));
    setN((c) => ({ ...c, posts: c.posts + Math.max(1, added.length), videos: c.videos + added.filter(hasVideo).length }));
    selectTab("postlar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, items]);

  function onDeleted(id: string) {
    const gone = items.find((p) => p.id === id) ?? videoPosts?.find((p) => p.id === id);
    setItems((prev) => prev.filter((p) => p.id !== id));
    setVideoPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    setN((c) => ({ ...c, posts: Math.max(0, c.posts - 1), videos: gone && hasVideo(gone) ? Math.max(0, c.videos - 1) : c.videos }));
  }
  function onLiked(id: string, st: ReactionState) {
    const upd = (p: PostView) => (p.id === id ? { ...p, likedByMe: st.liked, likesCount: st.likesCount, myReaction: st.myReaction, reactions: st.reactions } : p);
    setItems((prev) => prev.map(upd));
    setVideoPosts((prev) => (prev ? prev.map(upd) : prev));
  }
  function onPinned(id: string, pinned: boolean) {
    const upd = (p: PostView) => ({ ...p, isPinned: p.id === id ? pinned : pinned ? false : p.isPinned });
    setItems((prev) => orderPosts(prev.map(upd)));
    setVideoPosts((prev) => (prev ? prev.map(upd) : prev));
  }

  const videoWorks = useMemo(() => works.filter((w) => w.type === "video"), [works]);
  const videoList = videoPosts ?? items.filter(hasVideo);
  const totalVideos = n.videos + videoWorks.length;
  const videosSkeleton = tab === "videolar" && videosLoading && videoList.length === 0 && videoWorks.length === 0;

  const tabs: Array<{ key: Tab; label: string; icon: typeof Grid3x3; count: number }> = [
    { key: "postlar", label: t.posts, icon: Grid3x3, count: n.posts },
    { key: "videolar", label: t.videos, icon: Play, count: totalVideos },
    { key: "ishlar", label: t.works, icon: Images, count: n.works },
  ];
  const tileBtn = "press block w-full rounded-[var(--r-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:rounded-[var(--r-md)]";

  return (
    <div className="card overflow-hidden">
      {isOwner && (
        <div className="flex items-center justify-end px-4 pt-4 sm:px-6 sm:pt-5">
          <Button type="button" variant={composer ? "outline" : "accent"} size="md" onClick={() => setComposer((v) => !v)} className="icon-spin-hover">
            {composer ? <X size={15} /> : <PenSquare size={15} />} {composer ? t.close : t.newPost}
          </Button>
        </div>
      )}
      {isOwner && composer && (
        <div className="expand-in px-4 pt-4 sm:px-6">
          <Composer base="/api/profil/postlar" onPosted={onPosted} kind="channel" placeholder={t.placeholder} />
        </div>
      )}

      {/* Bo'limlar — Instagram uslubida ustki chiziq; faol chiziq siljiydi */}
      <div role="tablist" aria-label={t.feed} className={cn("relative flex border-t border-line", isOwner && "mt-4")}>
        <span
          aria-hidden
          className="pointer-events-none absolute -top-px h-0.5 bg-fg transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
          style={ink ? { width: ink.width, transform: `translateX(${ink.left}px)` } : undefined}
        />
        {tabs.map((x) => {
          const active = tab === x.key;
          const Icon = x.icon;
          return (
            <button
              key={x.key}
              id={`tab-${x.key}`}
              ref={(el) => {
                tabRefs.current[x.key] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${x.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(x.key)}
              onKeyDown={onTabKey}
              className={cn(
                "press relative flex h-12 flex-1 items-center justify-center gap-1.5 text-[13px] font-semibold transition sm:flex-none sm:px-6",
                active ? "text-fg" : "text-fg-3 hover:text-fg",
                // Chiziq hali o'lchanmagan bo'lsa (SSR) faol tab o'z chizig'ini ko'rsatadi
                !ink && active && "shadow-[inset_0_2px_0_0_var(--fg)]",
              )}
            >
              <Icon size={15} aria-hidden /> {x.label} <span className={cn("tabular-nums", active ? "text-fg-2" : "text-fg-4")}>{x.count}</span>
            </button>
          );
        })}
      </div>

      {missing && (
        <div role="status" className="expand-in mx-3 mt-3 flex items-start gap-3 rounded-[var(--r-sm)] border border-line px-3.5 py-3 sm:mx-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-fg">{tr(til, POST_OYNA.notFoundTitle)}</p>
            <p className="mt-0.5 text-[12.5px] text-fg-3">{tr(til, POST_OYNA.notFoundDesc)}</p>
          </div>
          <button type="button" onClick={() => setMissing(false)} aria-label={tr(til, POST_OYNA.dismiss)} className="press -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="p-1.5 sm:p-3">
        {tab === "postlar" && (
          <div key="postlar" id="panel-postlar" role="tabpanel" aria-labelledby="tab-postlar" className="animate-fade-in">
            {items.length === 0 ? (
              <EmptyState icon={Grid3x3} title={isOwner ? t.emptyPostsOwn : t.emptyPosts} />
            ) : (
              <ul className="stagger grid grid-cols-3 gap-1 sm:gap-2" aria-label={t.posts}>
                {items.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => open({ kind: "post", post: p })} className={tileBtn} aria-label={p.body.slice(0, 80) || tr(til, POST_OYNA.post)}>
                      <MediaTile d={tileOf(p)} til={til} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {cursor && (
              <div className="flex justify-center py-4">
                <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading} className="press">
                  {loading ? t.loading : t.more}
                </Button>
              </div>
            )}
          </div>
        )}
        {tab === "videolar" && (
          <div key="videolar" id="panel-videolar" role="tabpanel" aria-labelledby="tab-videolar" className="animate-fade-in">
            {videosSkeleton ? (
              <ul className="grid grid-cols-3 gap-1 sm:gap-2" aria-busy="true" aria-label={tr(til, POST_OYNA.loadingVideos)}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="skeleton aspect-square !rounded-[var(--r-sm)] sm:!rounded-[var(--r-md)]" />
                ))}
              </ul>
            ) : videoList.length === 0 && videoWorks.length === 0 ? (
              <EmptyState icon={Play} title={t.emptyVideos} />
            ) : (
              <ul className="stagger grid grid-cols-3 gap-1 sm:gap-2" aria-label={t.videos}>
                {videoList.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => open({ kind: "post", post: p })} className={tileBtn} aria-label={p.body.slice(0, 80) || "Video"}>
                      <MediaTile d={tileOf(p)} til={til} />
                    </button>
                  </li>
                ))}
                {videoWorks.map((w) => (
                  <li key={w.id}>
                    <button type="button" onClick={() => open({ kind: "work", work: w })} className={tileBtn} aria-label={w.title}>
                      <MediaTile d={workTile(w)} til={til} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === "ishlar" && (
          <div key="ishlar" id="panel-ishlar" role="tabpanel" aria-labelledby="tab-ishlar" className="animate-fade-in p-1.5 sm:p-2">
            {works.length === 0 ? <EmptyState icon={Images} title={t.emptyWorks} /> : <PortfolioGallery items={works} />}
          </div>
        )}
      </div>

      <PostModal item={openItem} author={{ name, avatarUrl, slug }} loggedIn={loggedIn} viewerId={viewerId} isAdmin={isAdmin} shareBase={shareBase} canPin={isOwner} onClose={close} onDeleted={onDeleted} onLiked={onLiked} onPinned={onPinned} />
    </div>
  );
}
