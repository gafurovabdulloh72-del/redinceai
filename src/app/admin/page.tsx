import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  ClipboardList,
  Hourglass,
  Landmark,
  MapPinned,
  MessageSquareText,
  Receipt,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AdminPaymentsTable, type AdminPaymentRow } from "@/components/admin/AdminPaymentsTable";
import { AdminPayoutsQueue, type AdminPayoutRow } from "@/components/admin/AdminPayoutsQueue";
import { AdminSpecialistsTable, type PendingSpecialist } from "@/components/admin/AdminSpecialistsTable";
import { PlatformSettingsForm } from "@/components/admin/PlatformSettingsForm";
import { Avatar, Badge, ButtonLink, IconTile, SectionHeading, type BadgeTone } from "@/components/ui";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { ORDER_STATUS_LABEL, REGIONS, type OrderStatus } from "@/lib/constants";
import { getAdminFinance, listAdminPayments, listAdminPayouts } from "@/lib/payments/queries";
import { getSettings } from "@/lib/payments/settings";
import { getAdminOverview } from "@/lib/queries";
import { cn, formatPrice, timeAgo } from "@/lib/utils";

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
      {hint && <div className={cn("mt-1 text-[12px] font-medium", hintTone === "warning" ? "text-warning" : hintTone === "success" ? "text-success" : "text-fg-4")}>{hint}</div>}
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

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin"));
  if (user.role !== "admin") redirect("/kabinet");

  const [{ stats, pending, latestUsers, latestOrders }, finance, payouts, payments, settings] = await Promise.all([getAdminOverview(), getAdminFinance(), listAdminPayouts(), listAdminPayments(), getSettings()]);

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
    createdAt: sp.createdAt.getTime(),
    user: { name: sp.user.name, email: sp.user.email, phone: sp.user.phone },
  }));

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

  const sections = [
    { href: "#moliya", label: "Moliya", icon: Wallet },
    { href: "#sozlamalar", label: "Sozlamalar", icon: SlidersHorizontal },
    { href: "#payoutlar", label: "Payout so'rovlari", icon: Banknote, count: openPayouts },
    { href: "#tolovlar", label: "To'lovlar", icon: Receipt, count: finance.manualPending },
    { href: "#tasdiqlash", label: "Tasdiqlash", icon: UserCheck, count: pending.length },
  ];

  return (
    <div className="container-x animate-fade-up">
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
          <ButtonLink href="/admin/audit" variant="outline" size="sm">
            <ScrollText size={14} /> Audit jurnali
          </ButtonLink>
          <ButtonLink href="/kabinet" variant="outline" size="sm">
            Kabinet <ArrowRight size={14} />
          </ButtonLink>
        </div>
      </header>

      {/* Bo'limlarga tez o'tish */}
      <nav aria-label="Bo'limlar" className="no-scrollbar -mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
        <Tile icon={Users} value={stats.specialists} label="Mutaxassislar" hint={pending.length > 0 ? `${pending.length} ta tekshiruvda` : "Hammasi tasdiqlangan"} hintTone={pending.length > 0 ? "warning" : "success"} href="/mutaxassislar" />
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

      {/* ---------- Moliya ---------- */}
      <section id="moliya" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading
          eyebrow="Moliya"
          title={
            <>
              Platforma <span className="accent-serif text-accent">daromadi</span>
            </>
          }
          description={`Har bir to'lovdan ${settings.commissionPct}% komissiya platformaga qoladi; qolgani mijoz ishni qabul qilgach mutaxassis balansiga tushadi.`}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile
            icon={BadgePercent}
            value={money(finance.revenue)}
            label="Platforma daromadi"
            hint={`${finance.paymentsCount} ta yakunlangan to'lovdan${finance.escrowCommission > 0 ? ` · eskrouda yana ${money(finance.escrowCommission)}` : ""}`}
            hintTone="success"
          />
          <Tile icon={ShieldCheck} value={money(finance.escrow)} label="Eskrouda (mutaxassis ulushi)" hint="Qabul qilinishi kutilmoqda" />
          <Tile icon={Landmark} value={money(finance.payoutsPaid)} label="To'langan payoutlar" hint={`O'tkazilgan jami: ${money(finance.released)}`} />
          <Tile icon={Hourglass} value={money(finance.payoutsOpen)} label="Kutilayotgan payoutlar" hint={finance.payoutsOpenCount > 0 ? `${finance.payoutsOpenCount} ta so'rov` : "Navbat bo'sh"} hintTone={finance.payoutsOpenCount > 0 ? "warning" : "neutral"} href="#payoutlar" />
        </div>
      </section>

      {/* ---------- Sozlamalar ---------- */}
      <section id="sozlamalar" className="mt-14 scroll-mt-28 sm:mt-16">
        <SectionHeading eyebrow="Sozlamalar" title="Komissiya va limitlar" description="Upwork uslubi: mijoz to'lagan summadan belgilangan foiz platformaga qoladi. Limitlar yangi buyurtma va payout so'rovlariga qo'llanadi." />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PlatformSettingsForm initial={settings} />
          </div>
          <div className="card p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Hozirgi qiymatlar</p>
            <dl className="mt-3 divide-y divide-line text-[14px]">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Komissiya</dt>
                <dd className="font-semibold text-fg tabular-nums">{settings.commissionPct}%</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Minimal buyurtma</dt>
                <dd className="font-semibold text-fg tabular-nums">{formatPrice(settings.minOrderAmount)}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-fg-2">Minimal payout</dt>
                <dd className="font-semibold text-fg tabular-nums">{formatPrice(settings.minPayout)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-snug text-fg-3">O'zgarishlar audit jurnaliga yoziladi.</p>
          </div>
        </div>
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
      </section>

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
        <AdminSpecialistsTable pending={pendingRows} />
      </section>

      {/* ---------- So'nggi faollik ---------- */}
      <section className="mt-14 sm:mt-16">
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
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={u.name} src={u.avatarUrl} size={38} decorative />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-fg">{u.name}</p>
                      <p className="truncate text-[12px] text-fg-3">{u.email}</p>
                    </div>
                    <Badge tone={ROLE_TONE[u.role]} className="shrink-0">
                      {ROLE_LABEL[u.role]}
                    </Badge>
                    <time dateTime={new Date(u.createdAt).toISOString()} className="hidden w-24 shrink-0 text-right text-[12px] text-fg-3 sm:block" suppressHydrationWarning>
                      {timeAgo(u.createdAt)}
                    </time>
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
    </div>
  );
}
