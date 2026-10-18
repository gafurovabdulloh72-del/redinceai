import Link from "next/link";
import { RadioTower } from "lucide-react";
import { Avatar } from "@/components/ui";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { StoryAuthor } from "@/lib/feed";
import { cn } from "@/lib/utils";

/**
 * "Hikoyalar" qatori (Instagram uslubi): so'nggi 7 kunda post joylagan ijodkorlar — gradient halqali avatarlar,
 * birinchi element — yaqin efir (bo'lsa). Gorizontal aylanadi, skrollbarsiz.
 */
export function Stories({ items, live, til }: { items: StoryAuthor[]; live: { href: string; label: string; isLive: boolean } | null; til: Locale }) {
  if (items.length === 0 && !live) return null;
  return (
    <section aria-label={tr(til, FEED.stories)} className="card overflow-hidden">
      <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 py-3.5">
        {live && (
          <li className="shrink-0">
            <Link href={live.href} className="press flex w-[68px] flex-col items-center gap-1.5 text-center">
              <span className={cn("relative flex h-[62px] w-[62px] items-center justify-center rounded-full p-[3px]", live.isLive ? "bg-accent" : "bg-[conic-gradient(from_180deg,var(--accent),#ff8a6a,var(--accent))]")}>
                <span className="flex h-full w-full items-center justify-center rounded-full bg-surface text-accent">
                  <RadioTower size={22} />
                </span>
                {live.isLive && <span className="live-dot absolute -bottom-0.5 right-0 h-3 w-3 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
              </span>
              <span className="w-full truncate text-[11.5px] font-semibold text-fg">{live.isLive ? tr(til, FEED.liveNow) : tr(til, FEED.live)}</span>
            </Link>
          </li>
        )}
        {items.map((a) => (
          <li key={a.id} className="shrink-0">
            <Link href={`/mutaxassislar/${a.slug}?tab=postlar`} className="press flex w-[68px] flex-col items-center gap-1.5 text-center" title={a.name}>
              <span className="rounded-full bg-[conic-gradient(from_180deg,var(--accent),#ff8a6a,#ffb199,var(--accent))] p-[3px]">
                <span className="flex rounded-full bg-surface p-[2px]">
                  <Avatar name={a.name} src={a.avatarUrl} size={52} decorative />
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
