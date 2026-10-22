"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FEED_SCOPE_COOKIE } from "@/lib/groups/limits";
import type { FeedItem, FeedPage, FeedScope, SuggestedCreator } from "@/lib/feed";
import { HomeFeed } from "./HomeFeed";
import { ScopeTabs } from "./ScopeTabs";
import { PostSkeleton, withQuery } from "./shared";

const FRESH_MS = 60_000;

/**
 * «Hammasi / Obunalarim» almashtirgich: tab bosilganda sahifa qayta yuklanmaydi (server butun bosh sahifani qayta chizmaydi) —
 * lenta /api/feed dan olinadi, har bir bo'lim 60 soniya keshlanadi, ikkinchisi fonda oldindan yuklanadi.
 */
export function HomeFeedSwitcher({
  initialScope,
  initialFeed,
  tag,
  loggedIn,
  suggestions,
  pinned,
}: {
  initialScope: FeedScope;
  initialFeed: FeedPage;
  tag: string | null;
  loggedIn: boolean;
  suggestions: SuggestedCreator[];
  pinned: FeedItem | null;
}) {
  const [scope, setScope] = useState<FeedScope>(initialScope);
  const cache = useRef(new Map<FeedScope, { page: FeedPage; at: number }>([[initialScope, { page: initialFeed, at: Date.now() }]]));
  const [, bump] = useState(0);
  const wanted = useRef<FeedScope>(initialScope);

  const fetchScope = useCallback(
    async (s: FeedScope) => {
      try {
        const res = await fetch(withQuery("/api/feed", { scope: s, tag, limit: 10 }), { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; data?: FeedPage };
        if (j.ok && j.data) {
          cache.current.set(s, { page: j.data, at: Date.now() });
          bump((n) => n + 1);
        }
      } catch {
        /* tarmoq xatosi — skeleton qoladi, qayta bosilsa urinadi */
      }
    },
    [tag],
  );

  // Ikkinchi bo'limni bo'sh vaqtda oldindan yuklaymiz
  useEffect(() => {
    const other: FeedScope = initialScope === "all" ? "following" : "all";
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const run = () => {
      if (!cache.current.has(other)) void fetchScope(other);
    };
    if (w.requestIdleCallback) w.requestIdleCallback(run);
    else window.setTimeout(run, 800);
  }, [initialScope, fetchScope]);

  const select = (s: FeedScope) => {
    if (s === scope) return;
    wanted.current = s;
    setScope(s);
    try {
      document.cookie = `${FEED_SCOPE_COOKIE}=${s}; path=/; max-age=31536000; SameSite=Lax`;
      const url = new URL(window.location.href);
      if (s === "following") url.searchParams.set("scope", "following");
      else url.searchParams.delete("scope");
      url.searchParams.delete("post");
      window.history.replaceState(null, "", url.toString());
    } catch {}
    const hit = cache.current.get(s);
    if (!hit || Date.now() - hit.at > FRESH_MS) void fetchScope(s);
  };

  const hit = cache.current.get(scope);
  return (
    <>
      <ScopeTabs scope={scope} tag={tag} onSelect={select} />
      {hit ? (
        <HomeFeed key={`${scope}:${tag ?? ""}:${hit.at}`} initial={hit.page} scope={scope} loggedIn={loggedIn} tag={tag} suggestions={suggestions} pinned={scope === initialScope ? pinned : null} />
      ) : (
        <div aria-busy="true">
          <PostSkeleton />
        </div>
      )}
    </>
  );
}
