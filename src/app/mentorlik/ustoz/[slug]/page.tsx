import { LiveBar } from "@/components/live/LiveBar";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, GraduationCap, RadioTower, Settings2, Star, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { SafeImage } from "@/components/specialists/SafeImage";
import { ShareButton } from "@/components/specialists/ShareButton";
import { JoinButton } from "@/components/groups/JoinButton";
import { GroupFeed } from "@/components/groups/GroupFeed";
import { GroupChat } from "@/components/groups/GroupChat";
import { EventsCard, EventsList } from "@/components/groups/Events";
import { getCurrentUser } from "@/lib/auth";
import { getGroupView, listEvents, listPosts, loadGroupBySlug, markGroupRead, type PostView } from "@/lib/groups/service";
import { categoryLabel, formatSom, levelLabel } from "@/lib/mentorship/format";
import { getMentorPageBySlug } from "@/lib/mentorship/service";
import { Recordings } from "@/components/live/Recordings";
import { BuyButton, RefCapture } from "@/components/mentorship/PurchaseDialog";
import { mentorBadges } from "@/lib/mentorship/growth";
import { listRoadmaps, listShowcase } from "@/lib/mentorship/learning";
import { listSlots, myConsults } from "@/lib/mentorship/purchases";
import { db as _db } from "@/lib/db";
import { mentorSubs } from "@/lib/db/schema";
import { and as _and, eq as _eq } from "drizzle-orm";
import { DeleteLiveButton } from "@/components/live/DeleteLiveButton";
import { activeLive, listRecordings, pastLives } from "@/lib/live/service";
import { cn, compactCount, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
const TABS = [
  { key: "lenta", label: "Lenta" },
  { key: "bolimlar", label: "Bo'limlar" },
  { key: "efirlar", label: "Efirlar" },
  { key: "muhokama", label: "Muhokama" },
  { key: "konsultatsiya", label: "1:1" },
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
  const [liveNow, past, recs] = channel && view?.canView ? await Promise.all([activeLive(channel.id), tab === "efirlar" ? pastLives(channel.id) : Promise.resolve([]), tab === "efirlar" || tab === "lenta" ? listRecordings(channel.id, Boolean(view.canManage), viewer) : Promise.resolve([])]) : [null, [], []];
  const [feed, ev] = await Promise.all([
    channel && view && tab === "lenta" ? listPosts(channel, viewer, null) : null,
    channel && view ? listEvents(channel, viewer, tab === "efirlar" ? 30 : 3) : { upcoming: [] as PostView[], past: [] as PostView[] },
  ]);
  const canStudio = isOwner || user?.role === "admin";
  const badges = await mentorBadges({ id: profile.id, userId: profile.userId, channelId: channel?.id ?? null, studentsCount: profile.studentsCount, rating: profile.rating, reviewsCount: profile.reviewsCount });
  const subRow = user && profile.subPrice > 0 ? await _db.query.mentorSubs.findFirst({ where: _and(_eq(mentorSubs.userId, user.id), _eq(mentorSubs.mentorId, profile.id)) }) : null;
  const subActive = Boolean(subRow && subRow.until.getTime() > Date.now());
  const [roadmaps, showcase] = tab === "bolimlar" ? await Promise.all([listRoadmaps(profile.id, user?.id ?? null), listShowcase(profile.id)]) : [[], []];
  const [slots, myBooked] = tab === "konsultatsiya" ? await Promise.all([listSlots(profile.id, false), user ? myConsults(user.id, null) : Promise.resolve([])]) : [[], []];

  const tabHref = (k: Tab) => (k === "lenta" ? `/mentorlik/ustoz/${profile.slug}` : `/mentorlik/ustoz/${profile.slug}?tab=${k}`);
  const stats = [
    { icon: Users, v: compactCount(view?.membersCount ?? 0), l: "obunachi" },
    { icon: BookOpen, v: String(courses.length), l: "bo'lim" },
    { icon: GraduationCap, v: compactCount(profile.studentsCount), l: "talaba" },
    ...(profile.rating > 0 ? [{ icon: Star, v: String(profile.rating), l: "reyting" }] : []),
  ];

  return (
    <div className="container-x animate-fade-up">
      <RefCapture />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: profile.name, jobTitle: profile.roleLabel || profile.headline, description: profile.bio || profile.headline, image: profile.photoUrl || undefined, url: `/mentorlik/ustoz/${profile.slug}` }).replace(/</g, "\\u003c"),
        }}
      />
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
            {badges.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span key={b.key} title={b.hint} className="inline-flex items-center gap-1 rounded-full bg-white/14 px-2.5 py-1 text-[12px] font-semibold text-white">
                    ✓ {b.label}
                  </span>
                ))}
              </p>
            )}
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
            {liveNow && (
              <Link href={`/mentorlik/ustoz/${profile.slug}?efir=1`} className="inline-flex items-center gap-2 rounded-full bg-danger px-3.5 py-1.5 text-[13px] font-bold text-white">
                <span className="h-2 w-2 animate-ping-soft rounded-full bg-white" /> Hozir jonli efirda — qo&apos;shilish
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-2" data-theme="dark">
              {profile.subPrice > 0 && !canStudio &&
                (subActive ? (
                  <span className="inline-flex h-11 items-center rounded-full bg-white/15 px-4 text-[13.5px] font-semibold">✓ Obunachisiz · {formatDateTime(subRow!.until.getTime())} gacha</span>
                ) : (
                  <BuyButton type="sub" id={profile.id} loggedIn={Boolean(user)} className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-bold text-black">
                    Obuna — {formatSom(profile.subPrice)}/oy
                  </BuyButton>
                ))}
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
        {TABS.map((t) => (
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
            <LiveBar slug={view.slug} canHost={view.canManage} loggedIn={Boolean(user)} />
            {ev.upcoming.length > 0 && <EventsCard events={ev.upcoming.slice(0, 3)} />}
            {feed ? (
              <GroupFeed slug={view.slug} kind={view.kind} canPost={view.canPost} canInteract={isMember} canSchedule={view.canManage} allowSubOnly={view.canManage && profile.subPrice > 0} loggedIn={Boolean(user)} initial={feed} highlightId={typeof sp.post === "string" ? sp.post : null} />
            ) : null}
          </>
        )}
        {tab === "lenta" && !view && <p className="card p-8 text-center text-[14px] text-fg-3">Kanal hali tayyor emas.</p>}
        {tab === "bolimlar" && roadmaps.length > 0 && (
          <div className="mb-5 space-y-3">
            {roadmaps.map((r) => (
              <section key={r.id} className="card p-4 sm:p-5">
                <h2 className="font-display text-[17px] font-extrabold text-fg">{r.title}</h2>
                {r.description && <p className="mt-0.5 text-[13.5px] text-fg-3">{r.description}</p>}
                <ol className="mt-3 space-y-2">
                  {r.steps.map((st, i) => (
                    <li key={st.id}>
                      <Link href={`/mentorlik/${st.slug}`} className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2.5 transition hover:border-fg">
                        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold", st.progressPct === 100 ? "bg-success text-white" : "bg-fg text-bg")}>{st.progressPct === 100 ? "✓" : i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-fg">{st.title}</span>
                          <span className="text-[12px] text-fg-3">{st.lessonsCount} dars · {formatSom(st.priceFrom)}{st.progressPct != null && st.progressPct < 100 ? ` · ${st.progressPct}% tugatilgan` : ""}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
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
        {tab === "bolimlar" && showcase.length > 0 && (
          <section className="card mt-5 p-4 sm:p-5">
            <h2 className="text-[15px] font-bold text-fg">Talabalar ishi</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {showcase.map((w) => (
                <li key={w.id} className="rounded-[14px] border border-line p-3">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-fg"><Avatar name={w.student} src={w.avatarUrl} size={22} decorative /> {w.student}{w.grade != null && <span className="ml-auto rounded bg-success-soft px-1.5 py-0.5 text-[11.5px] text-success-text">{w.grade}/100</span>}</p>
                  {w.body && <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-[13.5px] text-fg-2">{w.body}</p>}
                  {w.fileUrl && /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(w.fileUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.fileUrl} alt="" className="mt-2 max-h-56 w-full rounded-lg object-cover" />
                  )}
                  {w.fileUrl && /\.(?:mp4|webm|mov)(?:\?|$)/i.test(w.fileUrl) && <video src={w.fileUrl} controls controlsList="nodownload noremoteplayback" disablePictureInPicture playsInline className="mt-2 aspect-video w-full rounded-lg bg-black" />}
                </li>
              ))}
            </ul>
          </section>
        )}
        {tab === "konsultatsiya" && (
          <div className="space-y-4">
            {myBooked.length > 0 && (
              <section className="card p-4 sm:p-5">
                <h2 className="text-[15px] font-bold text-fg">Mening konsultatsiyalarim</h2>
                <ul className="mt-3 divide-y divide-line">
                  {myBooked.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[14px]">
                      <span className="font-semibold text-fg">{formatDateTime(b.startsAt.getTime())}</span>
                      <span className="text-fg-3">{b.durationMin} daq · {b.mentor.user.name}{b.bookedBy !== user?.id ? ` ↔ ${b.buyerName}` : ""}</span>
                      <Link href={`/mentorlik/konsultatsiya/${b.id}`} className="ml-auto text-[13px] font-semibold text-accent-text">Ochish</Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card p-4 sm:p-5">
              <h2 className="text-[15px] font-bold text-fg">1:1 konsultatsiya</h2>
              <p className="mt-0.5 text-[13px] text-fg-3">Vaqtni tanlang, to&apos;lang — belgilangan soatda video qo&apos;ng&apos;iroq shu yerda ochiladi.</p>
              {slots.length === 0 ? (
                <p className="mt-4 text-[14px] text-fg-3">Hozircha bo&apos;sh vaqt yo&apos;q.{canStudio ? " Vaqtlarni «Daromad va sozlamalar» sahifasida qo'shing." : ""}</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {slots.map((sl) => (
                    <li key={sl.id} className="flex flex-wrap items-center gap-3 py-3 text-[14px]">
                      <span className="font-semibold text-fg">{formatDateTime(sl.startsAt.getTime())}</span>
                      <span className="text-fg-3">{sl.durationMin} daq</span>
                      <span className="ml-auto font-semibold tabular-nums text-fg">{formatSom(sl.priceSom)}</span>
                      {!canStudio && (
                        <BuyButton type="consult" id={sl.id} loggedIn={Boolean(user)} className="btn-accent inline-flex h-9 items-center px-4 text-[13px] font-semibold">
                          Band qilish
                        </BuyButton>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        {tab === "efirlar" && (
          <>
            {view && <LiveBar slug={view.slug} canHost={view.canManage} loggedIn={Boolean(user)} />}
            <EventsList ev={ev} />
            <Recordings items={recs} canManage={Boolean(view?.canManage)} courses={courses.map((c) => ({ id: c.id, title: c.title }))} />
            {past.length > 0 && (
              <section className="card mt-4 p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-bold text-fg">
                  <RadioTower size={16} className="text-fg-3" /> O&apos;tgan jonli efirlar
                </h2>
                <ul className="mt-3 divide-y divide-line">
                  {past.map((l) => (
                    <li key={l.id} className="flex items-center gap-3 py-2.5">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">{l.title}</p>
                      <span className="shrink-0 text-[12px] text-fg-3">{formatDateTime(l.startedAt)} · {l.minutes} daq{l.peak > 0 ? ` · ${l.peak} tomoshabin` : ""}</span>
                      {view?.canManage && <DeleteLiveButton id={l.id} title={l.title} />}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        {tab === "muhokama" &&
          (view && isMember ? (
            <GroupChat slug={view.slug} membersCount={view.membersCount} kind={view.kind} canManage={view.canManage} />
          ) : (
            <p className="card p-8 text-center text-[14px] text-fg-3">Muhokamada qatnashish uchun ustoz kanaliga obuna bo&apos;ling.</p>
          ))}
      </div>
    </div>
  );
}
