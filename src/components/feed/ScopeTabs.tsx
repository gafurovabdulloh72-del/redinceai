"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { FEED_SCOPE_COOKIE as SCOPE_COOKIE } from "@/lib/groups/limits";
import type { FeedScope } from "@/lib/feed";

/**
 * «Hammasi / Obunalarim» almashtirgichi — yopishqoq (telefonda yuqori panel ostida), bosilganda tanlov cookie'ga yoziladi.
 * Teg filtri bo'lsa havolalarda saqlanadi.
 */
export function ScopeTabs({ scope, tag }: { scope: FeedScope; tag: string | null }) {
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
    <div className="sticky top-[4.5rem] z-20 -mx-1 bg-bg px-1 py-1 md:top-0 md:py-1.5">
      <div className="segment w-full" role="tablist" aria-label="Lenta">
        {tabs.map(([k, label, href]) => (
          <Link key={k} href={href} role="tab" aria-selected={scope === k} aria-current={scope === k ? "page" : undefined} data-active={scope === k} onClick={() => remember(k)} className="segment-item min-h-10 flex-1 justify-center text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
