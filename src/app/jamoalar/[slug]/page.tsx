import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Lock, MessageSquareText, Settings2, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CoverImage } from "@/components/specialists/CoverImage";
import { JoinButton } from "@/components/groups/JoinButton";
import { GroupFeed } from "@/components/groups/GroupFeed";
import { GroupChat } from "@/components/groups/GroupChat";
import { GroupMembers } from "@/components/groups/GroupMembers";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { getGroupView, listMembers, listPosts, loadGroupBySlug, type GroupView } from "@/lib/groups/service";
import { cn, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Raw = Record<string, string | string[] | undefined>;

const TABS = [
  { key: "lenta", label: "Lenta" },
  { key: "chat", label: "Chat" },
  { key: "azolar", label: "A'zolar" },
  { key: "haqida", label: "Haqida" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const g = await loadGroupBySlug(slug);
  if (!g) return { title: "Jamoa topilmadi" };
  return {
    title: `${g.name} — jamoa`,
    description: g.description.slice(0, 160) || `${g.name}: Kasb Egalari ijodkorlar jamoasi`,
    alternates: { canonical: `/jamoalar/${g.slug}` },
    robots: g.isPrivate ? { index: false, follow: false } : undefined,
  };
}

function LockedNotice({ view, loggedIn, what }: { view: GroupView; loggedIn: boolean; what: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="icon-tile-soft !rounded-full">
        <Lock size={18} />
      </span>
      <p className="text-[15px] font-semibold text-fg">{what} faqat a&apos;zolarga ko&apos;rinadi</p>
      <p className="max-w-md text-[13px] leading-relaxed text-fg-3">
        {view.membership === "pending" ? "So'rovingiz yuborilgan — jamoa egasi tasdiqlashi bilan ochiladi." : view.isPrivate ? "Bu yopiq jamoa. Qo'shilish so'rovini yuboring — egasi tasdiqlagach lenta va chat ochiladi." : "Jamoaga qo'shiling — bepul va bir bosishda."}
      </p>
      <JoinButton slug={view.slug} membership={view.membership} isPrivate={view.isPrivate} loggedIn={loggedIn} />
    </div>
  );
}

/** Jamoa sahifasi: hero (muqova 3:1, chiplar, qo'shilish), bo'limlar: lenta | chat | a'zolar | haqida */
export default async function GroupPage({ params, searchParams }: { params: Params; searchParams: Promise<Raw> }) {
  const [{ slug }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const viewer = user ? { id: user.id, role: user.role } : null;
  const [view, group] = await Promise.all([getGroupView(slug, viewer), loadGroupBySlug(slug)]);
  if (!view || !group) notFound();

  const tabRaw = typeof sp.tab === "string" ? sp.tab : "lenta";
  const tab: Tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as Tab) : "lenta";
  const highlight = typeof sp.post === "string" ? sp.post : null;
  const loggedIn = Boolean(user);
  const isMember = view.membership === "owner" || view.membership === "admin" || view.membership === "member";
  const cat = view.category ? CATEGORY_BY_SLUG[view.category] : null;
  const region = view.region ? REGION_BY_SLUG[view.region] : null;

  // Bo'lim ma'lumotlari faqat kerak bo'lganda yuklanadi
  const feed = tab === "lenta" && view.canView ? await listPosts(group, viewer, null) : null;
  const members =
    tab === "azolar" && view.canView
      ? await Promise.all([listMembers(group.id, "active"), view.canManage ? listMembers(group.id, "pending") : Promise.resolve([])])
      : null;

  const tabHref = (key: Tab) => (key === "lenta" ? `/jamoalar/${view.slug}` : `/jamoalar/${view.slug}?tab=${key}`);

  return (
    <div className="container-x animate-fade-up">
      <nav aria-label="Yo'l" className="text-[13px] text-fg-3">
        <Link href="/jamoalar" className="transition hover:text-fg">
          Jamoalar
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg-2">{view.name}</span>
      </nav>

      {/* Hero */}
      <section className="card mt-4 overflow-hidden">
        <div className="relative aspect-[3/1] max-h-[300px] w-full overflow-hidden bg-surface-2">
          <CoverImage src={view.coverUrl} category={view.category ?? undefined} seed={view.slug} priority />
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
              {cat && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-accent-text">
                  <CategoryIcon icon={cat.icon} size={13} /> {cat.plural}
                </span>
              )}
              {region && <span className="rounded-full border border-line px-2.5 py-1 text-fg-2">{region.short}</span>}
              {view.isPrivate && (
                <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-fg-2">
                  <Lock size={12} /> Yopiq jamoa
                </span>
              )}
            </div>
            <h1 className="display-xl mt-3 text-[28px] text-fg sm:text-[36px]">{view.name}</h1>
            {view.description && <p className="mt-2 line-clamp-3 max-w-2xl text-[14.5px] leading-relaxed text-fg-2">{view.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-3">
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} /> {view.membersCount} a&apos;zo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquareText size={14} /> {view.postsCount} post
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={view.owner.name} src={view.owner.avatarUrl} size={20} decorative />
                {view.owner.slug ? (
                  <Link href={`/mutaxassislar/${view.owner.slug}`} className="font-semibold text-fg-2 underline-offset-2 hover:underline">
                    {view.owner.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-fg-2">{view.owner.name}</span>
                )}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {view.canManage && (
              <Link
                href={`/jamoalar/${view.slug}/sozlash`}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[14px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
              >
                <Settings2 size={16} /> Sozlash
                {view.pendingCount > 0 && <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-white">{view.pendingCount}</span>}
              </Link>
            )}
            {/* Egasi uchun JoinButton ham "Sozlash" beradi — ikki marta chiqmasin */}
            {view.membership !== "owner" && <JoinButton slug={view.slug} membership={view.membership} isPrivate={view.isPrivate} loggedIn={loggedIn} />}
          </div>
        </div>
      </section>

      {/* Bo'limlar */}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Jamoa bo'limlari">
        {TABS.map((t) => {
          const active = t.key === tab;
          const count = t.key === "azolar" ? view.membersCount : t.key === "lenta" ? view.postsCount : null;
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={active ? "page" : undefined}
              className={cn("relative inline-flex h-11 shrink-0 items-center gap-1.5 px-3.5 text-[14px] font-semibold transition", active ? "text-fg" : "text-fg-3 hover:text-fg")}
            >
              {t.label}
              {count !== null && <span className="text-[12px] text-fg-4">{count}</span>}
              {t.key === "azolar" && view.canManage && view.pendingCount > 0 && <span className="h-2 w-2 rounded-full bg-accent" aria-label={`${view.pendingCount} ta so'rov`} />}
              {active && <span aria-hidden className="absolute inset-x-3.5 bottom-0 h-[3px] rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {tab === "lenta" &&
            (feed ? <GroupFeed slug={view.slug} canPost={isMember} loggedIn={loggedIn} initial={feed} highlightId={highlight} /> : <LockedNotice view={view} loggedIn={loggedIn} what="Lenta" />)}
          {tab === "chat" && (isMember ? <GroupChat slug={view.slug} membersCount={view.membersCount} /> : <LockedNotice view={view} loggedIn={loggedIn} what="Chat" />)}
          {tab === "azolar" &&
            (members ? (
              <GroupMembers slug={view.slug} canManage={view.canManage} isOwner={view.membership === "owner"} viewerId={user?.id ?? null} initialActive={members[0]} initialPending={members[1]} />
            ) : (
              <LockedNotice view={view} loggedIn={loggedIn} what="A'zolar ro'yxati" />
            ))}
          {tab === "haqida" && <AboutCard view={view} full />}
        </div>
        {tab !== "haqida" && (
          <aside className="hidden lg:col-span-4 lg:block">
            <AboutCard view={view} />
          </aside>
        )}
      </div>
    </div>
  );
}

function AboutCard({ view, full = false }: { view: GroupView; full?: boolean }) {
  const cat = view.category ? CATEGORY_BY_SLUG[view.category] : null;
  const region = view.region ? REGION_BY_SLUG[view.region] : null;
  return (
    <div className="grid gap-4">
      <section className="card p-5">
        <h2 className="text-[15px] font-bold text-fg">Jamoa haqida</h2>
        <p className={cn("mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-fg-2", !full && "line-clamp-6")}>{view.description || "Tavsif hali yozilmagan."}</p>
        <dl className="mt-4 grid gap-2 text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-3">Yo&apos;nalish</dt>
            <dd className="font-semibold text-fg">{cat?.plural ?? "Umumiy"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-3">Hudud</dt>
            <dd className="font-semibold text-fg">{region?.name ?? "Butun O'zbekiston"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-fg-3">Turi</dt>
            <dd className="font-semibold text-fg">{view.isPrivate ? "Yopiq — so'rov bilan" : "Ochiq"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-fg-3">
              <CalendarDays size={13} /> Yaratilgan
            </dt>
            <dd className="font-semibold text-fg">{formatDateTime(view.createdAt)}</dd>
          </div>
        </dl>
      </section>
      <section className="card p-5">
        <h2 className="text-[15px] font-bold text-fg">Egasi</h2>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={view.owner.name} src={view.owner.avatarUrl} size={40} decorative />
          <div className="min-w-0">
            {view.owner.slug ? (
              <Link href={`/mutaxassislar/${view.owner.slug}`} className="block truncate text-[14px] font-semibold text-fg underline-offset-2 hover:underline">
                {view.owner.name}
              </Link>
            ) : (
              <p className="truncate text-[14px] font-semibold text-fg">{view.owner.name}</p>
            )}
            <p className="text-[12px] text-fg-3">{view.owner.slug ? "Mutaxassis profili" : "Foydalanuvchi"}</p>
          </div>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="text-[15px] font-bold text-fg">Qoidalar</h2>
        <ul className="mt-2 grid gap-1.5 text-[13px] leading-relaxed text-fg-2">
          <li>• Hurmat — tanqid ishga, odamga emas.</li>
          <li>• Spam va takroriy reklama yo&apos;q; e&apos;lonlar — egasi ruxsati bilan.</li>
          <li>• Mijoz kontaktlari va shaxsiy ma&apos;lumotlar tarqatilmaydi.</li>
          <li>• Buzilsa — moderatorlar postni o&apos;chiradi, takrorlansa a&apos;zolikdan chiqariladi.</li>
        </ul>
      </section>
    </div>
  );
}
