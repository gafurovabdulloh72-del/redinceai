import Link from "next/link";
import { ArrowUpRight, BadgeCheck, RadioTower } from "lucide-react";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { FollowButton } from "@/components/groups/FollowButton";
import { ProfileMeter } from "./ProfileMeter";
import { RailSearch } from "./RailSearch";
import type { Completeness } from "@/lib/profile/completeness";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { RailData } from "@/lib/feed";
import { formatDateTime } from "@/lib/utils";

export interface RailUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  specialistSlug: string | null;
}

/** Bo'lim sarlavhasi — hamma kartada bir xil (13px, fg-2) va bitta «Barchasi» havolasi */
function RailHead({ id, title, href, til }: { id: string; title: string; href?: string; til: Locale }) {
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="text-[13px] font-semibold text-fg-2">
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-[12px] font-semibold text-fg-3 transition hover:text-fg">
          {tr(til, FEED.seeAll)}
        </Link>
      )}
    </div>
  );
}

/** O'ng panel (desktop, v6 «Sokin»): qidiruv, (profil to'ldirilganligi), rasmiy kanal va tavsiya ijodkorlar — boshqa hech narsa */
export function RightRail({ data, user, til, meter = null }: { data: RailData; user: RailUser | null; til: Locale; meter?: Completeness | null }) {
  const { creators, official } = data;
  return (
    <div className="space-y-6">
      <RailSearch />
      {meter && <ProfileMeter data={meter} til={til} />}

      {official && (
        <Link href={`/jamoalar/${official.group.slug}`} className="flex items-center gap-3 rounded-lg border border-line p-3 transition hover:bg-surface-2">
          <BadgeCheck size={18} className="shrink-0 text-fg-2" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-fg">{official.group.name}</span>
            <span className="flex items-center gap-1 text-[12px] text-fg-3">
              {official.next?.eventAt ? (
                <>
                  <RadioTower size={12} className="text-accent" /> {tr(til, FEED.nextLive)}: {formatDateTime(official.next.eventAt)}
                </>
              ) : (
                tr(til, FEED.openChannel)
              )}
            </span>
          </span>
          <ArrowUpRight size={14} className="shrink-0 text-fg-4" />
        </Link>
      )}

      {creators.length > 0 && (
        <section aria-labelledby="rail-creators">
          <RailHead id="rail-creators" title={tr(til, FEED.suggested)} href="/mutaxassislar" til={til} />
          <ul className="mt-3 space-y-3">
            {creators.slice(0, 4).map((c) => (
              <li key={c.userId} className="flex items-center gap-3">
                <Link href={`/mutaxassislar/${c.slug}`} className="shrink-0">
                  <Avatar name={c.name} src={c.avatarUrl} size={36} decorative />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/mutaxassislar/${c.slug}`} className="flex items-center gap-1 truncate text-[13.5px] font-semibold text-fg hover:underline">
                    {c.name} {c.isVerified && <VerifiedBadge size={13} />}
                  </Link>
                  <p className="truncate text-[12px] text-fg-3">{CATEGORY_BY_SLUG[c.category]?.name ?? c.title}</p>
                </div>
                <FollowButton userId={c.userId} initialFollowing={c.following} initialCount={c.followers} loggedIn={Boolean(user)} size="sm" compact showCount={false} variant="outline" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
