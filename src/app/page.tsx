import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { HomeComposer } from "@/components/feed/HomeComposer";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { RightRail } from "@/components/feed/RightRail";
import { Stories } from "@/components/feed/Stories";
import { getCurrentUser } from "@/lib/auth";
import { homeFeed, railData, storyAuthors, type FeedScope } from "@/lib/feed";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { getLocale } from "@/lib/i18n/server";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Bosh sahifa — ijtimoiy tarmoq lentasi: hikoyalar qatori (faol ijodkorlar, yaqin efir), kompozitor (ijodkorlar uchun),
 * "Hammasi / Obunalarim" lentasi, o'ngda tavsiyalar (ijodkorlar, jamoalar, vakansiyalar, xarita). Mehmon — ommaviy lenta + qo'shilish kartasi.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, user, til] = await Promise.all([searchParams, getCurrentUser(), getLocale()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const scope: FeedScope = sp.scope === "following" && user ? "following" : "all";
  const [feed, stories, rail] = await Promise.all([homeFeed(viewer, { scope, limit: 10 }), storyAuthors(14).catch(() => []), railData(viewer)]);
  const canPost = Boolean(user && (user.specialist || user.role === "admin"));
  const now = Date.now();
  const live =
    rail.official?.next?.eventAt
      ? { href: `/jamoalar/${rail.official.group.slug}`, label: rail.official.group.name, isLive: now >= rail.official.next.eventAt && now < rail.official.next.eventAt + 2 * 60 * 60 * 1000 }
      : null;
  const railUser = user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl, role: user.role, specialistSlug: user.specialist?.slug ?? null } : null;

  return (
    <div className="container-x">
      <div className="mx-auto grid max-w-[1040px] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full min-w-0 max-w-[640px] space-y-4 lg:mx-0">
          <h1 className="sr-only">{SITE.name} — lenta</h1>
          {!user && <WelcomeCard til={til} />}
          <Stories items={stories} live={live} til={til} />
          {canPost && <HomeComposer />}
          {user && (
            <div className="segment w-full" role="tablist" aria-label="Lenta">
              {(
                [
                  ["all", FEED.all, "/"],
                  ["following", FEED.following, "/?scope=following"],
                ] as const
              ).map(([k, l, href]) => (
                <Link key={k} href={href} role="tab" aria-selected={scope === k} data-active={scope === k} className="segment-item min-h-10 flex-1 justify-center">
                  {tr(til, l)}
                </Link>
              ))}
            </div>
          )}
          <HomeFeed key={scope} initial={feed} scope={scope} loggedIn={Boolean(user)} />
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-8">
            <RightRail data={rail} user={railUser} til={til} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Mehmon uchun qo'shilish kartasi — lenta ustida, ixcham (landing emas) */
function WelcomeCard({ til }: { til: Locale }) {
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-label={tr(til, FEED.welcomeEyebrow)}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <span className="eyebrow">
        <Sparkles size={13} className="text-accent" /> {tr(til, FEED.welcomeEyebrow)}
      </span>
      <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-tight text-fg sm:text-[26px]">{tr(til, FEED.welcomeTitle)}</h2>
      <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-fg-2">{tr(til, FEED.welcomeText)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ButtonLink href="/auth/royxat" variant="accent" size="md">
          {tr(til, FEED.start)} <ArrowRight size={16} />
        </ButtonLink>
        <ButtonLink href="/auth/kirish" variant="outline" size="md">
          {tr(til, FEED.login)}
        </ButtonLink>
        <Link href="/haqida" className="ml-auto text-[13px] font-semibold text-fg-3 transition hover:text-fg">
          {tr(til, FEED.about)}
        </Link>
      </div>
    </section>
  );
}
