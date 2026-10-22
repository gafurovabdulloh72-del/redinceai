"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { FEED_SCOPE_COOKIE as SCOPE_COOKIE } from "@/lib/groups/limits";
import type { FeedScope } from "@/lib/feed";

/**
 * «Hammasi / Obunalarim» tablari (v5: chiziqli tab, faol ostida coral chiziq) — yopishqoq shisha panel, bosilganda tanlov cookie'ga yoziladi.
 * Teg filtri bo'lsa havolalarda saqlanadi.
 */
export function ScopeTabs({ scope, tag, onSelect }: { scope: FeedScope; tag: string | null; onSelect?: (s: FeedScope) => void }) {
  const til = useLocale();
  const remember = (s: FeedScope) => {
    try {
      document.cookie = `${SCOPE_COOKIE}=${s}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  };
  const q = tag ? `tag=${encodeURIComponent(tag)}` : "";
  const tabs: Array<[FeedScope, string, string]> = [
    ["all", tr(til, FEED.all), q ? `/?${q}` : "/"],
    ["following", tr(til, FEED.following), `/?scope=following${q ? `&${q}` : ""}`],
  ];
  return (
    <div className="glass sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 px-4 sm:mx-0 sm:rounded-t-[var(--r-md)] sm:px-0 md:top-0">
      <div className="tabs" role="tablist" aria-label="Lenta">
        {tabs.map(([k, label, href]) => (
          <Link
            key={k}
            href={href}
            role="tab"
            aria-selected={scope === k}
            onClick={(e) => {
              if (onSelect && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
                // Sahifa qayta yuklanmasdan almashadi (HomeFeedSwitcher)
                e.preventDefault();
                onSelect(k);
              } else remember(k);
            }}
            className="tab focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
