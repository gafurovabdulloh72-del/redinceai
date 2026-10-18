"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Radio, UsersRound } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { PostCard } from "@/components/groups/GroupFeed";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { FeedItem, FeedPage, FeedScope } from "@/lib/feed";

type ApiResp<T> = { ok: boolean; data?: T; error?: string };

/**
 * Lenta: profil va jamoa postlari aralash; jamoa posti ustida manba chipi; "Yana yuklash".
 * `source` — boshqa manba (masalan, /api/posts/saved); bo'lmasa /api/feed?scope=.
 */
export function HomeFeed({ initial, scope = "all", loggedIn, source, emptyTitle }: { initial: FeedPage; scope?: FeedScope; loggedIn: boolean; source?: string; emptyTitle?: string }) {
  const til = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const base = source ?? `/api/feed?scope=${scope}`;
  const join = base.includes("?") ? "&" : "?";

  const reload = useCallback(async () => {
    const res = await fetch(base, { cache: "no-store" });
    const j = (await res.json()) as ApiResp<FeedPage>;
    if (j.ok && j.data) {
      setItems(j.data.items);
      setCursor(j.data.nextCursor);
    }
  }, [base]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}${join}cursor=${cursor}`, { cache: "no-store" });
      const j = (await res.json()) as ApiResp<FeedPage>;
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

  function requireLogin(): boolean {
    if (loggedIn) return true;
    router.push(`/auth/kirish?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    return false;
  }

  if (items.length === 0) {
    return (
      <div className="card px-5 py-10 text-center">
        <p className="text-[15px] font-semibold text-fg">{emptyTitle ?? tr(til, scope === "following" ? FEED.emptyFollowing : FEED.emptyAll)}</p>
        <div className="mt-4 flex justify-center">
          <ButtonLink href={source ? "/" : "/mutaxassislar"} variant="accent" size="md">
            {tr(til, source ? FEED.all : FEED.findCreators)}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger grid gap-4">
      {items.map((p) => (
        <FeedPost key={p.id} item={p} loggedIn={loggedIn} requireLogin={requireLogin} onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== p.id))} onChanged={reload} />
      ))}
      {cursor && (
        <div className="flex justify-center py-2">
          <Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? tr(til, FEED.loading) : tr(til, FEED.more)}
          </Button>
        </div>
      )}
    </div>
  );
}

function FeedPost({ item, loggedIn, requireLogin, onDeleted, onChanged }: { item: FeedItem; loggedIn: boolean; requireLogin: () => boolean; onDeleted: () => void; onChanged: () => Promise<void> }) {
  const til = useLocale();
  return (
    <div className="min-w-0">
      {item.group && (
        <Link href={`/jamoalar/${item.group.slug}`} className="mb-1.5 inline-flex max-w-full items-center gap-1.5 px-1 text-[12.5px] font-semibold text-fg-3 transition hover:text-fg">
          {item.group.isOfficial ? <BadgeCheck size={13} className="text-accent" /> : item.group.kind === "channel" ? <Radio size={13} /> : <UsersRound size={13} />}
          <span className="truncate">{item.group.name}</span>
          <span className="shrink-0 font-medium text-fg-4">{tr(til, item.group.kind === "channel" ? FEED.inChannel : FEED.inGroup)}</span>
        </Link>
      )}
      <PostCard post={item} canInteract={item.canInteract} canPin={false} loggedIn={loggedIn} requireLogin={requireLogin} highlighted={false} groupSlug={item.group?.slug ?? null} onDeleted={onDeleted} onChanged={onChanged} />
    </div>
  );
}
