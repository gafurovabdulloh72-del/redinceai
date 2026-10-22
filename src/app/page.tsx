import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { HomeComposer } from "@/components/feed/HomeComposer";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { RightRail } from "@/components/feed/RightRail";
import { HomeFeedSwitcher } from "@/components/feed/HomeFeedSwitcher";
import { FEED_SCOPE_COOKIE as SCOPE_COOKIE } from "@/lib/groups/limits";
import { Stories } from "@/components/feed/Stories";
import { OnboardingCard } from "@/components/feed/OnboardingCard";
import { ProfileMeter } from "@/components/feed/ProfileMeter";
import { creatorOnboarding, ONBOARDING_COOKIE, ONBOARDING_DAYS } from "@/lib/onboarding";
import { storyRail } from "@/lib/stories/service";
import { ownCompleteness } from "@/lib/profile/own-completeness";
import { getCurrentUser } from "@/lib/auth";
import { feedItemById, homeFeed, railData, storyAuthors, type FeedScope } from "@/lib/feed";
import { savedCount } from "@/lib/groups/posts-extra";
import { normalizeTag } from "@/lib/groups/limits";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import { getLocale } from "@/lib/i18n/server";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Bosh sahifa — ijtimoiy tarmoq lentasi: hikoyalar qatori (faol ijodkorlar, yaqin efir, saqlanganlar), kompozitor (ijodkorlar uchun),
 * "Hammasi / Obunalarim" lentasi (tanlov cookie'da), `?tag=` teg filtri, `?post=` — aynan shu post tepada; o'ngda tavsiyalar.
 * Mehmon — ommaviy lenta + qo'shilish kartasi.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, user, til, jar] = await Promise.all([searchParams, getCurrentUser(), getLocale(), cookies()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const remembered = jar.get(SCOPE_COOKIE)?.value;
  const wanted = typeof sp.scope === "string" ? sp.scope : remembered;
  const scope: FeedScope = wanted === "following" && user ? "following" : "all";
  const tag = typeof sp.tag === "string" ? normalizeTag(sp.tag) : null;
  const postId = typeof sp.post === "string" && sp.post.length <= 64 ? sp.post : null;
  // Yangi ijodkor yo'riqnomasi: faqat mutaxassisga, dastlabki ONBOARDING_DAYS kunda, «Keyinroq» bosilmagan bo'lsa
  const wantsOnboarding = Boolean(user && (user.specialist || user.role === "specialist") && user.role !== "admin" && !jar.get(ONBOARDING_COOKIE) && Date.now() - user.createdAt.getTime() < ONBOARDING_DAYS * 86_400_000);
  const [feed, stories, rail, pinned, saved, own, onboarding, storyItems] = await Promise.all([
    homeFeed(viewer, { scope, limit: 10, tag }),
    storyAuthors(14).catch(() => []),
    railData(viewer),
    postId ? feedItemById(postId, viewer).catch(() => null) : Promise.resolve(null),
    user ? savedCount(user.id).catch(() => 0) : Promise.resolve(null),
    user ? ownCompleteness(user).catch(() => null) : Promise.resolve(null),
    user && wantsOnboarding ? creatorOnboarding(user).catch(() => null) : Promise.resolve(null),
    storyRail(viewer).catch(() => []),
  ]);
  const onboardingOpen = Boolean(onboarding?.next);
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
          {onboarding && onboardingOpen ? <OnboardingCard steps={onboarding.steps} til={til} /> : own && <ProfileMeter data={own} til={til} className="lg:hidden" />}
          <Stories items={stories} live={live} til={til} saved={saved !== null ? { count: saved } : null} rail={storyItems} me={user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null} canCreate={canPost} />
          {canPost && <HomeComposer />}
          {user ? (
            <HomeFeedSwitcher key={`${tag ?? ""}:${pinned?.id ?? ""}`} initialScope={scope} initialFeed={feed} tag={tag} loggedIn suggestions={rail.creators} pinned={pinned} />
          ) : (
            <HomeFeed key={`${scope}:${tag ?? ""}:${pinned?.id ?? ""}`} initial={feed} scope={scope} loggedIn={false} tag={tag} suggestions={rail.creators} pinned={pinned} />
          )}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-6 pt-8">
            <RightRail data={rail} user={railUser} til={til} meter={own} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Mehmon uchun qo'shilish kartasi — lenta ustida, ixcham va yassi (landing emas) */
function WelcomeCard({ til }: { til: Locale }) {
  return (
    <section className="card p-5 sm:p-6" aria-label={tr(til, FEED.welcomeEyebrow)}>
      <span className="eyebrow">{tr(til, FEED.welcomeEyebrow)}</span>
      <h2 className="mt-2 font-display text-[21px] font-semibold leading-tight tracking-tight text-fg sm:text-[24px]">{tr(til, FEED.welcomeTitle)}</h2>
      <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-fg-2">{tr(til, FEED.welcomeText)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ButtonLink href="/auth/royxat" variant="accent" size="md">
          {tr(til, FEED.start)} <ArrowRight size={16} />
        </ButtonLink>
        <Link href="/auth/kirish" className="text-[13.5px] font-semibold text-fg-2 transition hover:text-fg">
          {tr(til, FEED.login)}
        </Link>
        <Link href="/haqida" className="ml-auto text-[13px] font-semibold text-fg-3 transition hover:text-fg">
          {tr(til, FEED.about)}
        </Link>
      </div>
    </section>
  );
}
