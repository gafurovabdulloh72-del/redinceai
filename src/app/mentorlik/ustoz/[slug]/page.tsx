import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, GraduationCap, Settings2, Star, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { ShareButton } from "@/components/specialists/ShareButton";
import { JoinButton } from "@/components/groups/JoinButton";
import { GroupFeed } from "@/components/groups/GroupFeed";
import { EventsCard, EventsList } from "@/components/groups/Events";
import { getCurrentUser } from "@/lib/auth";
import { getGroupView, listEvents, listPosts, loadGroupBySlug, markGroupRead, type PostView } from "@/lib/groups/service";
import { categoryLabel, formatSom, levelLabel } from "@/lib/mentorship/format";
import { getMentorPageBySlug } from "@/lib/mentorship/service";
import { cn, compactCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
const TABS = [
  { key: "lenta", label: "Lenta" },
  { key: "bolimlar", label: "Bo'limlar" },
  { key: "efirlar", label: "Efirlar" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getMentorPageBySlug(slug, null);
  if (!data) return { title: "Ustoz topilmadi" };
  const { profile } = data;
  return {
    title: `${profile.name} — ustoz`,
    description: (profile.bio || profile.headline).slice(0, 160),
    alternates: { canonical: `/mentorlik/ustoz/${profile.slug}` },
    openGraph: profile.photoUrl ? { images: [profile.photoUrl] } : undefined,
  };
}

/**
 * Mentor sahifasi = kanal: katta portret va sarlavha, ma'lumot kartalari, so'ng lenta (postlar), bo'limlar (kurslar) va efirlar.
 * Obuna — kanalga qo'shilish; ustoz (yoki admin) lentaning o'zida post va efir qo'yadi.
 */
export default async function MentorChannelPage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const data = await getMentorPageBySlug(slug, user ? { id: user.id, admin: user.role === "admin" } : null);
  if (!data) notFound();
  const { profile, courses, isOwner } = data;

  const channel = profile.channelSlug ? await loadGroupBySlug(profile.channelSlug) : null;
  const view = channel ? await getGroupView(channel.slug, viewer) : null;
  const isMember = view ? view.membership === "owner" || view.membership === "admin" || view.membership === "member" : false;
  if (user && channel && isMember) await markGroupRead(channel.id, user.id).catch(() => undefined);

  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "lenta";
  const [feed, ev] = await Promise.all([
    channel && view && tab === "lenta" ? listPosts(channel, viewer, null) : null,
    channel && view ? listEvents(channel, viewer, tab === "efirlar" ? 30 : 3) : { upcoming: [] as PostView[], past: [] as PostView[] },
  ]);
  const canStudio = isOwner || user?.role === "admin";
  const tabHref = (k: Tab) => (k === "lenta" ? `/mentorlik/ustoz/${profile.slug}` : `/mentorlik/ustoz/${profile.slug}?tab=${k}`);
  const stats = [
    { icon: Users, v: compactCount(view?.membersCount ?? 0), l: "obunachi" },
    { icon: BookOpen, v: String(courses.length), l: "bo'lim" },
    { icon: GraduationCap, v: compactCount(profile.studentsCount), l: "talaba" },
    ...(profile.rating > 0 ? [{ icon: Star, v: String(profile.rating), l: "reyting" }] : []),
  ];

  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/mentorlik" className="transition hover:text-fg">
          Mentorlik
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{profile.name}</span>
      </nav>

      {/* Hero: portret + qora karta */}
      {profile.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.coverUrl} alt="" className="mt-4 aspect-[3/1] w-full rounded-[28px] object-cover" />
      )}
      <section className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-surface-2">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photoUrl} alt={profile.name} className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-fg/[0.04] to-fg/[0.12]">
              <Avatar name={profile.name} src={profile.avatarUrl} size={120} decorative />
            </div>
          )}
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-[18px] bg-[#1b1b1d]/95 px-4 py-3 text-white ring-1 ring-white/15 backdrop-blur">
            <p className="truncate font-display text-[17px] font-extrabold leading-tight">{profile.name}</p>
            <p className="mt-0.5 truncate text-[13px] text-white/70">{profile.roleLabel || "Ustoz"}</p>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-[#1b1b1d] p-6 text-white sm:p-8">
          <div className="relative">
            {profile.expertise.length > 0 && (
              <p className="mb-3 flex flex-wrap gap-1.5">
                {profile.expertise.map((e) => (
                  <span key={e} className="rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] font-semibold text-white/85">
                    {categoryLabel(e)}
                  </span>
                ))}
              </p>
            )}
            <h1 className="max-w-2xl font-display text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-[38px]">{profile.headline}</h1>
            {profile.bio && <p className="mt-4 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-white/72 sm:text-[16px]">{profile.bio}</p>}
          </div>
          <div className="relative mt-6 space-y-4">
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {stats.map((s) => (
                <div key={s.l} className="flex items-center gap-2">
                  <s.icon size={15} className="text-white/55" aria-hidden />
                  <dd className="font-display text-[18px] font-extrabold tabular-nums">{s.v}</dd>
                  <dt className="text-[12.5px] text-white/60">{s.l}</dt>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center gap-2" data-theme="dark">
              {view && (view.membership === "member" || view.membership === "pending" || view.membership === null) && <JoinButton slug={view.slug} membership={view.membership} isPrivate={view.isPrivate} loggedIn={Boolean(user)} official={view.isOfficial} />}
              <ShareButton title={profile.name} size="md" variant="outline" iconOnly />
              {canStudio && (
                <Link href={user?.role === "admin" && !isOwner ? `/admin/mentorlik/${profile.id}` : "/kabinet/mentorlik"} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/25 px-4 text-[14px] font-semibold text-white transition hover:bg-white/10">
                  <Settings2 size={16} /> Sozlash
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Ma'lumot kartalari */}
      {profile.highlights.length > 0 && (
        <section className={cn("mt-3 grid gap-3", profile.highlights.length === 1 ? "" : profile.highlights.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {profile.highlights.map((h, i) => (
            <article key={i} className="card rounded-[24px] p-5 sm:p-6">
              <h2 className="font-display text-[17px] font-extrabold text-fg">{h.title}</h2>
              {h.text && <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{h.text}</p>}
            </article>
          ))}
        </section>
      )}

      <nav className="mt-7 flex gap-1 border-b border-line" aria-label="Ustoz bo'limlari">
        {TABS.filter((t) => t.key !== "efirlar" || ev.upcoming.length + ev.past.length > 0 || tab === "efirlar").map((t) => (
          <Link key={t.key} href={tabHref(t.key)} aria-current={t.key === tab ? "page" : undefined} className={cn("relative inline-flex h-11 shrink-0 items-center px-4 text-[14px] font-semibold transition-colors", t.key === tab ? "text-fg" : "text-fg-3 hover:text-fg")}>
            {t.label}
            {t.key === "bolimlar" && courses.length > 0 && <span className="ml-1.5 text-[12px] font-medium text-fg-4">{courses.length}</span>}
            {t.key === tab && <span aria-hidden className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-fg" />}
          </Link>
        ))}
      </nav>

      <div key={tab} className="mx-auto mt-6 max-w-[720px] animate-fade-in">
        {tab === "lenta" && view && (
          <>
            {ev.upcoming.length > 0 && <EventsCard events={ev.upcoming.slice(0, 3)} />}
            {feed ? (
              <GroupFeed slug={view.slug} kind={view.kind} canPost={view.canPost} canInteract={isMember} canSchedule={view.canManage} loggedIn={Boolean(user)} initial={feed} highlightId={typeof sp.post === "string" ? sp.post : null} />
            ) : null}
          </>
        )}
        {tab === "lenta" && !view && <p className="card p-8 text-center text-[14px] text-fg-3">Kanal hali tayyor emas.</p>}
        {tab === "bolimlar" &&
          (courses.length === 0 ? (
            <p className="card p-8 text-center text-[14px] text-fg-3">Hozircha ochiq bo&apos;lim yo&apos;q.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link href={`/mentorlik/${c.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
                    <div className="relative aspect-video overflow-hidden bg-surface-2">
                      {c.coverUrl ? <SafeImage src={c.coverUrl} alt={c.title} width={480} height={270} className="img-zoom h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center bg-fg/5"><GraduationCap size={28} className="text-fg-4" /></div>}
                    </div>
                    <div className="flex flex-1 flex-col p-3.5">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-accent-text">{categoryLabel(c.category)} · {levelLabel(c.level)}</span>
                      <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-fg">{c.title}</h3>
                      <p className="mt-auto pt-3 text-[12.5px] text-fg-3">
                        {c.lessonsCount} dars · {formatSom(c.priceFrom)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        {tab === "efirlar" && <EventsList ev={ev} />}
      </div>
    </div>
  );
}
