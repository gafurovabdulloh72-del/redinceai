import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users as usersTable } from "@/lib/db/schema";
import { AdminSectionHeading, QueueChip } from "@/components/admin/AdminSectionHeading";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import { AdminModeration } from "@/components/admin/AdminModeration";
import { AdminMentors } from "@/components/admin/AdminMentors";
import { AdminEvents } from "@/components/admin/AdminEvents";
import { AdminHealthCard } from "@/components/admin/AdminHealthCard";
import { SpamFilterPanel } from "@/components/admin/SpamFilterPanel";
import { DemoCleanButton } from "@/components/admin/DemoCleanButton";
import { PaymentProvidersPanel } from "@/components/admin/PaymentProvidersPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { AdminBroadcast } from "@/components/admin/AdminBroadcast";
import { TelegramAdminPanel } from "@/components/admin/TelegramAdminPanel";
import { R2AdminPanel } from "@/components/admin/R2AdminPanel";
import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  CreditCard,
  Crown,
  GraduationCap,
  Flag,
  HeartPulse,
  Hourglass,
  Landmark,
  MapPinned,
  MessageSquareText,
  Receipt,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminDisputes, type AdminDisputeRow } from "@/components/admin/AdminDisputes";
import { AdminFraudSignals } from "@/components/admin/AdminFraudSignals";
import { AdminPaymentsTable, type AdminPaymentRow } from "@/components/admin/AdminPaymentsTable";
import { AdminPayoutsQueue, type AdminPayoutRow } from "@/components/admin/AdminPayoutsQueue";
import { AdminReports } from "@/components/admin/AdminReports";
import { AdminReviews, type AdminReviewRow } from "@/components/admin/AdminReviews";
import { AdminSpecialistsTable, type PendingSpecialist } from "@/components/admin/AdminSpecialistsTable";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { Avatar, Badge, ButtonLink, type BadgeTone } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { ORDER_STATUS_LABEL, REGIONS, type OrderStatus } from "@/lib/constants";
import { listOpenDisputes } from "@/lib/payments/disputes";
import { getAdminFinance, listAdminPayments, listAdminPayouts } from "@/lib/payments/queries";
import { getSettings } from "@/lib/payments/settings";
import { getAdminOverview } from "@/lib/queries";
import { getSubscriptionRevenueSummary } from "@/lib/subscriptions/queries";
import { cn, formatPrice, timeAgo } from "@/lib/utils";
import { getAdminAnalytics } from "./analytics";
import { getFraudSignals } from "./fraud";
import { banFlagsFor, listAdminReports, listAdminReviews, listPendingSpecialists, listRecentVerified, listSettingsHistory } from "./queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin panel",
  robots: { index: false, follow: false },
};

type Role = "client" | "specialist" | "admin";
const ROLE_LABEL: Record<Role, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Administrator" };
const ROLE_TONE: Record<Role, BadgeTone> = { client: "neutral", specialist: "accent", admin: "ink" };

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  new: "accent",
  accepted: "purple",
  in_progress: "warning",
  done: "success",
  cancelled: "neutral",
};

/**
 * Statistika plitkasi — yassi karta, hairline, soyasiz. Hamma plitka havola (burchak strelkasi hammasida bir xil):
 * ikonka plitkasi yo'q — yorliq tepada, qiymat 22–24px, ixtiyoriy izoh.
 */
function Tile({ icon: Icon, value, label, hint, hintTone = "neutral", href }: { icon: LucideIcon; value: React.ReactNode; label: string; hint?: string; hintTone?: "neutral" | "warning" | "success"; href: string }) {
  return (
    <Link href={href} className="card card-hover group block min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-fg-3">
          <Icon size={14} className="shrink-0 text-fg-4" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
        <ArrowUpRight size={14} className="shrink-0 text-fg-4 transition group-hover:text-fg" aria-hidden="true" />
      </div>
      <div className="mt-2.5 font-display text-[22px] font-semibold leading-none tracking-tight text-fg tabular-nums sm:text-[24px]">{value}</div>
      {hint && <div className={cn("mt-1.5 truncate text-[12px] font-medium", hintTone === "warning" ? "text-warning-text" : hintTone === "success" ? "text-success-text" : "text-fg-4")}>{hint}</div>}
    </Link>
  );
}

/** Pul — ixcham (mln/ming) ko'rinish: plitkada ikki qatorga tushmasin */
const money = (n: number) => formatPrice(n, { compact: n >= 1_000_000 });

/** Ro'yxat chegaralari — jadval ostidagi "Oxirgi N tasi ko'rsatilgan" izohi uchun */
const PAYMENTS_CAP = 60;
const REVIEWS_CAP = 30;

/** Bo'lim o'rami: bir xil vertikal ritm va langar siljishi (telefonda tepadagi panel 56px, desktopda panel yo'q) */
const SECTION = "mt-10 scroll-mt-20 sm:mt-12 md:scroll-mt-6";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin"));
  if (user.role !== "admin") redirect("/kabinet");

  // Tasdiqlash navbati listPendingSpecialists'dan keladi (eng eskisi birinchi, 200 tagacha, avatar + portfolio soni bilan)
  const [{ stats, latestUsers, latestOrders }, pending, recentVerified, finance, payouts, payments, settings, disputes, reviewsLatest, reports, analytics, fraud, settingsHistory, subRevenue] = await Promise.all([
    getAdminOverview(),
    listPendingSpecialists(200),
    listRecentVerified(30),
    getAdminFinance(),
    listAdminPayouts(),
    listAdminPayments(PAYMENTS_CAP),
    getSettings(),
    listOpenDisputes(),
    listAdminReviews(REVIEWS_CAP),
    listAdminReports("all", 60),
    getAdminAnalytics(),
    getFraudSignals(),
    listSettingsHistory(12),
    getSubscriptionRevenueSummary(),
  ]);
  const bans = await banFlagsFor(pending.map((sp) => sp.userId));
  // Demo (seed) yozuvlari soni — tozalash tugmasi faqat ular borida ko'rinadi
  const [{ n: demoCount }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(usersTable)
    .where(and(like(usersTable.id, "seed-%"), or(ne(usersTable.role, "admin"), like(usersTable.email, "%@redince.uz")), ne(usersTable.id, user.id)));

  // Mijoz komponentga faqat seriyalanadigan ma'lumot beramiz (sanalar — ms)
  const pendingRows: PendingSpecialist[] = pending.map((sp) => ({
    id: sp.id,
    slug: sp.slug,
    title: sp.title,
    category: sp.category,
    regionSlug: sp.regionSlug,
    city: sp.city,
    isVerified: sp.isVerified,
    isFeatured: sp.isFeatured,
    isHidden: sp.isHidden,
    createdAt: sp.createdAt.getTime(),
    user: { name: sp.user.name, email: sp.user.email, phone: sp.user.phone, avatarUrl: sp.user.avatarUrl },
    userId: sp.userId,
    bio: sp.bio,
    portfolioCount: Number(sp.portfolioCount ?? 0),
    isBanned: bans.get(sp.userId)?.isBanned ?? false,
    bannedReason: bans.get(sp.userId)?.bannedReason ?? null,
  }));

  const disputeRows: AdminDisputeRow[] = disputes.map((o) => ({
    orderId: o.id,
    title: o.title,
    status: o.status,
    amount: o.amount,
    commissionPct: o.commissionPct,
    reason: o.disputeReason ?? "",
    by: o.disputeOpenedBy === o.clientId ? "client" : "specialist",
    // updatedAt — bu nizo ochilgan vaqt emas, buyurtmadagi so'nggi faollik (UI "So'nggi faollik" deb ko'rsatadi)
    openedAt: o.updatedAt.getTime(),
    client: { name: o.client.name, email: o.client.email },
    specialist: { name: o.specialist.user.name, email: o.specialist.user.email, slug: o.specialist.slug },
  }));

  const reviewRows: AdminReviewRow[] = reviewsLatest.map((r) => ({
    id: r.id,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt.getTime(),
    author: { name: r.author.name, email: r.author.email },
    specialist: { slug: r.specialist.slug, name: r.specialist.user.name },
  }));
  const openReports = reports.filter((r) => r.status === "open").length;

  const payoutRows: AdminPayoutRow[] = payouts.map((p) => ({
    id: p.id,
    amount: p.amount,
    state: p.state,
    method: p.method,
    details: p.details,
    note: p.note,
    createdAt: p.createdAt.getTime(),
    processedAt: p.processedAt?.getTime() ?? null,
    releasedBalance: p.releasedBalance,
    specialist: { id: p.specialist.id, slug: p.specialist.slug, title: p.specialist.title, name: p.specialist.user.name, email: p.specialist.user.email, phone: p.specialist.user.phone },
  }));

  const paymentRows: AdminPaymentRow[] = payments.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    orderTitle: p.order.title,
    provider: p.provider,
    state: p.state,
    amount: p.amount,
    commissionPct: p.commissionPct,
    commissionAmount: p.commissionAmount,
    netAmount: p.netAmount,
    providerTxnId: p.providerTxnId,
    createdAt: p.createdAt.getTime(),
    paidAt: p.paidAt?.getTime() ?? null,
    releasedAt: p.releasedAt?.getTime() ?? null,
    client: { name: p.client.name, email: p.client.email },
    specialist: { id: p.specialist.id, slug: p.specialist.slug, name: p.specialist.user.name },
  }));

  const users = latestUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.getTime(),
    isBanned: u.isBanned,
  }));

  const orders = latestOrders.map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status as OrderStatus,
    budget: o.budget,
    amount: o.amount,
    createdAt: o.createdAt.getTime(),
    client: o.client.name,
    specialist: o.specialist.user.name,
    specialistSlug: o.specialist.slug,
  }));

  const lastOrderAt = orders[0]?.createdAt;
  const openPayouts = payoutRows.filter((p) => p.state === "requested" || p.state === "approved").length;

  // Chiplar sahifadagi tartib bilan bir xil: amal navbatlari birinchi
  const sections = [
    { href: "#tasdiqlash", label: "Tasdiqlash", icon: UserCheck, count: pendingRows.length },
    { href: "#nizolar", label: "Nizolar", icon: Scale, count: disputeRows.length },
    { href: "#payoutlar", label: "Payoutlar", icon: Banknote, count: openPayouts },
    { href: "#shikoyatlar", label: "Shikoyatlar", icon: Flag, count: openReports },
    { href: "#moderatsiya", label: "Moderatsiya", icon: UsersRound },
    { href: "#tolovlar", label: "To'lovlar", icon: Receipt, count: finance.manualPending },
    { href: "#moliya", label: "Moliya", icon: Wallet },
    { href: "#analitika", label: "Analitika", icon: ChartColumn },
    { href: "#shubhali", label: "Shubhali faollik", icon: ShieldAlert, count: fraud.total },
    { href: "#sharhlar", label: "Sharhlar", icon: MessageSquareText },
    { href: "#efirlar", label: "Efirlar", icon: CalendarDays },
    { href: "#tizim", label: "Tizim", icon: HeartPulse },
    { href: "#sozlamalar", label: "Sozlamalar", icon: SlidersHorizontal },
  ];

  /** O'ng paneldagi bo'limlar — sahifadagi section'lar bilan BIR XIL tartibda; navbat badge'lari bilan */
  const navItems = [
    { id: "tasdiqlash", label: "Tasdiqlash", badge: pendingRows.length },
    { id: "nizolar", label: "Nizolar", badge: disputeRows.length },
    { id: "payoutlar", label: "Payoutlar", badge: openPayouts },
    { id: "shikoyatlar", label: "Shikoyatlar", badge: openReports },
    { id: "moderatsiya", label: "Moderatsiya" },
    { id: "mentorlar", label: "Mentorlik" },
    { id: "tolovlar", label: "To'lovlar", badge: finance.manualPending },
    { id: "moliya", label: "Moliya" },
    { id: "analitika", label: "Analitika" },
    { id: "shubhali", label: "Shubhali faollik" },
    { id: "sharhlar", label: "Sharhlar" },
    { id: "efirlar", label: "Efirlar" },
    { id: "foydalanuvchilar", label: "Foydalanuvchilar" },
    { id: "xabar", label: "Ommaviy xabar" },
    { id: "telegram-bot", label: "Telegram bot" },
    { id: "r2-saqlash", label: "Fayl saqlash" },
    { id: "faollik", label: "So'nggi faollik" },
    { id: "tizim", label: "Tizim holati" },
    { id: "tolov-sozlamalari", label: "To'lov tizimlari" },
    { id: "sozlamalar", label: "Sozlamalar" },
  ];

  return (
    <div className="container-x animate-fade-up xl:grid xl:grid-cols-[minmax(0,1fr)_190px] xl:gap-10">
      <div className="min-w-0">
        {/* ---------- Sarlavha: boshqaruv vositasi uchun tinch o'lchamlar (h1 26/30px) ---------- */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">
              <ShieldCheck size={12} aria-hidden="true" /> Admin panel
            </p>
            <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">Boshqaruv markazi</h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">Navbatlar, moliya, foydalanuvchilar va sozlamalar — bir joyda.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[55%] sm:justify-end">
            <ButtonLink href="/admin/obunalar" variant="outline" size="sm">
              <CreditCard size={14} /> Obunalar
              {subRevenue.pendingManual > 0 && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-accent-text">{subRevenue.pendingManual}</span>}
            </ButtonLink>
            <ButtonLink href="/admin/mentorlik" variant="outline" size="sm">
              <GraduationCap size={14} /> Mentorlik
            </ButtonLink>
            <ButtonLink href="/admin/reyting" variant="outline" size="sm">
              <Crown size={14} /> TOP reyting
            </ButtonLink>
            <ButtonLink href="/admin/audit" variant="outline" size="sm">
              <ScrollText size={14} /> Audit jurnali
            </ButtonLink>
            <ButtonLink href="/kabinet" variant="outline" size="sm">
              Kabinet <ArrowRight size={14} />
            </ButtonLink>
            <DemoCleanButton count={demoCount} />
          </div>
        </header>

        {/* Bo'limlarga tez o'tish — keng ekranda o'ngdagi doimiy navigatsiya bor, chiplar takror bo'lmasin */}
        <nav aria-label="Bo'limlar" className="no-scrollbar -mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0 xl:hidden">
          <ul className="flex w-max gap-1.5">
            {sections.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                  <s.icon size={14} className="text-fg-3" /> {s.label}
                  {s.count ? <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-accent-text">{s.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ---------- Statistika: 4 ta plitka, hammasi havola ---------- */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Profili to'ldirilgan mutaxassislar sanaladi — rol "mutaxassis" bo'lib profil yaratmaganlar kirmaydi */}
          <Tile icon={Users} value={stats.specialists} label="Mutaxassis profillari" hint={pending.length > 0 ? `${pending.length} ta tekshiruvda` : "Hammasi tasdiqlangan"} hintTone={pending.length > 0 ? "warning" : "success"} href="/mutaxassislar" />
          <Tile icon={ClipboardList} value={stats.orders} label="Buyurtmalar" hint={lastOrderAt ? `Oxirgisi ${timeAgo(lastOrderAt)}` : undefined} href="#faollik" />
          <Tile icon={MessageSquareText} value={stats.reviews} label="Sharhlar" href="#sharhlar" />
          <Tile
            icon={MapPinned}
            value={
              <>
                {stats.regions}
                <span className="text-[15px] text-fg-3">/{REGIONS.length}</span>
              </>
            }
            label="Hududlar qamrovi"
            href="/xarita"
          />
        </div>

        {/* ---------- Tasdiqlash navbati ---------- */}
        <section id="tasdiqlash" className={SECTION} aria-labelledby="h-tasdiqlash">
          <AdminSectionHeading
            title={<span id="h-tasdiqlash">Tasdiqlash navbati</span>}
            description="Eng uzoq kutganlar tepada. Tasdiqlangan profil katalogda belgi bilan chiqadi."
            action={<QueueChip n={pending.length} some={(n) => `${n} ta kutmoqda`} none="Navbat bo'sh" />}
          />
          <AdminSpecialistsTable
            pending={pendingRows}
            verified={recentVerified.map((sp) => ({
              id: sp.id,
              slug: sp.slug,
              title: sp.title,
              category: sp.category,
              regionSlug: sp.regionSlug,
              isFeatured: sp.isFeatured,
              verifiedAt: sp.updatedAt.getTime(),
              user: { name: sp.user.name, avatarUrl: sp.user.avatarUrl },
            }))}
          />
        </section>

        {/* ---------- Nizolar ---------- */}
        <section id="nizolar" className={SECTION} aria-labelledby="h-nizolar">
          <AdminSectionHeading
            title={<span id="h-nizolar">Nizolar</span>}
            description="Pul eskrouda turadi — tomonlarni ko'rib chiqib, mutaxassisga o'tkazing yoki mijozga qaytaring."
            action={<QueueChip n={disputeRows.length} some={(n) => `${n} ta ochiq`} none="Nizolar yo'q" />}
          />
          <AdminDisputes rows={disputeRows} />
        </section>

        {/* ---------- Payout so'rovlari ---------- */}
        <section id="payoutlar" className={SECTION} aria-labelledby="h-payoutlar">
          <AdminSectionHeading
            title={<span id="h-payoutlar">Payout so&apos;rovlari</span>}
            description="«Tasdiqlash» — rekvizit tekshirildi; «To'landi» — o'tkazma bajarildi. Rad sababi mutaxassisga ko'rinadi."
            action={<QueueChip n={openPayouts} some={(n) => `${n} ta kutmoqda`} none="Navbat bo'sh" />}
          />
          <AdminPayoutsQueue rows={payoutRows} />
        </section>

        {/* ---------- Shikoyatlar ---------- */}
        <section id="shikoyatlar" className={SECTION} aria-labelledby="h-shikoyatlar">
          <AdminSectionHeading
            title={<span id="h-shikoyatlar">Shikoyatlar</span>}
            description="Nishonni ko'ring, kerak bo'lsa kontentni o'chiring yoki foydalanuvchini bloklang, so'ng yoping."
            action={<QueueChip n={openReports} some={(n) => `${n} ta ochiq`} none="Ochiq shikoyat yo'q" />}
          />
          <AdminReports rows={reports} />
        </section>

        {/* ---------- Moderatsiya: jamoalar va vakansiyalar ---------- */}
        <section id="moderatsiya" className={SECTION} aria-labelledby="h-moderatsiya">
          <AdminSectionHeading title={<span id="h-moderatsiya">Jamoalar va vakansiyalar</span>} description="Egasini almashtirish, yopiq/ochiq, o'chirish; vakansiyani yopish yoki qayta ochish. Oldindan to'lov so'ragan e'lonlar avtomatik belgilanadi." />
          <AdminModeration />
        </section>

        {/* ---------- Mentorlik arizalari ---------- */}
        <section id="mentorlar" className={SECTION} aria-labelledby="h-mentorlar">
          <AdminSectionHeading title={<span id="h-mentorlar">Mentorlik arizalari</span>} description="Ustoz bo'lish arizalari — tasdiqlangach kurs ocha oladi." />
          <AdminMentors />
        </section>

        {/* ---------- To'lovlar ---------- */}
        <section id="tolovlar" className={SECTION} aria-labelledby="h-tolovlar">
          <AdminSectionHeading
            title={<span id="h-tolovlar">To&apos;lovlar</span>}
            description="Qo'lda o'tkazmalarni tasdiqlash, qaytarish yoki mutaxassisga o'tkazish."
            action={finance.manualPending > 0 ? <QueueChip n={finance.manualPending} some={(n) => `${n} ta tasdiq kutmoqda`} none="" /> : undefined}
          />
          <AdminPaymentsTable rows={paymentRows} />
          {/* Ro'yxat chegaraga yetgan — eski yozuvlar jadvalda yo'qligi haqida halol izoh */}
          {paymentRows.length === PAYMENTS_CAP && <p className="mt-2 px-1 text-[12px] text-fg-4">Oxirgi {PAYMENTS_CAP} tasi ko&apos;rsatilgan</p>}
        </section>

        {/* ---------- Moliya ---------- */}
        <section id="moliya" className={SECTION} aria-labelledby="h-moliya">
          <AdminSectionHeading
            title={<span id="h-moliya">Moliya</span>}
            description={`Komissiya: yangi ${settings.commissionPctNew}% · oddiy ${settings.commissionPct}% · top ${settings.commissionPctTop}%. Daromad — faqat yakunlangan to'lovlar komissiyasi va obuna (${formatPrice(settings.subscriptionPrice)} / oy).`}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile icon={BadgePercent} value={money(finance.revenue)} label="Platforma daromadi" hint={`${finance.releasedCount} ta yakunlangan to'lovdan`} hintTone="success" href="#analitika" />
            <Tile
              icon={Crown}
              value={money(subRevenue.revenueTotal)}
              label="Obuna daromadi"
              hint={subRevenue.pendingManual > 0 ? `${subRevenue.pendingManual} ta o'tkazma tasdiq kutmoqda` : `Bu oy: ${money(subRevenue.revenueMonth)}`}
              hintTone={subRevenue.pendingManual > 0 ? "warning" : "success"}
              href="/admin/obunalar"
            />
            <Tile icon={Hourglass} value={money(finance.escrowCommission)} label="Eskroudagi komissiya" hint={finance.paidCount > 0 ? `${finance.paidCount} ta to'lov eskrouda · hali daromad emas` : "Eskrou bo'sh"} hintTone={finance.paidCount > 0 ? "warning" : "neutral"} href="#tolovlar" />
            <Tile icon={ShieldCheck} value={money(finance.escrow)} label="Eskrouda (mutaxassis ulushi)" hint={`${finance.paymentsCount} ta to'lov`} href="#tolovlar" />
            <Tile icon={Landmark} value={money(finance.payoutsPaid)} label="To'langan payoutlar" hint={`O'tkazilgan jami: ${money(finance.released)}`} href="#payoutlar" />
            <Tile icon={Banknote} value={money(finance.payoutsOpen)} label="Kutilayotgan payoutlar" hint={finance.payoutsOpenCount > 0 ? `${finance.payoutsOpenCount} ta so'rov` : "Navbat bo'sh"} hintTone={finance.payoutsOpenCount > 0 ? "warning" : "neutral"} href="#payoutlar" />
          </div>
        </section>

        {/* ---------- Analitika (F86) ---------- */}
        <section id="analitika" className={SECTION} aria-labelledby="h-analitika">
          <AdminSectionHeading title={<span id="h-analitika">Analitika</span>} description="Daromad, buyurtmalar, yangi foydalanuvchilar va voronka — oxirgi 30 kun; jadval ko'rinishi ham bor." />
          <AdminAnalytics data={analytics} />
        </section>

        {/* ---------- Shubhali faollik (F89) ---------- */}
        <section id="shubhali" className={SECTION} aria-labelledby="h-shubhali">
          <AdminSectionHeading
            title={<span id="h-shubhali">Shubhali faollik</span>}
            description="Avtomatik signallar — ayblov emas (bitta ofis bir IP'dan kirishi mumkin). Audit jurnalini ko'rib chiqing."
            action={<QueueChip n={fraud.total} some={(n) => `${n} ta signal`} none="Signal yo'q" />}
          />
          <AdminFraudSignals data={fraud} />
        </section>

        {/* ---------- Sharhlar ---------- */}
        <section id="sharhlar" className={SECTION} aria-labelledby="h-sharhlar">
          <AdminSectionHeading title={<span id="h-sharhlar">Sharhlar</span>} description={`So'nggi ${REVIEWS_CAP} ta. O'chirilgan sharh — reyting qayta hisoblanadi, shu sharh bo'yicha shikoyatlar yopiladi.`} />
          <AdminReviews rows={reviewRows} />
          {/* Ro'yxat chegaraga yetgan — eski sharhlar jadvalda yo'qligi haqida halol izoh */}
          {reviewRows.length === REVIEWS_CAP && <p className="mt-2 px-1 text-[12px] text-fg-4">Oxirgi {REVIEWS_CAP} tasi ko&apos;rsatilgan</p>}
        </section>

        {/* ---------- Efirlar kalendari ---------- */}
        <section id="efirlar" className={SECTION} aria-labelledby="h-efirlar">
          <AdminSectionHeading title={<span id="h-efirlar">Efirlar kalendari</span>} description="Barcha kanal va jamoalardagi jonli efir e'lonlari — kelgusi va o'tgan 7 kun." />
          <AdminEvents />
        </section>

        {/* ---------- Foydalanuvchilar ---------- */}
        <section id="foydalanuvchilar" className={SECTION} aria-labelledby="h-foydalanuvchilar">
          <AdminSectionHeading title={<span id="h-foydalanuvchilar">Foydalanuvchilar</span>} description="Qidiruv, katalogda ko'rsatish, imtiyoz va bloklash — bloklangan foydalanuvchi kira olmaydi." />
          <UsersPanel />
        </section>

        {/* ---------- Ommaviy xabar ---------- */}
        <section id="xabar" className={SECTION} aria-labelledby="h-xabar">
          <AdminSectionHeading title={<span id="h-xabar">Ommaviy xabar</span>} description="Tanlangan auditoriyaning sayt bildirishnomasiga va Telegramiga (ulanganlarga); xohlasangiz emailga ham." />
          <AdminBroadcast />
        </section>

        {/* ---------- Telegram bot ---------- */}
        <section id="telegram-bot" className={SECTION} aria-labelledby="h-telegram">
          <AdminSectionHeading title={<span id="h-telegram">Telegram bot</span>} description="Token Vercel'da bo'lsa webhook shu yerdan bir tugmada o'rnatiladi." />
          <TelegramAdminPanel />
        </section>

        {/* ---------- Fayl saqlash ---------- */}
        <section id="r2-saqlash" className={SECTION} aria-labelledby="h-saqlash">
          <AdminSectionHeading title={<span id="h-saqlash">Fayl saqlash</span>} description="Faol saqlash usuli va real yuklash testi. Vercel Blob — eng oson; Cloudflare R2 — eng arzon." />
          <R2AdminPanel />
        </section>

        {/* ---------- So'nggi faollik ---------- */}
        <section id="faollik" className={SECTION} aria-labelledby="h-faollik">
          <AdminSectionHeading title={<span id="h-faollik">So&apos;nggi faollik</span>} description="Oxirgi ro'yxatdan o'tganlar va buyurtmalar. Bloklash — «Foydalanuvchilar» bo'limida." />
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Foydalanuvchilar — faqat ko'rish (bloklash tugmasi Foydalanuvchilar panelida, takror emas) */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <h3 className="text-[14px] font-semibold text-fg">So&apos;nggi foydalanuvchilar</h3>
                <span className="text-[12px] text-fg-4">Oxirgi {users.length} ta</span>
              </div>
              {users.length === 0 ? (
                <p className="px-5 py-6 text-[14px] text-fg-3">Hali foydalanuvchilar yo&apos;q.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {users.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <Avatar name={u.name} src={u.avatarUrl} size={34} decorative />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-fg">{u.name}</p>
                        <p className="truncate text-[12px] text-fg-3">
                          {u.email}
                          <time dateTime={new Date(u.createdAt).toISOString()} className="text-fg-4" suppressHydrationWarning>
                            {" · "}
                            {timeAgo(u.createdAt)}
                          </time>
                        </p>
                      </div>
                      <Badge tone={u.isBanned ? "danger" : ROLE_TONE[u.role]} className="shrink-0">
                        {u.isBanned ? "Bloklangan" : ROLE_LABEL[u.role]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Buyurtmalar */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <h3 className="text-[14px] font-semibold text-fg">So&apos;nggi buyurtmalar</h3>
                <span className="text-[12px] text-fg-4">Mijoz → mutaxassis</span>
              </div>
              {orders.length === 0 ? (
                <p className="px-5 py-6 text-[14px] text-fg-3">Hali buyurtmalar yo&apos;q.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/buyurtmalar/${o.id}`} className="-my-1.5 block truncate py-1.5 text-[13.5px] font-semibold text-fg transition hover:text-accent">
                          {o.title}
                        </Link>
                        <p className="truncate text-[12px] text-fg-3">
                          {o.client} <span className="text-fg-4">→</span>{" "}
                          <Link href={`/mutaxassislar/${o.specialistSlug}`} className="text-fg-2 transition hover:text-accent">
                            {o.specialist}
                          </Link>
                          {o.amount ? ` · ${formatPrice(o.amount, { compact: true })}` : o.budget ? ` · byudjet ${formatPrice(o.budget, { compact: true })}` : ""}
                          {" · "}
                          <time dateTime={new Date(o.createdAt).toISOString()} suppressHydrationWarning>
                            {timeAgo(o.createdAt)}
                          </time>
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[o.status]} className="shrink-0">
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ---------- Tizim holati ---------- */}
        <section id="tizim" className={SECTION} aria-labelledby="h-tizim">
          <AdminSectionHeading title={<span id="h-tizim">Tizim holati</span>} description="Baza kechikishi, saqlash usuli, kunlik cron, rate-limit bosimi va kanallar — bir qarashda." />
          <AdminHealthCard />
        </section>

        {/* ---------- To'lov tizimlari ---------- */}
        <section id="tolov-sozlamalari" className={SECTION} aria-labelledby="h-tolov-tizimlari">
          <AdminSectionHeading title={<span id="h-tolov-tizimlari">To&apos;lov tizimlari</span>} description="Payme va Click kalitlari holati avtomatik tekshiriladi; qo'lda o'tkazma kartasi shu yerdan sozlanadi." />
          <PaymentProvidersPanel />
        </section>

        {/* ---------- Sozlamalar ---------- */}
        <section id="sozlamalar" className={SECTION} aria-labelledby="h-sozlamalar">
          <AdminSectionHeading title={<span id="h-sozlamalar">Sozlamalar</span>} description="Komissiya, limitlar va obuna. Foiz narx belgilanganda buyurtmaga muhrlanadi; har bir o'zgarish tarixda va audit jurnalida." />
          <div className="max-w-3xl space-y-4">
            <PlatformSettingsForm initial={settings} history={settingsHistory} />
            <SpamFilterPanel />
          </div>
        </section>
      </div>

      {/* O'ng tomonda doimiy bo'limlar paneli (scrollspy) — uzun sahifada tez o'tish uchun */}
      <aside className="hidden xl:block">
        <AdminSectionNav items={navItems} />
      </aside>
    </div>
  );
}
