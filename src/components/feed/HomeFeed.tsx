"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Hash, MessageCircle, UsersRound, X } from "lucide-react";
import { ButtonLink, Avatar } from "@/components/ui";
import { PostCard } from "@/components/groups/GroupFeed";
import { FollowButton } from "@/components/groups/FollowButton";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { FEED_POSTED_EVENT } from "./HomeComposer";
import { FeedEmpty, LoadMore, PostSkeleton, useInfiniteSentinel, useRequireLogin, useVisibleInterval, withQuery } from "./shared";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { FeedItem, FeedPage, FeedScope, SuggestedCreator } from "@/lib/feed";
import { cn } from "@/lib/utils";

type ApiResp<T> = { ok: boolean; data?: T; error?: string };
const RESTORE_TTL = 10 * 60 * 1000;
interface Snapshot {
  items: FeedItem[];
  cursor: number | null;
  y: number;
  at: number;
}

/**
 * Lenta: profil va jamoa postlari aralash; cheksiz aylantirish (sentinel) + «Yana» zaxira; «N ta yangi post» pilyulasi
 * (45 s, faqat ko'rinadigan tabda); yangi post joylanganda tepaga qo'shiladi; J/K/L/C/S klaviatura; orqaga qaytganda
 * yuklangan sahifalar va aylantirish joyi tiklanadi (sessionStorage, 10 daqiqa). `source` — boshqa manba (/api/posts/saved).
 */
export function HomeFeed({
  initial,
  scope = "all",
  loggedIn,
  source,
  emptyTitle,
  tag = null,
  suggestions = [],
  pinned = null,
}: {
  initial: FeedPage;
  scope?: FeedScope;
  loggedIn: boolean;
  source?: string;
  emptyTitle?: string;
  /** #teg filtri (normallashtirilgan) */
  tag?: string | null;
  /** «Obunalarim» bo'sh bo'lganda tavsiya ijodkorlar */
  suggestions?: SuggestedCreator[];
  /** `/?post=<id>` — tepada belgilangan post */
  pinned?: FeedItem | null;
}) {
  const til = useLocale();
  const requireLogin = useRequireLogin(loggedIn);
  const base = source ?? withQuery("/api/feed", { scope, tag });
  const storeKey = `kv-feed:${base}`;
  const [items, setItems] = useState<FeedItem[]>(() => (pinned ? [pinned, ...initial.items.filter((p) => p.id !== pinned.id)] : initial.items));
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const pill = usePresence(newCount > 0, 160);
  const topBtn = usePresence(showTop, 160);
  const loadingRef = useRef(false);
  const sinceRef = useRef<number>(Math.max(Date.now(), ...initial.items.map((p) => p.createdAt)));
  const restoredRef = useRef(false);

  /* Orqaga qaytganda: saqlangan sahifalar + aylantirish joyi (faqat klientda, hydration'dan keyin) */
  useEffect(() => {
    if (restoredRef.current || pinned) return;
    restoredRef.current = true;
    try {
      const raw = sessionStorage.getItem(storeKey);
      if (!raw) return;
      const s = JSON.parse(raw) as Snapshot;
      if (Date.now() - s.at > RESTORE_TTL || !Array.isArray(s.items) || s.items.length <= initial.items.length) return;
      setItems(s.items);
      setCursor(s.cursor);
      requestAnimationFrame(() => window.scrollTo({ top: s.y, behavior: "instant" as ScrollBehavior }));
    } catch {}
  }, [storeKey, initial.items.length, pinned]);
  useEffect(() => {
    let t: number | null = null;
    const save = () => {
      t = null;
      setShowTop(window.scrollY > window.innerHeight * 2);
      if (items.length <= initial.items.length && window.scrollY < 300) return;
      try {
        sessionStorage.setItem(storeKey, JSON.stringify({ items, cursor, y: window.scrollY, at: Date.now() } satisfies Snapshot));
      } catch {}
    };
    const onScroll = () => {
      if (t === null) t = window.setTimeout(save, 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (t !== null) window.clearTimeout(t);
    };
  }, [items, cursor, storeKey, initial.items.length]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store" });
      const j = (await res.json()) as ApiResp<FeedPage>;
      if (!j.ok || !j.data) throw new Error(j.error);
      setItems(j.data.items);
      setCursor(j.data.nextCursor);
      sinceRef.current = Math.max(Date.now(), ...j.data.items.map((p) => p.createdAt));
      setNewCount(0);
      try {
        sessionStorage.removeItem(storeKey);
      } catch {}
    } catch {
      setLoadError(tr(til, FEED.loadFailed));
    }
  }, [base, storeKey, til]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(withQuery(base, { cursor }), { cache: "no-store" });
      const j = (await res.json()) as ApiResp<FeedPage>;
      if (!j.ok || !j.data) throw new Error(j.error);
      const more = j.data.items;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setCursor(j.data.nextCursor);
    } catch {
      setLoadError(tr(til, FEED.loadFailed));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [base, cursor, til]);
  const sentinel = useInfiniteSentinel(() => void loadMore(), Boolean(cursor) && !loadError);

  /* «N ta yangi post» — 45 soniyada bir, faqat ko'rinadigan tabda (saqlanganlar manbasida emas) */
  useVisibleInterval(
    () => {
      fetch(withQuery("/api/feed/new", { since: sinceRef.current, scope, tag }), { cache: "no-store" })
        .then((r) => r.json() as Promise<ApiResp<{ count: number }>>)
        .then((j) => j.ok && j.data && setNewCount(j.data.count))
        .catch(() => undefined);
    },
    45_000,
    !source,
  );

  /* Kompozitordan yangi post — faqat shu post tepaga qo'shiladi */
  useEffect(() => {
    const onPosted = async (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return void reload();
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { cache: "no-store" });
        const j = (await res.json()) as ApiResp<FeedItem>;
        if (!j.ok || !j.data) throw new Error();
        const item = j.data;
        setItems((prev) => [item, ...prev.filter((p) => p.id !== id)]);
        sinceRef.current = Math.max(sinceRef.current, item.createdAt);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        await reload();
      }
    };
    window.addEventListener(FEED_POSTED_EVENT, onPosted);
    return () => window.removeEventListener(FEED_POSTED_EVENT, onPosted);
  }, [reload]);

  /* Klaviatura: J/K — postlar bo'ylab, L — yoqtirish, C — izohlar, S — saqlash (maydon ichida emas) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (!["j", "k", "l", "c", "s"].includes(key)) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>("article[data-post-id]"));
      if (!cards.length) return;
      const active = document.activeElement as HTMLElement | null;
      let i = cards.findIndex((c) => c.contains(active));
      if (i < 0) {
        const mid = window.innerHeight / 2;
        i = cards.findIndex((c) => c.getBoundingClientRect().bottom > mid);
        if (i < 0) i = 0;
        if (key === "k") i = Math.min(i, cards.length - 1);
      } else if (key === "j") i = Math.min(i + 1, cards.length - 1);
      else if (key === "k") i = Math.max(i - 1, 0);
      const card = cards[i];
      if (key === "j" || key === "k") {
        e.preventDefault();
        card.focus({ preventScroll: true });
        card.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      const action = key === "l" ? "like" : key === "c" ? "comments" : "save";
      card.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tagChip = tag && (
    <div className="expand-in flex items-center gap-2 px-1 text-[13px] text-fg-2">
      <Hash size={14} className="text-fg-4" />
      <span className="min-w-0 flex-1 truncate font-semibold text-fg">{FEED.tagFeed[til](tag)}</span>
      <Link href="/" className="press inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-fg-3 transition hover:bg-fg/6 hover:text-fg" aria-label={tr(til, FEED.clearTag)}>
        <X size={13} /> {tr(til, FEED.clearTag)}
      </Link>
    </div>
  );

  if (items.length === 0) {
    const followingEmpty = scope === "following" && !source && !tag;
    return (
      <div className="grid gap-3">
        {tagChip}
        <FeedEmpty
          icon={followingEmpty ? <UsersRound size={20} /> : <MessageCircle size={20} />}
          title={emptyTitle ?? (tag ? FEED.emptyTag[til](tag) : tr(til, followingEmpty ? FEED.emptyFollowing : FEED.emptyAll))}
          text={emptyTitle || tag ? undefined : tr(til, followingEmpty ? FEED.emptyFollowingText : FEED.emptyAllText)}
          action={
            followingEmpty && suggestions.length > 0 ? (
              <ul className="grid w-full gap-2.5 text-left sm:min-w-[320px]">
                {suggestions.map((c) => (
                  <li key={c.userId} className="flex items-center gap-3">
                    <Link href={`/mutaxassislar/${c.slug}`} className="shrink-0">
                      <Avatar name={c.name} src={c.avatarUrl} size={36} decorative />
                    </Link>
                    <span className="min-w-0 flex-1">
                      <Link href={`/mutaxassislar/${c.slug}`} className="block truncate text-[13.5px] font-semibold text-fg hover:underline">
                        {c.name}
                      </Link>
                      <span className="block truncate text-[12px] text-fg-3">{c.title}</span>
                    </span>
                    <FollowButton userId={c.userId} initialFollowing={c.following} initialCount={c.followers} loggedIn={loggedIn} size="sm" compact showCount={false} variant="outline" />
                  </li>
                ))}
              </ul>
            ) : (
              <ButtonLink href={source || tag ? "/" : "/mutaxassislar"} variant="outline" size="md">
                {tr(til, source || tag ? FEED.all : FEED.findCreators)}
              </ButtonLink>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="relative grid gap-4">
      {tagChip}
      {pill.mounted && (
        <div className="pointer-events-none sticky top-[4.75rem] z-20 flex justify-center md:top-3">
          <button
            type="button"
            onClick={() => {
              void reload();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className={cn("btn-ink pointer-events-auto press inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-[var(--shadow-2)]", pill.closing ? "pop-out" : "pop-in")}
            aria-live="polite"
          >
            <ArrowUp size={14} /> {FEED.newPosts[til](newCount)}
          </button>
        </div>
      )}
      <div className="stagger grid gap-4">
        {items.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            canInteract={p.canInteract}
            canPin={false}
            loggedIn={loggedIn}
            requireLogin={requireLogin}
            highlighted={pinned?.id === p.id}
            groupSlug={p.group?.slug ?? null}
            onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== p.id))}
            onChanged={reload}
            onMuted={(authorId) => setItems((prev) => prev.filter((x) => x.id === p.id || x.author.id !== authorId))}
          />
        ))}
      </div>
      {loading && (
        <>
          <PostSkeleton />
          <PostSkeleton className="hidden sm:block" />
        </>
      )}
      <div ref={sentinel} aria-hidden className="h-px" />
      {cursor && !loading && <LoadMore onLoad={() => void loadMore()} loading={loading} error={loadError} />}
      {topBtn.mounted && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={tr(til, FEED.toTop)}
          title={tr(til, FEED.toTop)}
          className={cn("card-floating press fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center !rounded-full text-fg-2 transition hover:text-fg md:bottom-6 md:right-6", topBtn.closing ? "pop-out" : "pop-in")}
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}
