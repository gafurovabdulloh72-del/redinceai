import Link from "next/link";
import { Bookmark, RadioTower } from "lucide-react";
import { Avatar } from "@/components/ui";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { StoryAuthor } from "@/lib/feed";
import { cn } from "@/lib/utils";

/**
 * "Hikoyalar" qatori (Instagram uslubi): so'nggi 7 kunda post joylagan ijodkorlar — yassi tasma (kartasiz).
 * Halqa: so'nggi 24 soatda post qo'ygan — aksent, eskiroq — hairline. Birinchi element — yaqin efir (bo'lsa),
 * kirganlar uchun — «Saqlangan» (soni bilan). Gorizontal aylanadi, skrollbarsiz.
 */
export function Stories({ items, live, til, saved = null }: { items: StoryAuthor[]; live: { href: string; label: string; isLive: boolean } | null; til: Locale; saved?: { count: number } | null }) {
  if (items.length === 0 && !live && !saved) return null;
  const fresh = Date.now() - 24 * 60 * 60 * 1000;
  const item = "press flex w-[64px] flex-col items-center gap-1.5 text-center";
  return (
    <section aria-label={tr(til, FEED.stories)}>
      <ul className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 py-1">
        {live && (
          <li className="shrink-0">
            <Link href={live.href} className={item} aria-label={live.isLive ? tr(til, FEED.liveNow) : `${tr(til, FEED.live)} — ${live.label}`}>
              <span className={cn("relative flex h-[58px] w-[58px] items-center justify-center rounded-full p-[2px]", live.isLive ? "bg-accent" : "bg-line-2")}>
                <span className="flex h-full w-full items-center justify-center rounded-full bg-surface text-fg-2">
                  <RadioTower size={20} />
                </span>
                {live.isLive && <span className="live-dot absolute -bottom-0.5 right-0 h-3 w-3 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
              </span>
              <span className="w-full truncate text-[11.5px] font-semibold text-fg">{live.isLive ? tr(til, FEED.liveNow) : tr(til, FEED.live)}</span>
            </Link>
          </li>
        )}
        {saved && (
          <li className="shrink-0">
            <Link href="/kabinet/saqlanganlar" className={item} aria-label={`${tr(til, FEED.saved)} (${saved.count})`}>
              <span className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-line-2 p-[2px]">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-surface text-fg-2">
                  <Bookmark size={20} />
                </span>
                {saved.count > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-fg px-1 text-[10.5px] font-bold tabular-nums text-surface ring-2 ring-bg" aria-hidden>
                    {saved.count > 99 ? "99+" : saved.count}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-[11.5px] font-medium text-fg-2">{tr(til, FEED.saved)}</span>
            </Link>
          </li>
        )}
        {items.map((a) => (
          <li key={a.id} className="shrink-0">
            <Link href={`/mutaxassislar/${a.slug}?tab=postlar`} className={item} aria-label={FEED.storyLabel[til](a.name)}>
              <span className={cn("rounded-full p-[2px]", a.latestAt >= fresh ? "bg-accent" : "bg-line-2")}>
                <span className="flex rounded-full bg-surface p-[2px]">
                  <Avatar name={a.name} src={a.avatarUrl} size={50} decorative className="!ring-0 !shadow-none" />
                </span>
              </span>
              <span className="w-full truncate text-[11.5px] font-medium text-fg-2">{a.name.split(" ")[0]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
