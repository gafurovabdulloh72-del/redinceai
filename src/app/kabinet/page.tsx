import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  Eye,
  Heart,
  Inbox,
  Megaphone,
  MessageCircle,
  PenSquare,
  RadioTower,
  Send,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { ActivityFeed } from "@/components/kabinet/ActivityFeed";
import { BANNER_DAYS, SubscriptionBanner } from "@/components/subscription/SubscriptionBanner";
import { Avatar, Badge, ButtonLink, IconTile, VerifiedBadge } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { unreadDmCount } from "@/lib/chat/dm";
import { db } from "@/lib/db";
import { applications, favorites, follows, groupMembers, groups, jobs, notifications, orders, portfolioItems, posts, proposals, vacancies } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, PROPOSAL_DAILY_LIMIT, type OrderStatus } from "@/lib/constants";
import { proposalsSentToday } from "@/lib/jobs/server";
import { getSettings } from "@/lib/payments/settings";
import { isOnVacation, tashkentNow } from "@/lib/privacy";
import { getOrdersForUser } from "@/lib/queries";
import { subscriptionState, type SubscriptionState } from "@/lib/subscriptions/access";
import { cn, formatDate, formatDateTime, formatNumber, formatPrice, greetingFor, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Umumiy" };

/** Buyurtmalar sahifasi (OrdersList) bilan bir xil: yangi — coral, qabul qilindi — binafsha */
const STATUS_TONE: Record<OrderStatus, "accent" | "purple" | "warning" | "success" | "neutral"> = {
  new: "accent",
  accepted: "purple",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};

/** «Bugun» blokida muddati shu kun ichida (yoki o'tib ketgan) buyurtmalar */
const DUE_SOON_DAYS = 3;
/** «Bugun» blokida yaqin efirlar: shu kun ichida */
const EVENT_SOON_DAYS = 7;

/* ------------------------------------------------------------------ */
/* Kichik bo'laklar                                                    */
/* ------------------------------------------------------------------ */
function Tile({ value, label, href }: { icon?: LucideIcon; value: React.ReactNode; label: string; href?: string }) {
  const inner = (
    <>
      <div className="text-[12.5px] font-medium text-fg-3">{label}</div>
      <div className="mt-2 font-display text-[28px] font-semibold leading-none tracking-tight text-fg">{value}</div>
    </>
  );
  const cls = "card group block p-4";
  return href ? (
    <Link href={href} className={cn(cls, "card-hover")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function ProgressRing({ pct, size = 72, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Profil ${pct}% to'ldirilgan`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray var(--dur-3) var(--ease-out)" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--fg)" fontFamily="var(--font-display)">
        {pct}%
      </text>
    </svg>
  );
}

/** list-inset qatori: ikonka · yorliq · (qiymat) · chevron */
function Row({ href, icon: Icon, label, value, tone, external }: { href: string; icon: LucideIcon; label: string; value?: React.ReactNode; tone?: "warning" | "danger" | "success"; external?: boolean }) {
  const inner = (
    <>
      <Icon size={18} className="shrink-0 text-fg-3" aria-hidden="true" />
      {/* Yorliq kamida 55% joy oladi (qisqa yorliq hech qachon «T.» bo'lib qolmaydi); qiymat ko'pi bilan 45% va o'zi qisqaradi */}
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{label}</span>
      {value !== undefined && (
        <span className={cn("max-w-[45%] shrink-0 truncate text-right text-[13px] tabular-nums", tone === "warning" ? "font-semibold text-warning-text" : tone === "danger" ? "font-semibold text-danger-text" : tone === "success" ? "font-semibold text-success-text" : "text-fg-3")}>
          {value}
        </span>
      )}
      <ChevronRight size={16} className="shrink-0 text-fg-4" aria-hidden="true" />
    </>
  );
  const cls = "press flex min-h-12 items-center gap-3 px-4 py-2.5 transition hover:bg-fg/4";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

interface CheckItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
  hint?: string;
}

const SUB_LABEL: Record<SubscriptionState["status"], string> = { trial: "Sinov", active: "Faol", grace: "Imtiyozli muddat", expired: "Faol emas", off: "Talab qilinmaydi", exempt: "Imtiyozli" };

/* ------------------------------------------------------------------ */
/* Sahifa                                                              */
/* ------------------------------------------------------------------ */
export default async function KabinetPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet"));

  const sp = user.specialist;
  const now = new Date();
  const today = tashkentNow().date;
  const dueLimit = tashkentNow(Date.now() + DUE_SOON_DAYS * 86_400_000).date;

  const [{ asClient, asSpecialist }, portfolioCount, favCount, unreadNotif, unreadDm, followersCount, myGroupIds] = await Promise.all([
    getOrdersForUser(user.id, sp?.id),
    sp ? db.select({ n: count() }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id)).then((r) => r[0]?.n ?? 0) : Promise.resolve(0),
    db.select({ n: count() }).from(favorites).where(eq(favorites.userId, user.id)).then((r) => r[0]?.n ?? 0),
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))).then((r) => r[0]?.n ?? 0).catch(() => 0),
    unreadDmCount(user.id).catch(() => 0),
    db.select({ n: count() }).from(follows).where(eq(follows.followingId, user.id)).then((r) => r[0]?.n ?? 0).catch(() => 0),
    db.select({ id: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, user.id), eq(groupMembers.status, "active"))).then((r) => r.map((x) => x.id)).catch(() => [] as string[]),
  ]);

  /* ---------- «Bugun»: yaqin efirlar, muddati yaqin buyurtmalar, yangi arizalar ---------- */
  const [events, dueOrders, newApplications, settings, proposalStats, jobStats] = await Promise.all([
    myGroupIds.length
      ? db
          .select({ id: posts.id, body: posts.body, eventAt: posts.eventAt, groupSlug: groups.slug, groupName: groups.name })
          .from(posts)
          .innerJoin(groups, eq(groups.id, posts.groupId))
          .where(and(inArray(posts.groupId, myGroupIds), gte(posts.eventAt, now), lte(posts.eventAt, new Date(now.getTime() + EVENT_SOON_DAYS * 86_400_000))))
          .orderBy(posts.eventAt)
          .limit(3)
          .catch(() => [])
      : Promise.resolve([]),
    db
      .select({ id: orders.id, title: orders.title, dueDate: orders.dueDate, deadline: orders.deadline, specialistId: orders.specialistId })
      .from(orders)
      .where(and(sp ? or(eq(orders.clientId, user.id), eq(orders.specialistId, sp.id)) : eq(orders.clientId, user.id), inArray(orders.status, ["accepted", "in_progress"]), lte(orders.dueDate, dueLimit)))
      .orderBy(orders.dueDate)
      .limit(3)
      .catch(() => []),
    db
      .select({ n: count() })
      .from(applications)
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .where(and(eq(vacancies.authorId, user.id), eq(vacancies.status, "open"), eq(applications.status, "new")))
      .then((r) => r[0]?.n ?? 0)
      .catch(() => 0),
    sp ? getSettings() : Promise.resolve(null),
    sp
      ? Promise.all([proposalsSentToday(sp.id), db.select({ status: proposals.status, n: count() }).from(proposals).where(eq(proposals.specialistId, sp.id)).groupBy(proposals.status)])
          .then(([today, rows]) => ({ today, by: Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number> }))
          .catch(() => null)
      : Promise.resolve(null),
    user.role === "client"
      ? Promise.all([
          db.select({ n: count() }).from(jobs).where(and(eq(jobs.clientId, user.id), eq(jobs.status, "open"))),
          db
            .select({ n: count() })
            .from(proposals)
            .innerJoin(jobs, eq(proposals.jobId, jobs.id))
            .where(and(eq(jobs.clientId, user.id), eq(jobs.status, "open"), eq(proposals.status, "pending"))),
        ])
          .then(([[o], [p]]) => ({ open: o?.n ?? 0, newProposals: p?.n ?? 0 }))
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const subState = sp && settings ? subscriptionState(sp, settings) : null;
  const firstName = user.name.split(" ")[0] || user.name;

  /* ---------- Statistika (faqat real raqamlar) ---------- */
  const newIncoming = asSpecialist.filter((o) => o.status === "new").length;
  const activeIncoming = asSpecialist.filter((o) => o.status === "accepted" || o.status === "in_progress").length;
  const doneIncoming = asSpecialist.filter((o) => o.status === "done").length;
  const sent = asClient.length;
  const inProgress = asClient.filter((o) => o.status === "accepted" || o.status === "in_progress").length;
  const doneOutgoing = asClient.filter((o) => o.status === "done").length;
  const partners = new Set(asClient.map((o) => o.specialistId)).size;

  /* ---------- Profil to'liqligi (mutaxassis) ---------- */
  const needsProfile = !sp && user.role === "specialist";
  const checklist: CheckItem[] = sp
    ? [
        { key: "title", label: "Haqiqiy sarlavha", done: sp.title.trim().length >= 5 && !/yangi mutaxassis$/i.test(sp.title.trim()), href: "/kabinet/profil#mutaxassis", hint: "Masalan: To'y videografi · Sony FX3" },
        { key: "bio", label: "O'zingiz haqingizda (bio)", done: sp.bio.trim().length >= 80, href: "/kabinet/profil#mutaxassis", hint: "Kamida 80 ta belgi" },
        { key: "price", label: "Narx belgilangan", done: sp.priceFrom > 0, href: "/kabinet/profil#mutaxassis" },
        { key: "skills", label: "Kamida 3 ta ko'nikma", done: sp.skills.length >= 3, href: "/kabinet/profil#mutaxassis" },
        { key: "photo", label: "Muqova yoki avatar rasmi", done: Boolean(sp.coverUrl || user.avatarUrl), href: "/kabinet/profil" },
        { key: "portfolio", label: "Portfolioda kamida 3 ta ish", done: portfolioCount >= 3, href: "/kabinet/portfolio", hint: `Hozir: ${portfolioCount} ta` },
        { key: "schedule", label: "Ish vaqti kiritilgan", done: Boolean(sp.schedule && Object.values(sp.schedule.days ?? {}).some((d) => d?.enabled)), href: "/kabinet/profil#ish-vaqti" },
        { key: "contact", label: "Aloqa: Telegram yoki Instagram", done: Boolean(sp.telegram || sp.instagram), href: "/kabinet/profil#mutaxassis" },
      ]
    : [];
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;
  const onVacation = Boolean(sp && isOnVacation(sp.vacationUntil));
  const showOnboarding = Boolean(sp && pct < 100);

  /* ---------- So'nggi buyurtmalar (ikkala rol birgalikda) ---------- */
  const recent = [
    ...asSpecialist.map((o) => ({ id: o.id, title: o.title, status: o.status, budget: o.budget, amount: o.amount, createdAt: o.createdAt.getTime(), who: o.client.name, avatar: o.client.avatarUrl, kind: "incoming" as const })),
    ...asClient.map((o) => ({ id: o.id, title: o.title, status: o.status, budget: o.budget, amount: o.amount, createdAt: o.createdAt.getTime(), who: o.specialist.user.name, avatar: o.specialist.user.avatarUrl, kind: "outgoing" as const })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  /* ---------- Tezkor amallar: rolga ko'ra, 1 ta asosiy (accent) + kontur ---------- */

  /* ---------- «Bugun» qatorlari (faqat nol bo'lmaganlar) ---------- */
  const todayRows: Array<{ key: string; href: string; icon: LucideIcon; label: string; value: React.ReactNode; tone?: "warning" | "danger" | "success" }> = [];
  if (newIncoming > 0) todayRows.push({ key: "new", href: "/kabinet/buyurtmalar?tab=kelgan", icon: Inbox, label: "Yangi buyurtma", value: newIncoming, tone: "warning" });
  for (const o of dueOrders) {
    const overdue = o.dueDate ? o.dueDate < today : false;
    todayRows.push({ key: `due-${o.id}`, href: `/kabinet/buyurtmalar?id=${o.id}`, icon: CalendarClock, label: o.title.length > 48 ? `${o.title.slice(0, 48)}…` : o.title, value: o.dueDate ? (overdue ? "muddati o'tgan" : o.dueDate === today ? "bugun" : formatDate(o.dueDate)) : "", tone: overdue ? "danger" : "warning" });
  }
  for (const e of events) {
    todayRows.push({ key: `ev-${e.id}`, href: `/jamoalar/${e.groupSlug}?post=${e.id}`, icon: RadioTower, label: `Efir · ${e.groupName}`, value: e.eventAt ? formatDateTime(e.eventAt) : "" });
  }
  if (newApplications > 0) todayRows.push({ key: "apps", href: "/kabinet/vakansiyalar", icon: Briefcase, label: "Vakansiyaga yangi ariza", value: newApplications, tone: "warning" });
  if (jobStats && jobStats.newProposals > 0) todayRows.push({ key: "props", href: "/kabinet/elonlar", icon: Megaphone, label: "E'lonlaringizga yangi taklif", value: jobStats.newProposals, tone: "warning" });
  if (unreadDm > 0) todayRows.push({ key: "dm", href: "/kabinet/chat", icon: MessageCircle, label: "O'qilmagan xabar", value: unreadDm });
  if (unreadNotif > 0) todayRows.push({ key: "notif", href: "/kabinet/bildirishnomalar?filter=unread", icon: Bell, label: "O'qilmagan bildirishnoma", value: unreadNotif });


  return (
    <div className="animate-fade-up">
      {/* ---------- To'liq obuna banneri (G6/#74): faqat shu umumiy sahifada ---------- */}
      {subState && <SubscriptionBanner status={subState.status} until={subState.until} daysLeft={subState.daysLeft} graceUntil={subState.graceUntil} />}

      {/* ---------- Sarlavha ---------- */}
      <header className="mb-5 sm:mb-6">
        <span className="eyebrow">
          {greetingFor()} · {sp ? "Mutaxassis" : user.role === "admin" ? "Administrator" : "Mijoz"}
        </span>
        <h1 className="display-xl mt-3 text-fg">
          Salom, <span className="accent-serif">{firstName}</span>
        </h1>
      </header>

      {/* ---------- Bugun ---------- */}
      <section className="card m-flat mb-5" aria-labelledby="today-title">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <h2 id="today-title" className="font-display text-[17px] font-semibold text-fg">
            Bugun
          </h2>
          <span className="text-[12px] text-fg-4" suppressHydrationWarning>
            {formatDate(Date.now())}
          </span>
        </div>
        {todayRows.length === 0 ? (
          <p className="flex items-center gap-2 border-t border-line px-4 py-4 text-[13px] text-fg-3 sm:px-5">
            <CheckCircle2 size={16} className="text-success" aria-hidden="true" /> Hammasi tinch — yangi buyurtma, muddat yoki xabar yo&apos;q.
          </p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {todayRows.map((r) => (
              <li key={r.key}>
                <Row href={r.href} icon={r.icon} label={r.label} value={r.value} tone={r.tone} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Profil yaratish (mutaxassis roli, profil yo'q) ---------- */}
      {needsProfile && (
        <section className="card mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <ProgressRing pct={0} />
            <div>
              <p className="font-display text-[17px] font-semibold leading-tight text-fg">Mutaxassis profilingizni yarating</p>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-fg-2">Yo&apos;nalish, hudud, narx va ko&apos;nikmalar — profil xaritada paydo bo&apos;ladi.</p>
            </div>
          </div>
          <ButtonLink href="/kabinet/profil#mutaxassis" variant="accent" className="shrink-0">
            Profilni yaratish <ArrowRight size={15} />
          </ButtonLink>
        </section>
      )}

      {/* ---------- Statistika plitkalari ---------- */}
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*]:animate-fade-up">
        {sp ? (
          <>
            <Tile icon={Eye} value={formatNumber(sp.viewCount)} label="Profil ko'rishlar" href={`/mutaxassislar/${sp.slug}`} />
            <Tile
              icon={Star}
              value={sp.rating > 0 ? sp.rating.toFixed(1) : <span className="text-[18px] font-medium text-fg-3 sm:text-[20px]">Hali yo&apos;q</span>}
              label={sp.reviewCount > 0 ? `Reyting · ${sp.reviewCount} ta sharh` : "Reyting"}
              href={sp.reviewCount > 0 ? `/mutaxassislar/${sp.slug}#sharhlar` : undefined}
            />
            <Tile icon={UsersRound} value={followersCount} label="Obunachilar" href="/kabinet/obunalar" />
            <Tile icon={ClipboardList} value={activeIncoming} label={`Jarayonda · ${doneIncoming} bajarilgan`} href="/kabinet/buyurtmalar?tab=kelgan" />
          </>
        ) : (
          <>
            <Tile icon={Send} value={sent} label="Yuborilgan buyurtmalar" href="/kabinet/buyurtmalar" />
            <Tile icon={Clock3} value={inProgress} label="Jarayonda" href="/kabinet/buyurtmalar" />
            <Tile icon={CheckCircle2} value={doneOutgoing} label="Bajarilgan" href="/kabinet/buyurtmalar" />
            <Tile icon={Users} value={partners} label="Ishlagan mutaxassislar" href="/kabinet/mutaxassislarim" />
          </>
        )}
      </div>

      {/* ---------- Profil to'liqligi (mutaxassis, 100% bo'lmaguncha) ---------- */}
      {showOnboarding && sp && (
        <section className="card mt-5 p-5" aria-labelledby="onb-title">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex items-start gap-4 sm:w-[280px] sm:shrink-0">
              <ProgressRing pct={pct} />
              <div className="min-w-0">
                <h2 id="onb-title" className="font-display text-[17px] font-semibold leading-tight text-fg">
                  {pct < 50 ? "Profilni to'ldiring" : "Yana ozgina qoldi"}
                </h2>
                <p className="mt-1 text-[13px] leading-snug text-fg-2">
                  {doneCount}/{checklist.length} bajarildi · {sp.isVerified ? "tasdiqlangan" : "tasdiq kutilmoqda"}
                </p>
              </div>
            </div>
            <ul className="grid min-w-0 flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
              {checklist.map((c) => (
                <li key={c.key}>
                  {c.done ? (
                    <span className="flex min-h-10 items-center gap-2.5 rounded-[10px] px-2 text-[13px] text-fg-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-text">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="line-through decoration-line-2">{c.label}</span>
                    </span>
                  ) : (
                    <Link href={c.href} className="press group flex min-h-10 items-center gap-2.5 rounded-[10px] px-2 text-[13px] font-medium text-fg transition hover:bg-fg/4">
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-line-2 transition group-hover:border-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{c.label}</span>
                        {c.hint && <span className="block truncate text-[11px] font-normal text-fg-4">{c.hint}</span>}
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-fg-4 transition group-hover:translate-x-0.5 group-hover:text-fg" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        {/* ---------- Chap: so'nggi buyurtmalar + faollik ---------- */}
        <div className="space-y-5 lg:col-span-2">
          <section className="card m-flat" aria-labelledby="recent-title">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <h2 id="recent-title" className="font-display text-[17px] font-semibold text-fg">
                  So&apos;nggi buyurtmalar
                </h2>
                <p className="text-[12px] text-fg-3">
                  {sp && asSpecialist.length > 0 ? `${activeIncoming} ta jarayonda · ${doneIncoming} ta bajarilgan` : asClient.length > 0 ? `${inProgress} ta jarayonda · ${doneOutgoing} ta bajarilgan` : "Hozircha bo'sh"}
                </p>
              </div>
              {recent.length > 0 && (
                <Link href="/kabinet/buyurtmalar" className="text-[13px] font-semibold text-fg-2 underline-offset-2 hover:underline">
                  Barchasi
                </Link>
              )}
            </div>

            {recent.length === 0 ? (
              <div className="flex flex-col items-center border-t border-line px-6 pb-7 pt-6 text-center">
                <IconTile icon={Inbox} tone="soft" size="lg" className="mb-3" />
                <p className="font-display text-[15px] font-semibold text-fg">{sp ? "Hali buyurtmalar kelmagan" : "Hali buyurtma bermagansiz"}</p>
                <p className="mt-1 max-w-xs text-[13px] text-fg-3">{sp ? "Profil va portfolioni to'ldiring — mijozlar sizni tezroq topadi." : "Xaritadan mutaxassis tanlang va loyihangizni yuboring."}</p>
                {!sp && (
                  <ButtonLink href="/xarita" variant="outline" size="sm" className="mt-4">
                    Xaritani ochish <ArrowRight size={14} />
                  </ButtonLink>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link href={`/kabinet/buyurtmalar?id=${o.id}`} className="press flex min-h-14 items-center gap-3 px-5 py-3 transition hover:bg-fg/4">
                      <Avatar name={o.who} src={o.avatar} size={38} decorative />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-fg">{o.title}</p>
                        <p className="truncate text-[12px] text-fg-3">
                          {o.kind === "incoming" ? "Mijoz: " : "Mutaxassis: "}
                          {o.who}
                          {o.amount ? ` · ${formatPrice(o.amount, { compact: true })}` : o.budget ? ` · byudjet ${formatPrice(o.budget, { compact: true })}` : ""}
                          {" · "}
                          <time dateTime={new Date(o.createdAt).toISOString()}>{timeAgo(o.createdAt)}</time>
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[o.status]} className="shrink-0">
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ActivityFeed userId={user.id} specialist={sp ? { id: sp.id, slug: sp.slug } : null} />
        </div>

        {/* ---------- O'ng ustun: profil + tezkor amallar + bo'limlar ---------- */}
        <div className="space-y-5">
          <section className="card m-flat p-4" aria-labelledby="profile-card-title">
            <h2 id="profile-card-title" className="sr-only">
              Profil
            </h2>
            <div className="flex items-center gap-3">
              <Avatar name={user.name} src={user.avatarUrl} size={40} decorative />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[14.5px] font-semibold text-fg">
                  <span className="truncate">{user.name}</span>
                  {sp?.isVerified && <VerifiedBadge size={15} />}
                </p>
                <p className="truncate text-[12.5px] text-fg-3">{sp ? sp.title : user.email}</p>
              </div>
              {sp && (user.isPaused ? <Badge tone="warning">Pauzada</Badge> : onVacation ? <Badge tone="warning">Ta&apos;tilda</Badge> : sp.isAvailable ? <Badge tone="success">Bo&apos;sh</Badge> : <Badge tone="warning">Band</Badge>)}
            </div>
          </section>

          {/* Bo'limlar: obuna / takliflar (mutaxassis), e'lonlar / sevimlilar (mijoz) — bitta inset ro'yxat */}
          <ul className="list-inset m-flat">
            {sp && subState && subState.status !== "off" && (
              <li>
                <Row
                  href="/kabinet/obuna"
                  icon={CreditCard}
                  label="Obuna"
                  value={subState.status === "expired" ? SUB_LABEL.expired : subState.status === "exempt" ? SUB_LABEL.exempt : `${SUB_LABEL[subState.status]} · ${subState.daysLeft} kun`}
                  tone={subState.status === "expired" ? "danger" : subState.status === "grace" || subState.daysLeft <= BANNER_DAYS ? "warning" : undefined}
                />
              </li>
            )}
            {sp && proposalStats && (
              <li>
                <Row href="/kabinet/takliflar" icon={Send} label="Takliflar" value={`${Math.min(proposalStats.today, PROPOSAL_DAILY_LIMIT)}/${PROPOSAL_DAILY_LIMIT} bugun · ${(proposalStats.by.pending ?? 0) + (proposalStats.by.shortlisted ?? 0)} kutilmoqda`} />
              </li>
            )}
            {jobStats && (
              <li>
                <Row href="/kabinet/elonlar" icon={Megaphone} label="E'lonlarim" value={`${jobStats.open} ochiq`} />
              </li>
            )}
            {(!sp || favCount > 0) && (
              <li>
                <Row href={favCount > 0 ? "/kabinet/sevimlilar" : "/mutaxassislar"} icon={Heart} label="Sevimlilar" value={favCount > 0 ? favCount : "Mutaxassis tanlang"} />
              </li>
            )}
            <li>{sp ? <Row href="/kabinet/postlar" icon={PenSquare} label="Postlarim" /> : <Row href="/kabinet/saqlanganlar" icon={PenSquare} label="Saqlangan postlar" />}</li>
          </ul>

          {/* Mijoz uchun maslahat */}
          {!sp && user.role === "client" && (
            <section className="card p-5">
              <p className="font-display text-[15px] font-semibold text-fg">Siz ijodkormisiz?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">Portfolio joylang, narx belgilang — buyurtmalar kabinetingizga keladi.</p>
              <ButtonLink href="/kabinet/profil#mutaxassis" variant="outline" size="md" className="mt-4 w-full">
                Mutaxassis bo&apos;lish <ArrowRight size={14} />
              </ButtonLink>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
