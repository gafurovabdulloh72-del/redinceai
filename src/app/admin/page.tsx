import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users as usersTable } from "@/lib/db/schema";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import { DemoCleanButton } from "@/components/admin/DemoCleanButton";
import { PaymentProvidersPanel } from "@/components/admin/PaymentProvidersPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  ChartColumn,
  ClipboardList,
  CreditCard,
  Crown,
  Flag,
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
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminBanToggle } from "@/components/admin/AdminBanToggle";
import { AdminDisputes, type AdminDisputeRow } from "@/components/admin/AdminDisputes";
import { AdminFraudSignals } from "@/components/admin/AdminFraudSignals";
import { AdminPaymentsTable, type AdminPaymentRow } from "@/components/admin/AdminPaymentsTable";
import { AdminPayoutsQueue, type AdminPayoutRow } from "@/components/admin/AdminPayoutsQueue";
import { AdminReports } from "@/components/admin/AdminReports";
import { AdminReviews, type AdminReviewRow } from "@/components/admin/AdminReviews";
import { AdminSpecialistsTable, type PendingSpecialist } from "@/components/admin/AdminSpecialistsTable";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { Avatar, Badge, ButtonLink, IconTile, SectionHeading, type BadgeTone } from "@/components/ui";
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

function Tile({ icon: Icon, value, label, hint, hintTone = "neutral", href }: { icon: LucideIcon; value: React.ReactNode; label: string; hint?: string; hintTone?: "neutral" | "warning" | "success"; href?: string }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <IconTile icon={Icon} size="sm" tone="outline" />
        {href && <ArrowUpRight size={16} className="text-fg-4 transition group-hover:text-fg" />}
      </div>
      <div className="mt-4 font-display text-[24px] font-semibold leading-none tracking-tight text-fg sm:text-[30px]">{value}</div>
      <div className="mt-2 text-[12px] font-medium text-fg-3">{label}</div>
      {hint && <div className={cn("mt-1 text-[12px] font-medium", hintTone === "warning" ? "text-warning-text" : hintTone === "success" ? "text-success-text" : "text-fg-4")}>{hint}</div>}
    </>
  );
  const cls = "card group block p-4 sm:p-5";
  return href ? (
    <Link href={href} className={cn(cls, "card-hover")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

const money = (n: number) => formatPrice(n, { compact: n >= 10_000_000 });

/** Ro'yxat chegaralari — jadval ostidagi "Oxirgi N tasi ko'rsatilgan" izohi uchun */
const PAYMENTS_CAP = 60;
const REVIEWS_CAP = 30;

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
    bannedReason: u.bannedReason,
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

  // Chiplar sahifadagi yangi tartib bilan bir xil: amal navbatlari birinchi
  const sections = [
    { href: "#tasdiqlash", label: "Tasdiqlash", icon: UserCheck, count: pendingRows.length },
    { href: "#nizolar", label: "Nizolar", icon: Scale, count: disputeRows.length },
    { href: "#payoutlar", label: "Payout so'rovlari", icon: Banknote, count: openPayouts },
    { href: "#shikoyatlar", label: "Shikoyatlar", icon: Flag, count: openReports },
    { href: "#tolovlar", label: "To'lovlar", icon: Receipt, count: finance.manualPending },
    { href: "#moliya", label: "Moliya", icon: Wallet },
    { href: "#analitika", label: "Analitika", icon: ChartColumn },
    { href: "#shubhali", label: "Shubhali faollik", icon: ShieldAlert, count: fraud.total },
    { href: "#sharhlar", label: "Sharhlar", icon: MessageSquareText },
    { href: "#sozlamalar", label: "Sozlamalar", icon: SlidersHorizontal },
  ];

  /** O'ng paneldagi bo'limlar — sahifadagi section'lar bilan BIR XIL tartibda; navbat badge'lari bilan */
  const navItems = [
    { id: "tasdiqlash", label: "Tasdiqlash", badge: pendingRows.length },
    { id: "nizolar", label: "Nizolar", badge: disputeRows.length },
    { id: "payoutlar", label: "Payoutlar", badge: openPayouts },
    { id: "shikoyatlar", label: "Shikoyatlar", badge: openReports },
    { id: "tolovlar", label: "To'lovlar", badge: finance.manualPending },
    { id: "moliya", label: "Moliya" },
    { id: "analitika", label: "Analitika" },
    { id: "shubhali", label: "Shubhali faollik" },
    { id: "sharhlar", label: "Sharhlar" },
    { id: "foydalanuvchilar", label: "Foydalanuvchilar" },
    { id: "faollik", label: "So'nggi faollik" },
    { id: "tolov-sozlamalari", label: "To'lov sozlamalari" },
    { id: "sozlamalar", label: "Sozlamalar" },
  ];

  return (
    <div className="container-x animate-fade-up xl:grid xl:grid-cols-[minmax(0,1fr)_190px] xl:gap-10">
      <div className="min-w-0">
      {/* ---------- Sarlavha ---------- */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">
            <ShieldCheck size={13} className="text-accent" /> Admin panel
          </span>
          <h1 className="display-xl mt-5 text-[34px] text-fg sm:text-[48px]">Boshqaruv markazi</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
            Moliya (eskrou, komissiya, payoutlar), platforma sozlamalari, profillarni tasdiqlash va faollik — bir joyda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/obunalar" variant="outline" size="sm">
            <CreditCard size={14} /> Obunalar
            {subRevenue.pendingManual > 0 && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent-text">{subRevenue.pendingManual}</span>}
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
      <nav aria-label="Bo'limlar" className="no-scrollbar -mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0 xl:hidden">
        <ul className="flex w-max gap-1.5">
          {sections.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg">
                <s.icon size={14} className="text-fg-3" /> {s.label}
                {s.count ? <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-accent">{s.count}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ---------- Statistika ---------- */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Profili to'ldirilgan mutaxassislar sanaladi — rol "mutaxassis" bo'lib profil yaratmaganlar kirmaydi */}
        <Tile icon={Users} value={stats.specialists} label="Mutaxassis profillari" hint={pending.length > 0 ? `${pending.length} ta tekshiruvda` : "Hammasi tasdiqlangan"} hintTone={pending.length > 0 ? "warning" : "success"} href="/mutaxassislar" />
        <Tile icon={ClipboardList} value={stats.orders} label="Buyurtmalar" hint={lastOrderAt ? `Oxirgisi ${timeAgo(lastOrderAt)}` : undefined} />
        <Tile icon={MessageSquareText} value={stats.reviews} label="Sharhlar" />
        <Tile
          icon={MapPinned}
          value={
            <>
              {stats.regions}
              <span className="text-[18px] text-fg-3">/{REGIONS.length}</span>
            </>
          }
          label="Hududlar qamrovi"
          href="/xarita"
        />
      </div>

      {/* ---------- Tasdiqlash navbati ---------- */}
      <section id="tasdiqlash" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Tasdiqlash navbati"
          title="Yangi profillar"
          description="Tasdiqlangan profillar ro'yxatda belgili ko'rinadi va ko'proq ishonch qozonadi. Tavsiya etilganlar bosh sahifada chiqadi."
          action={
            <Badge tone={pending.length > 0 ? "warning" : "success"} className="self-start !px-3 !py-1.5 sm:self-auto">
              {pending.length > 0 ? `${pending.length} ta kutmoqda` : "Navbat bo'sh"}
            </Badge>
          }
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
      <section id="nizolar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Nizolar"
          title="Arbitraj navbati"
          description="Mijoz yoki mutaxassis eskroudagi buyurtma bo'yicha nizo ochgan. Pul eskrouda turadi; ikkala tomonni (buyurtma sahifasidagi jurnal, aloqa) ko'rib chiqib qaror bering — tomonlarga bildirishnoma va izoh boradi."
          action={
            <Badge tone={disputeRows.length > 0 ? "warning" : "success"} className="self-start !px-3 !py-1.5 sm:self-auto">
              {disputeRows.length > 0 ? `${disputeRows.length} ta ochiq nizo` : "Nizolar yo'q"}
            </Badge>
          }
        />
        <AdminDisputes rows={disputeRows} />
      </section>

      {/* ---------- Payout so'rovlari ---------- */}
      <section id="payoutlar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Payout so'rovlari"
          title="Pul chiqarish navbati"
          description="Mutaxassis released balansidan so'raydi. «Tasdiqlash» — rekvizitni tekshirdingiz; «To'landi» — o'tkazma qilingach. Rad etishda sabab mutaxassisga ko'rinadi."
          action={
            <Badge tone={openPayouts > 0 ? "warning" : "success"} className="self-start !px-3 !py-1.5 sm:self-auto">
              {openPayouts > 0 ? `${openPayouts} ta kutmoqda` : "Navbat bo'sh"}
            </Badge>
          }
        />
        <AdminPayoutsQueue rows={payoutRows} />
      </section>

      {/* ---------- Shikoyatlar ---------- */}
      <section id="shikoyatlar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Shikoyatlar"
          title="Profil va sharh shikoyatlari"
          description="Foydalanuvchilar yuborgan shikoyatlar. Nishonni ko'rib chiqing: kerak bo'lsa sharhni o'chiring (pastda) yoki profilni bloklang, so'ng shikoyatni yoping."
          action={
            <Badge tone={openReports > 0 ? "warning" : "success"} className="self-start !px-3 !py-1.5 sm:self-auto">
              {openReports > 0 ? `${openReports} ta ochiq` : "Ochiq shikoyat yo'q"}
            </Badge>
          }
        />
        <AdminReports rows={reports} />
      </section>

      {/* ---------- To'lovlar ---------- */}
      <section id="tolovlar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="To'lovlar"
          title="Eskrou to'lovlari"
          description="Qo'lda o'tkazmalarni tasdiqlang, bekor qilingan buyurtmalar bo'yicha pulni qaytaring yoki zarur bo'lsa mutaxassisga o'tkazing."
          action={
            finance.manualPending > 0 ? (
              <Badge tone="warning" className="self-start !px-3 !py-1.5 sm:self-auto">
                {finance.manualPending} ta o'tkazma tasdiq kutmoqda
              </Badge>
            ) : undefined
          }
        />
        <AdminPaymentsTable rows={paymentRows} />
        {/* Ro'yxat chegaraga yetgan — eski yozuvlar jadvalda yo'qligi haqida halol izoh */}
        {paymentRows.length === PAYMENTS_CAP && <p className="mt-2 px-1 text-[12px] text-fg-4">Oxirgi {PAYMENTS_CAP} tasi ko'rsatilgan</p>}
      </section>

      {/* ---------- Moliya ---------- */}
      <section id="moliya" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Moliya"
          title={
            <>
              Platforma <span className="accent-serif text-accent">daromadi</span>
            </>
          }
          description={`Komissiya darajalari: yangi ${settings.commissionPctNew}% · oddiy ${settings.commissionPct}% · top ${settings.commissionPctTop}%. Platforma daromadi — faqat yakunlangan (released) to'lovlar komissiyasi; eskroudagi komissiya qaytarilishi mumkin. Obuna daromadi — mutaxassislarning oylik obuna to'lovlari (${formatPrice(settings.subscriptionPrice)} / oy).`}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <Tile icon={BadgePercent} value={money(finance.revenue)} label="Platforma daromadi" hint={`${finance.releasedCount} ta yakunlangan to'lovdan`} hintTone="success" />
          <Tile
            icon={Crown}
            value={money(subRevenue.revenueTotal)}
            label="Obuna daromadi"
            hint={subRevenue.pendingManual > 0 ? `${subRevenue.pendingManual} ta o'tkazma tasdiq kutmoqda` : `Bu oy: ${money(subRevenue.revenueMonth)}`}
            hintTone={subRevenue.pendingManual > 0 ? "warning" : "success"}
            href="/admin/obunalar"
          />
          <Tile icon={Hourglass} value={money(finance.escrowCommission)} label="Eskroudagi komissiya" hint={finance.paidCount > 0 ? `${finance.paidCount} ta to'lov eskrouda · hali daromad emas` : "Eskrou bo'sh"} hintTone={finance.paidCount > 0 ? "warning" : "neutral"} />
          <Tile icon={ShieldCheck} value={money(finance.escrow)} label="Eskrouda (mutaxassis ulushi)" hint={`${finance.paymentsCount} ta to'lov (eskrou + yakunlangan)`} />
          <Tile icon={Landmark} value={money(finance.payoutsPaid)} label="To'langan payoutlar" hint={`O'tkazilgan jami: ${money(finance.released)}`} />
          <Tile icon={Banknote} value={money(finance.payoutsOpen)} label="Kutilayotgan payoutlar" hint={finance.payoutsOpenCount > 0 ? `${finance.payoutsOpenCount} ta so'rov` : "Navbat bo'sh"} hintTone={finance.payoutsOpenCount > 0 ? "warning" : "neutral"} href="#payoutlar" />
        </div>
      </section>

      {/* ---------- Analitika (F86) ---------- */}
      <section id="analitika" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Analitika"
          title={
            <>
              Trendlar va <span className="accent-serif text-accent">voronka</span>
            </>
          }
          description="Daromad = yakunlangan to'lovlar komissiyasi + obuna to'lovlari. Ustun yoki nuqta ustiga olib boring (klaviaturada — strelkalar) yoki jadval ko'rinishiga o'ting."
        />
        <AdminAnalytics data={analytics} />
      </section>

      {/* ---------- Shubhali faollik (F89) ---------- */}
      <section id="shubhali" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Xavfsizlik"
          title="Shubhali faollik"
          description="Avtomatik signallar — ayblov emas: bitta ofis yoki oila bir IP'dan kirishi mumkin. Audit jurnalini ko'rib chiqing, kerak bo'lsa bloklang (sessiyalar bekor qilinadi, profil yashiriladi)."
          action={
            <Badge tone={fraud.total > 0 ? "warning" : "success"} className="self-start !px-3 !py-1.5 sm:self-auto">
              {fraud.total > 0 ? `${fraud.total} ta signal` : "Signal yo'q"}
            </Badge>
          }
        />
        <AdminFraudSignals data={fraud} />
      </section>

      {/* ---------- Sharhlar ---------- */}
      <section id="sharhlar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading eyebrow="Sharhlar" title="Sharh moderatsiyasi" description="So'nggi 30 ta sharh. Haqoratli yoki soxta sharhni o'chiring — mutaxassis reytingi darhol qayta hisoblanadi, shu sharh bo'yicha shikoyatlar yopiladi." />
        <AdminReviews rows={reviewRows} />
        {/* Ro'yxat chegaraga yetgan — eski sharhlar jadvalda yo'qligi haqida halol izoh */}
        {reviewRows.length === REVIEWS_CAP && <p className="mt-2 px-1 text-[12px] text-fg-4">Oxirgi {REVIEWS_CAP} tasi ko'rsatilgan</p>}
      </section>

      {/* ---------- Foydalanuvchilar ---------- */}
      <section id="foydalanuvchilar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Foydalanuvchilar"
          title={
            <>
              Hisoblarni <span className="accent-serif text-accent">boshqarish</span>
            </>
          }
          description="Qidiring va kerak bo'lsa bloklang — bloklangan foydalanuvchi kira olmaydi va katalogda ko'rinmaydi."
        />
        <UsersPanel />
      </section>

      {/* ---------- So'nggi faollik ---------- */}
      <section id="faollik" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading eyebrow="So'nggi faollik" title="Foydalanuvchilar va buyurtmalar" />
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Foydalanuvchilar */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <h3 className="font-display text-[17px] font-semibold text-fg">So'nggi foydalanuvchilar</h3>
                <p className="text-[12px] text-fg-3">Oxirgi {users.length} ta ro'yxatdan o'tgan</p>
              </div>
              <Users size={18} className="text-fg-4" />
            </div>
            {users.length === 0 ? (
              <p className="px-5 pb-6 text-[14px] text-fg-3">Hali foydalanuvchilar yo'q.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                    <Avatar name={u.name} src={u.avatarUrl} size={38} decorative />
                    <div className="min-w-[10rem] flex-1">
                      <p className="truncate text-[14px] font-semibold text-fg">{u.name}</p>
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
                    {u.role !== "admin" && <AdminBanToggle key={`${u.id}:${u.isBanned}`} userId={u.id} name={u.name} initialBanned={u.isBanned} initialReason={u.bannedReason} className="ml-auto" />}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Buyurtmalar */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
              <div>
                <h3 className="font-display text-[17px] font-semibold text-fg">So'nggi buyurtmalar</h3>
                <p className="text-[12px] text-fg-3">Mijoz → mutaxassis</p>
              </div>
              <ClipboardList size={18} className="text-fg-4" />
            </div>
            {orders.length === 0 ? (
              <p className="px-5 pb-6 text-[14px] text-fg-3">Hali buyurtmalar yo'q.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/buyurtmalar/${o.id}`} className="block truncate text-[14px] font-semibold text-fg transition hover:text-accent">
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

      {/* ---------- To'lov sozlamalari ---------- */}
      <section id="tolov-sozlamalari" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="To'lov tizimlari"
          title={
            <>
              To'lovlarni <span className="accent-serif text-accent">boshqarish</span>
            </>
          }
          description="Payme va Click kalitlari holati avtomatik tekshiriladi; qo'lda o'tkazma kartasi shu yerdan sozlanadi."
        />
        <PaymentProvidersPanel />
      </section>

      {/* ---------- Sozlamalar ---------- */}
      <section id="sozlamalar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading eyebrow="Sozlamalar" title="Komissiya, obuna va limitlar" description="Mijoz to'lagan summadan belgilangan foiz platformaga qoladi; foiz mutaxassis darajasiga qarab (yangi / oddiy / top) narx belgilanganda buyurtmaga muhrlanadi. Mutaxassislar oylik obuna to'laydi, mijozlar bepul. Har bir o'zgarish tarixda saqlanadi." />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <PlatformSettingsForm initial={settings} history={settingsHistory} />
          </div>
          <div className="card self-start p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Hozirgi qiymatlar</p>
            <dl className="mt-3 divide-y divide-line text-[14px]">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Yangi mutaxassis</dt>
                <dd className="font-semibold text-fg tabular-nums">{settings.commissionPctNew}%</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Oddiy daraja</dt>
                <dd className="font-semibold text-fg tabular-nums">{settings.commissionPct}%</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Top mutaxassis</dt>
                <dd className="font-semibold text-fg tabular-nums">{settings.commissionPctTop}%</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Minimal buyurtma</dt>
                <dd className="font-semibold text-fg tabular-nums">{formatPrice(settings.minOrderAmount)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Minimal payout</dt>
                <dd className="font-semibold text-fg tabular-nums">{formatPrice(settings.minPayout)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Obuna (oyiga)</dt>
                <dd className="font-semibold text-fg tabular-nums">{formatPrice(settings.subscriptionPrice)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Sinov / imtiyoz</dt>
                <dd className="font-semibold text-fg tabular-nums">
                  {settings.subscriptionTrialDays} / {settings.subscriptionGraceDays} kun
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Obuna talabi</dt>
                <dd>
                  <Badge tone={settings.subscriptionEnforced === 1 ? "success" : "neutral"}>{settings.subscriptionEnforced === 1 ? "Yoqilgan" : "O'chirilgan"}</Badge>
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-snug text-fg-3">O'zgarishlar audit jurnaliga yoziladi.</p>
          </div>
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
