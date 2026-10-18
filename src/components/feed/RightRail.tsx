import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Briefcase, Hash, MapPinned, RadioTower, UsersRound } from "lucide-react";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { FollowButton } from "@/components/groups/FollowButton";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { RailData } from "@/lib/feed";
import { professionLabel, salaryLabel } from "@/lib/vacancies/format";
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

/** O'ng panel (desktop): men, rasmiy kanal, tavsiya ijodkorlar, trend teglar, faol jamoalar, vakansiyalar, xarita — yassi, neytral plitkalar */
export function RightRail({ data, user, til }: { data: RailData; user: RailUser | null; til: Locale }) {
  const { creators, groups, vacancies, official, tags } = data;
  const tile = "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-fg/5 text-fg-2";
  const rowLink = "flex items-center gap-3 rounded-[14px] transition hover:bg-fg/4";
  return (
    <div className="space-y-3">
      {user && (
        <Link href={user.specialistSlug ? `/mutaxassislar/${user.specialistSlug}` : "/kabinet"} className="card card-hover flex items-center gap-3 p-3">
          <Avatar name={user.name} src={user.avatarUrl} size={36} decorative />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-fg">{user.name}</span>
            <span className="block text-[12px] text-fg-3">{tr(til, user.specialistSlug ? FEED.myProfile : FEED.cabinet)}</span>
          </span>
          <ArrowUpRight size={15} className="shrink-0 text-fg-4" />
        </Link>
      )}

      {official && (
        <Link href={`/jamoalar/${official.group.slug}`} className="card card-hover flex items-center gap-3 p-3">
          <span className={tile}>
            <BadgeCheck size={18} />
          </span>
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
          <ArrowUpRight size={15} className="shrink-0 text-fg-4" />
        </Link>
      )}

      {creators.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-creators">
          <RailHead id="rail-creators" title={tr(til, FEED.suggested)} href="/mutaxassislar" til={til} />
          <ul className="mt-3 space-y-2.5">
            {creators.map((c) => (
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

      {tags.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-tags">
          <RailHead id="rail-tags" title={tr(til, FEED.trending)} til={til} />
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t.tag}>
                <Link href={`/?tag=${encodeURIComponent(t.tag)}`} className="pill press inline-flex h-8 items-center gap-0.5 px-2.5 text-[12.5px] font-semibold text-fg-2 transition hover:text-fg" title={`${t.count} post`}>
                  <Hash size={12} className="text-fg-4" />
                  {t.tag}
                  <span className="ml-1 text-[11px] font-medium tabular-nums text-fg-4">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-groups">
          <RailHead id="rail-groups" title={tr(til, FEED.activeGroups)} href="/jamoalar" til={til} />
          <ul className="mt-3 space-y-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/jamoalar/${g.slug}`} className={rowLink}>
                  <span className={tile}>
                    <UsersRound size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{g.name}</span>
                    <span className="block text-[12px] text-fg-3">{FEED.members[til](g.membersCount)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vacancies.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-vac">
          <RailHead id="rail-vac" title={tr(til, FEED.newVacancies)} href="/vakansiyalar" til={til} />
          <ul className="mt-3 space-y-2">
            {vacancies.map((v) => (
              <li key={v.id}>
                <Link href={`/vakansiyalar/${v.id}`} className={rowLink}>
                  <span className={tile}>
                    <Briefcase size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{v.title}</span>
                    <span className="block truncate text-[12px] text-fg-3">
                      {v.company || professionLabel(v.profession, true)} · {salaryLabel(v.salaryMin, v.salaryMax)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/xarita" className="card card-hover icon-nudge flex items-center gap-3 p-3">
        <span className={tile}>
          <MapPinned size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-fg">{tr(til, FEED.mapCard)}</span>
          <span className="block text-[12px] text-fg-3">{tr(til, FEED.mapCardText)}</span>
        </span>
        <ArrowUpRight size={15} className="shrink-0 text-fg-4" />
      </Link>
    </div>
  );
}
