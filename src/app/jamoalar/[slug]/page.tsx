import { LiveBar } from "@/components/live/LiveBar";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, CalendarDays, Lock, Play, Radio, Settings2, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CoverImage } from "@/components/specialists/CoverImage";
import { SafeImage } from "@/components/specialists/SafeImage";
import { JoinButton } from "@/components/groups/JoinButton";
import { GroupFeed } from "@/components/groups/GroupFeed";
import { GroupChat } from "@/components/groups/GroupChat";
import { GroupMembers } from "@/components/groups/GroupMembers";
import { GroupCard } from "@/components/groups/GroupCard";
import { MuteButton } from "@/components/groups/MuteButton";
import { InviteJoin } from "@/components/groups/InviteJoin";
import { ExpandableText } from "@/components/groups/ExpandableText";
import { RulesText } from "@/components/groups/RulesText";
import { ShareButton } from "@/components/specialists/ShareButton";
import { OfficialCover } from "@/components/groups/OfficialCover";
import { EventsCard, EventsList } from "@/components/groups/Events";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { getGroupView, groupStats, listEvents, listGroupMedia, listMembers, listPosts, loadGroupByAnySlug, markGroupRead, similarGroups, type GroupListItem, type GroupStats, type GroupView, type MediaItem, type PostView } from "@/lib/groups/service";
import { cn, compactCount, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Raw = Record<string, string | string[] | undefined>;

const TABS = [
  { key: "lenta", label: "Lenta" },
  { key: "chat", label: "Chat" },
  { key: "azolar", label: "A'zolar" },
  { key: "media", label: "Media" },
  { key: "efirlar", label: "Efirlar" },
  { key: "haqida", label: "Haqida" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Promise<Raw> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await loadGroupByAnySlug(slug);
  // notFound() aynan SHU YERDA: `[slug]/loading.tsx` Suspense chegarasi sahifa tanasidagi
  // notFound() dan oldin javobni oqizib yuboradi va holat 200 bo‘lib qoladi (yumshoq 404 —
  // Google mavjud bo‘lmagan manzillarni indekslaydi). generateMetadata oqimdan oldin ishlaydi.
  if (!g) notFound();
  // Eski manzil: metadata javob oqimi boshlanishidan OLDIN hisoblanadi — shu yerda haqiqiy 308 beriladi
  // (sahifa ichidagi redirect loading.tsx tufayli 200 + meta refresh bo'lib qolardi)
  if (g.slug !== slug) {
    const sp = await searchParams;
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    permanentRedirect(`/jamoalar/${g.slug}${qs ? `?${qs}` : ""}`);
  }
  return {
    title: `${g.name} — jamoa`,
    description: g.description.slice(0, 160) || `${g.name}: Kasb Egalari ijodkorlar jamoasi`,
    alternates: { canonical: `/jamoalar/${g.slug}` },
    robots: g.isPrivate ? { index: false, follow: false } : undefined,
  };
}

function LockedNotice({ view, loggedIn, what }: { view: GroupView; loggedIn: boolean; what: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-5 py-10 text-center" data-reveal="scale">
      <span className="icon-tile-soft !rounded-full">
        <Lock size={18} />
      </span>
      <p className="text-[15px] font-semibold text-fg">{what} faqat a&apos;zolarga</p>
      <p className="max-w-md text-[13px] leading-relaxed text-fg-3">{view.membership === "pending" ? "So'rovingiz yuborilgan — egasi tasdiqlashi bilan ochiladi." : view.isPrivate ? "Yopiq jamoa — so'rov yuboring." : "Qo'shiling — bepul, bir bosishda."}</p>
      <JoinButton slug={view.slug} membership={view.membership} isPrivate={view.isPrivate} loggedIn={loggedIn} official={view.isOfficial} />
    </div>
  );
}

/** Jamoa sahifasi: hero (muqova 3:1, bitta meta qatori, qo'shilish), bo'limlar: lenta | chat | a'zolar | media | efirlar | haqida */
export default async function GroupPage({ params, searchParams }: { params: Params; searchParams: Promise<Raw> }) {
  const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const group = await loadGroupByAnySlug(slug);
  if (!group) notFound();
  // Eski manzil (slug o'zgartirilgan) — yangisiga doimiy yo'naltirish, so'rov parametrlari saqlanadi
  if (group.slug !== slug) {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
    permanentRedirect(`/jamoalar/${group.slug}${qs ? `?${qs}` : ""}`);
  }
  const view = await getGroupView(group.slug, viewer);
  if (!view) notFound();

  const tabRaw = typeof sp.tab === "string" ? sp.tab : "lenta";
  const tab: Tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as Tab) : "lenta";
  const highlight = typeof sp.post === "string" ? sp.post : null;
  const invite = typeof sp.invite === "string" ? sp.invite.slice(0, 40) : null;
  const loggedIn = Boolean(user);
  const isMember = view.membership === "owner" || view.membership === "admin" || view.membership === "member";
  // Lenta/chat ochilganda "o'qildi" — katalogdagi "yangi" nuqtasi o'chadi
  if (user && isMember && tab !== "haqida") await markGroupRead(group.id, user.id).catch(() => undefined);
  const cat = view.category ? CATEGORY_BY_SLUG[view.category] : null;
  const region = view.region ? REGION_BY_SLUG[view.region] : null;

  // Bo'lim ma'lumotlari faqat kerak bo'lganda yuklanadi
  const [feed, members, media, ev, stats, similar] = await Promise.all([
    tab === "lenta" && view.canView ? listPosts(group, viewer, null) : null,
    tab === "azolar" && view.canView ? Promise.all([listMembers(group.id, "active"), view.canManage ? listMembers(group.id, "pending") : Promise.resolve([])]) : null,
    tab === "media" && view.canView ? listGroupMedia(group) : null,
    view.canView ? listEvents(group, viewer, tab === "efirlar" ? 30 : 3) : { upcoming: [] as PostView[], past: [] as PostView[] },
    view.canView ? groupStats(group.id) : null,
    similarGroups(group, viewer, 3),
  ]);
  const events = ev.upcoming.slice(0, 3);
  const hasEvents = ev.upcoming.length + ev.past.length > 0;

  const tabHref = (key: Tab) => (key === "lenta" ? `/jamoalar/${view.slug}` : `/jamoalar/${view.slug}?tab=${key}`);
  const tabs = TABS.filter((t) => (t.key === "efirlar" ? hasEvents || tab === "efirlar" : true));
  const metaParts = [cat ? { icon: <CategoryIcon icon={cat.icon} size={13} />, text: cat.plural } : null, region ? { icon: null, text: region.short } : null].filter(Boolean) as Array<{ icon: React.ReactNode; text: string }>;

  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/jamoalar" className="transition hover:text-fg">
          Jamoalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{view.name}</span>
      </nav>

      {/* Hero — overflow-hidden faqat muqovada (bildirishnoma menyusi karta chetidan chiqa olsin) */}
      <section className="card mt-4" style={{ ["--cover-y" as string]: `${view.coverPosition ?? 50}%` }}>
        <div className="relative aspect-[3/1] max-h-[240px] w-full overflow-hidden rounded-t-[inherit] bg-surface-2 [&_img]:[object-position:center_var(--cover-y)]">
          {view.isOfficial && !view.coverUrl ? <OfficialCover name={view.name} /> : <CoverImage src={view.coverUrl} category={view.category ?? undefined} seed={view.slug} priority />}
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h1 className="display-xl flex flex-wrap items-center gap-x-2 text-fg">
              {view.name}
              {view.isOfficial && <BadgeCheck size={22} className="shrink-0 text-accent" aria-label="Rasmiy kanal" />}
            </h1>
            {/* Bitta meta qatori: tur · yo'nalish · hudud · a'zolar · egasi */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-3">
              <span className="inline-flex items-center gap-1.5 text-fg-2">
                {view.isPrivate ? <Lock size={13} /> : view.kind === "channel" ? <Radio size={13} /> : <Users size={13} />}
                {view.isOfficial ? "Rasmiy kanal" : view.kind === "channel" ? "Kanal" : "Guruh"}
                {view.isPrivate && " · yopiq"}
              </span>
              {metaParts.map((p) => (
                <span key={p.text} className="inline-flex items-center gap-1.5">
                  <span aria-hidden>·</span>
                  {p.icon}
                  {p.text}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>·</span>
                {compactCount(view.membersCount)} a&apos;zo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>·</span>
                <Avatar name={view.owner.name} src={view.owner.avatarUrl} size={18} decorative />
                {view.owner.slug ? (
                  <Link href={`/mutaxassislar/${view.owner.slug}`} className="font-semibold text-fg-2 underline-offset-2 hover:underline">
                    {view.owner.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-fg-2">{view.owner.name}</span>
                )}
              </span>
            </div>
            {view.description && <ExpandableText text={view.description} lines={3} className="mt-3 max-w-2xl" />}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ShareButton title={view.name} size="md" variant="outline" iconOnly />
            {isMember && <MuteButton slug={view.slug} initialMuted={view.muted} initialMutedUntil={view.mutedUntil} initialEventReminders={view.eventReminders} />}
            {view.canManage && (
              <Link href={`/jamoalar/${view.slug}/sozlash`} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                <Settings2 size={16} /> Sozlash
                {view.pendingCount > 0 && <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-white">{view.pendingCount}</span>}
              </Link>
            )}
            {view.membership !== "owner" && <JoinButton slug={view.slug} membership={view.membership} isPrivate={view.isPrivate} loggedIn={loggedIn} official={view.isOfficial} />}
          </div>
        </div>
      </section>

      {invite && <InviteJoin slug={view.slug} invite={invite} membership={view.membership} loggedIn={loggedIn} />}

      {/* Bo'limlar — sonlar hero'da, bu yerda faqat nom (+ so'rov nuqtasi) */}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Jamoa bo'limlari">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Link key={t.key} href={tabHref(t.key)} aria-current={active ? "page" : undefined} className={cn("relative inline-flex h-11 shrink-0 items-center gap-1.5 px-3.5 text-[14px] font-semibold transition-colors", active ? "text-fg" : "text-fg-3 hover:text-fg")}>
              {t.key === "chat" && view.kind === "channel" ? "Muhokama" : t.label}
              {t.key === "azolar" && view.canManage && view.pendingCount > 0 && <span className="h-2 w-2 rounded-full bg-accent" role="img" aria-label={`${view.pendingCount} ta so'rov`} />}
              {active && <span aria-hidden className="animate-fade-in absolute inset-x-3.5 bottom-0 h-[2px] rounded-full bg-fg" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div key={tab} className="min-w-0 animate-fade-in lg:col-span-8">
          {tab !== "haqida" && view.canView && <LiveBar slug={view.slug} canHost={view.canManage} loggedIn={loggedIn} />}
          {events.length > 0 && tab !== "haqida" && tab !== "efirlar" && <EventsCard events={events} />}
          {tab === "lenta" &&
            (feed ? (
              <GroupFeed slug={view.slug} kind={view.kind} canPost={view.canPost} canInteract={isMember} canSchedule={view.canManage} loggedIn={loggedIn} initial={feed} highlightId={highlight} />
            ) : (
              <LockedNotice view={view} loggedIn={loggedIn} what="Lenta" />
            ))}
          {tab === "chat" && (isMember ? <GroupChat slug={view.slug} membersCount={view.membersCount} kind={view.kind} canManage={view.canManage} /> : <LockedNotice view={view} loggedIn={loggedIn} what="Chat" />)}
          {tab === "azolar" &&
            (members ? (
              <GroupMembers slug={view.slug} canManage={view.canManage} isOwner={view.membership === "owner" || user?.role === "admin"} viewerId={user?.id ?? null} initialActive={members[0]} initialPending={members[1]} />
            ) : (
              <LockedNotice view={view} loggedIn={loggedIn} what="A'zolar ro'yxati" />
            ))}
          {tab === "media" && (media ? <MediaGrid items={media} slug={view.slug} /> : <LockedNotice view={view} loggedIn={loggedIn} what="Media" />)}
          {tab === "efirlar" && (view.canView ? <EventsList ev={ev} /> : <LockedNotice view={view} loggedIn={loggedIn} what="Efirlar" />)}
          {tab === "haqida" && <AboutCard view={view} stats={stats} similar={similar} full />}
        </div>
        {tab !== "haqida" && (
          <aside className="hidden lg:col-span-4 lg:block">
            <AboutCard view={view} stats={stats} similar={similar} />
          </aside>
        )}
      </div>
    </div>
  );
}

const DEFAULT_RULES = "- Hurmat — tanqid ishga, odamga emas.\n- Spam va takroriy reklama yo'q; e'lonlar — egasi ruxsati bilan.\n- Mijoz kontaktlari va shaxsiy ma'lumotlar tarqatilmaydi.\n- Buzilsa — post o'chiriladi, takrorlansa a'zolikdan chiqariladi.";

function AboutCard({ view, stats, similar, full = false }: { view: GroupView; stats: GroupStats | null; similar: GroupListItem[]; full?: boolean }) {
  return (
    <div className="grid gap-4">
      <section className="card p-5">
        <h2 className="text-[15px] font-bold text-fg">Haqida</h2>
        <p className={cn("mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg-2", !full && "line-clamp-6")}>{view.description || "Tavsif hali yozilmagan."}</p>
        <dl className="mt-4 grid gap-2 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-3">Egasi</dt>
            <dd className="flex min-w-0 items-center gap-2 font-semibold text-fg">
              <Avatar name={view.owner.name} src={view.owner.avatarUrl} size={20} decorative />
              {view.owner.slug ? (
                <Link href={`/mutaxassislar/${view.owner.slug}`} className="truncate underline-offset-2 hover:underline">
                  {view.owner.name}
                </Link>
              ) : (
                <span className="truncate">{view.owner.name}</span>
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-fg-3">
              <CalendarDays size={13} /> Yaratilgan
            </dt>
            <dd className="font-semibold text-fg">{formatDateTime(view.createdAt)}</dd>
          </div>
        </dl>
      </section>
      {stats && (
        <section className="card p-5" aria-label="So'nggi 7 kun">
          <h2 className="text-[15px] font-bold text-fg">
            So&apos;nggi 7 kun
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {(
              [
                { k: "Postlar", v: stats.postsWeek },
                { k: "Xabarlar", v: stats.messagesWeek },
                { k: "Faol a'zolar", v: stats.activeWeek },
                { k: "Yangi a'zolar", v: stats.joinedWeek },
              ] as const
            ).map((s) => (
              <div key={s.k}>
                <dd className="font-display text-[22px] font-semibold leading-none text-fg">{compactCount(s.v)}</dd>
                <dt className="mt-1 text-[12px] text-fg-3">{s.k}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="card p-5">
        <h2 className="text-[15px] font-bold text-fg">Qoidalar</h2>
        <RulesText text={view.rules ?? DEFAULT_RULES} className="mt-2 grid gap-2 text-[13px] leading-relaxed text-fg-2" />
      </section>
      {similar.length > 0 && (
        <section aria-labelledby="similar-h">
          <h2 id="similar-h" className="mb-3 text-[15px] font-bold text-fg">
            O&apos;xshash jamoalar
          </h2>
          <ul className={cn("stagger grid gap-3", full && "sm:grid-cols-2 lg:grid-cols-3")}>
            {similar.map((g) => (
              <li key={g.id} className="min-w-0">
                <GroupCard g={g} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Postlardagi rasm/videolar to'ri — bosilsa shu post ochiladi */
function MediaGrid({ items, slug }: { items: MediaItem[]; slug: string }) {
  if (!items.length) {
    return (
      <div className="card flex flex-col items-center gap-2 px-5 py-12 text-center" data-reveal="scale">
        <p className="text-[15px] font-semibold text-fg">Hali media yo&apos;q</p>
        <p className="text-[13px] text-fg-3">Postlardagi rasm va videolar shu yerda to&apos;planadi.</p>
      </div>
    );
  }
  return (
    <ul className="stagger grid grid-cols-3 gap-1 sm:gap-1.5" aria-label="Media">
      {items.map((m) => (
        <li key={`${m.postId}-${m.url}`} className="relative aspect-square overflow-hidden rounded-[10px] bg-surface-3">
          <Link href={`/jamoalar/${slug}?post=${m.postId}`} className="img-zoom block h-full w-full" aria-label={m.type.startsWith("video/") ? "Video post" : "Rasm post"}>
            {m.type.startsWith("video/") ? (
              <>
                <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white">
                  <Play size={12} />
                </span>
              </>
            ) : (
              <SafeImage src={m.url} alt={m.name} width={400} height={400} className="h-full w-full object-cover" />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
