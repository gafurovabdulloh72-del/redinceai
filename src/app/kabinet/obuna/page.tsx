import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, CheckCircle2, CircleSlash, CreditCard, FileText, Handshake, Hourglass, MapPinned, Phone, Receipt, Users, XCircle, type LucideIcon } from "lucide-react";
import { Badge, ButtonLink, IconTile, PageHeader } from "@/components/ui";
import { InvoiceStatusWatcher } from "@/components/subscription/InvoiceStatusWatcher";
import { ProgressRing, type RingTone } from "@/components/subscription/ProgressRing";
import { SubscriptionCheckout } from "@/components/subscription/SubscriptionCheckout";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getSettings } from "@/lib/payments/settings";
import { subscriptionPeriod } from "@/lib/subscriptions/access";
import { canViewInvoice, loadInvoice, receiptHref, toInvoiceView } from "@/lib/subscriptions/billing";
import { INVOICE_PROVIDER_LABEL, INVOICE_STATE_LABEL, INVOICE_STATE_TONE, SUB_STATUS_LABEL, SUB_STATUS_TONE, monthsLabel, type InvoiceView } from "@/lib/subscriptions/labels";
import { getSubscriptionOverview, type SubscriptionStateView } from "@/lib/subscriptions/queries";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Obuna", robots: { index: false, follow: false } };

const RING_TONE: Record<SubscriptionStateView["status"], RingTone> = { active: "success", trial: "info", grace: "warning", expired: "danger", off: "neutral", exempt: "success" };

const PERKS: Array<{ icon: LucideIcon; t: string; d: string }> = [
  { icon: MapPinned, t: "Katalog va xaritada ko'rinish", d: "Mijozlar sizni ro'yxat, xarita, qidiruv va yo'nalish sahifalarida topadi." },
  { icon: Handshake, t: "Buyurtma va takliflar", d: "To'g'ridan-to'g'ri buyurtmalar va e'lonlarga taklif yuborish ochiq." },
  { icon: Phone, t: "Aloqa ma'lumotlari ochiq", d: "Telefon va ijtimoiy tarmoqlaringiz maxfiylik sozlamalaringiz bo'yicha ko'rinadi." },
  { icon: BadgeCheck, t: "Eskrou himoyasi", d: "Platformadagi to'lovlar eskrouda — komissiya faqat shu to'lovlardan." },
];

function headlineFor(st: SubscriptionStateView): { title: string; detail: string } {
  switch (st.status) {
    case "active":
      return { title: `${st.daysLeft} kun qoldi`, detail: `Obuna ${formatDate(st.until)} gacha faol.` };
    case "trial":
      return { title: `${st.daysLeft} kun bepul`, detail: `Bepul sinov muddati ${formatDate(st.until)} da tugaydi — keyin obuna kerak bo'ladi.` };
    case "grace":
      return { title: `${st.daysLeft} kun muhlat`, detail: `Obuna ${formatDate(st.until)} da tugadi. ${formatDate(st.graceUntil)} gacha to'lasangiz profilingiz katalogda qoladi.` };
    case "expired":
      return { title: "Obuna tugagan", detail: `${formatDate(st.graceUntil)} dan beri profilingiz katalog va xaritada ko'rinmaydi, yangi buyurtma va takliflar yopiq. Mavjud buyurtmalar davom etadi.` };
    case "off":
      return { title: "Hozircha bepul", detail: "Platforma hozir obunani talab qilmaydi — profilingiz cheklovsiz ko'rinadi. Oldindan to'lash ham mumkin." };
    case "exempt":
      return { title: "Imtiyozli a'zo", detail: "Administratsiya sizni imtiyozli shaxs sifatida belgilagan — obuna talab qilinmaydi, profilingiz doim ko'rinadi." };
  }
}

/** ?invoice=<id> — Payme/Click'dan qaytish yoki «To'ladim»dan keyingi natija */
function InvoiceResult({ inv }: { inv: InvoiceView }) {
  const map: Record<InvoiceView["state"], { icon: LucideIcon; cls: string; title: string; body: string }> = {
    paid: {
      icon: CheckCircle2,
      cls: "border-success/30 bg-success-soft",
      title: "To'lov qabul qilindi",
      body: `${monthsLabel(inv.months)}lik obuna faollashtirildi${inv.periodEnd ? ` — ${formatDate(inv.periodEnd)} gacha` : ""}. Rahmat!`,
    },
    pending: {
      icon: Hourglass,
      cls: "border-warning/30 bg-warning-soft",
      title: inv.provider === "manual" ? "O'tkazma tekshirilmoqda" : "To'lov tasdiqlanishi kutilmoqda",
      body:
        inv.provider === "manual"
          ? `Administrator ${formatPrice(inv.amount)} o'tkazmangizni tekshiradi (odatda 1 ish kuni). Tasdiqlangach bildirishnoma keladi.`
          : `${INVOICE_PROVIDER_LABEL[inv.provider]} to'lovni tasdiqlashi bilan sahifa o'zi yangilanadi.`,
    },
    created: {
      icon: Hourglass,
      cls: "border-line bg-surface-2",
      title: "To'lov hali yakunlanmagan",
      body: "Agar to'lov sahifasini yopib qo'ygan bo'lsangiz, quyida rejani tanlab qayta urinib ko'ring.",
    },
    cancelled: { icon: XCircle, cls: "border-line bg-surface-2", title: "To'lov bekor qilindi", body: "Pul yechilmagan. Quyida qayta urinib ko'rishingiz mumkin." },
    refunded: { icon: CircleSlash, cls: "border-danger/30 bg-danger-soft", title: "To'lov qaytarilgan", body: `${formatPrice(inv.amount)} qaytarildi, obuna muddati shunga mos qisqartirildi.` },
  };
  const m = map[inv.state];
  return (
    <div role="status" className={cn("mt-6 flex flex-col gap-3 rounded-[var(--r-md)] border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5", m.cls)}>
      <div className="flex min-w-0 items-start gap-3">
        <m.icon size={20} aria-hidden="true" className={cn("mt-0.5 shrink-0", inv.state === "paid" ? "text-success-text" : inv.state === "pending" ? "text-warning-text" : inv.state === "refunded" ? "text-danger-text" : "text-fg-3")} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">
            {m.title} <span className="font-mono text-[12px] font-normal text-fg-3">· {inv.number}</span>
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-2">{m.body}</p>
        </div>
      </div>
      {inv.state === "paid" && (
        <ButtonLink href={receiptHref(inv.id)} variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
          <FileText size={14} /> Chek
        </ButtonLink>
      )}
      {inv.state === "pending" && inv.provider !== "manual" && <InvoiceStatusWatcher invoiceId={inv.id} state={inv.state} />}
    </div>
  );
}

function InvoiceHistory({ invoices }: { invoices: InvoiceView[] }) {
  if (!invoices.length) {
    return <p className="rounded-[var(--r-sm)] bg-surface-2 px-4 py-3 text-[13px] text-fg-3">Hali obuna to&apos;lovlari yo&apos;q.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {invoices.map((i) => (
        <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-fg">
              {monthsLabel(i.months)} · <span className="tabular-nums">{formatPrice(i.amount)}</span>
              <Badge tone={INVOICE_STATE_TONE[i.state]}>{INVOICE_STATE_LABEL[i.state]}</Badge>
            </p>
            <p className="mt-0.5 text-[12px] text-fg-3">
              <span className="font-mono">{i.number}</span> · {INVOICE_PROVIDER_LABEL[i.provider]} · {formatDateTime(i.paidAt ?? i.createdAt)}
              {i.periodStart && i.periodEnd && i.state !== "cancelled" ? (
                <span className="block sm:inline">
                  <span className="hidden sm:inline"> · </span>Davr: {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                </span>
              ) : null}
            </p>
          </div>
          {(i.state === "paid" || i.state === "refunded") && (
            <Link href={receiptHref(i.id)} className="-mx-1 inline-flex min-h-10 shrink-0 items-center gap-1.5 self-start px-1 text-[13px] font-semibold text-accent-text sm:self-auto">
              <Receipt size={14} aria-hidden="true" /> Chek
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ invoice?: string | string[] }> }) {
  const sp = await searchParams;
  const invoiceParam = Array.isArray(sp.invoice) ? sp.invoice[0] : sp.invoice;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/kabinet/obuna${invoiceParam ? `?invoice=${encodeURIComponent(invoiceParam)}` : ""}`));

  const specialist = user.specialist;
  if (!specialist) {
    const settings = await getSettings();
    return (
      <div className="animate-fade-up">
        <PageHeader eyebrow={<><CreditCard size={13} className="text-accent" /> Obuna</>} title={<>Mijozlar uchun <span className="accent-serif text-accent">bepul</span></>} description="Kasb Egalari platformasida mutaxassis topish, buyurtma berish, e'lon joylash va eskrou orqali to'lash mijozlar uchun to'liq bepul. Obuna faqat mutaxassislar uchun." />
        <div className="card mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <IconTile icon={Users} tone="soft" />
            <div>
              <p className="font-display text-[17px] font-semibold text-fg">Siz ham mutaxassismisiz?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                Mutaxassislar uchun obuna {formatPrice(settings.subscriptionPrice)} / oy, birinchi {settings.subscriptionTrialDays} kun bepul.
              </p>
            </div>
          </div>
          <ButtonLink href="/narxlar" variant="outline" size="md" className="shrink-0">
            Narxlar <ArrowRight size={14} />
          </ButtonLink>
        </div>
      </div>
    );
  }

  const [overview, settings, invRow] = await Promise.all([getSubscriptionOverview(specialist), getSettings(), invoiceParam ? loadInvoice(invoiceParam) : Promise.resolve(null)]);
  const result = invRow && canViewInvoice(invRow, { id: user.id, role: user.role, specialistId: specialist.id }) ? toInvoiceView(invRow) : null;
  const st = overview.state;
  const head = headlineFor(st);
  const now = new Date();
  const untilByMonths = Object.fromEntries(overview.plans.map((p) => [p.months, subscriptionPeriod(specialist, p.months, settings, now).periodEnd.getTime()]));
  // Tarix: provayderga yetib bormagan (avtomatik yopilgan) bekor hisoblar ko'rsatilmaydi
  const history = overview.invoices.filter((i) => i.state !== "created" && (i.state !== "cancelled" || i.attempted));
  const openManual = overview.invoices.find((i) => i.provider === "manual" && i.state === "created") ?? null;
  const pendingManual = overview.invoices.find((i) => i.provider === "manual" && i.state === "pending") ?? null;
  const paidInvoices = overview.invoices.filter((i) => i.state === "paid");
  const paidCount = paidInvoices.length;
  const paidTotal = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
  const renew = st.status === "active" || st.status === "off" ? "Uzaytirish" : st.status === "trial" ? "Faollashtirish" : "To'lash";

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={
          <>
            <CreditCard size={13} className="text-accent" /> Obuna
          </>
        }
        title={
          <>
            Mutaxassis <span className="accent-serif text-accent">obunasi</span>
          </>
        }
        description={`${formatPrice(overview.price)} / oy — profilingiz katalog va xaritada ko'rinadi, buyurtma va takliflar ochiq. Mijozlar Kasb Egalari platformasidan bepul foydalanadi.`}
      />

      {result && <InvoiceResult inv={result} />}

      {/* Holat */}
      <section aria-labelledby="sub-status" className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className={cn("flex flex-col p-5 sm:p-6 lg:col-span-3", st.status === "expired" || st.status === "grace" ? "card-elevated" : "card")}>
          <div className="flex flex-1 flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
            <ProgressRing value={st.daysLeft} max={st.periodDays} tone={RING_TONE[st.status]} label={`${SUB_STATUS_LABEL[st.status]}: ${st.daysLeft} kun qoldi`}>
              <span className="font-display text-[34px] font-semibold leading-none text-fg tabular-nums">{st.daysLeft}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3">kun</span>
            </ProgressRing>
            <div className="min-w-0">
              <Badge tone={SUB_STATUS_TONE[st.status]}>
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> {SUB_STATUS_LABEL[st.status]}
              </Badge>
              <h2 id="sub-status" className="mt-3 font-display text-[26px] font-semibold leading-tight text-fg sm:text-[28px]">
                {head.title}
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{head.detail}</p>
              {st.status !== "expired" && (
                <p className="mt-3 text-[12px] text-fg-3">
                  {st.status === "grace" ? "Muhlat tugaydi" : st.paid ? "To'langan muddat" : "Sinov tugaydi"}:{" "}
                  <span className="font-semibold text-fg-2">{formatDate(st.status === "grace" ? st.graceUntil : st.until)}</span>
                </p>
              )}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center sm:text-left">
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">Narx</dt>
              <dd className="mt-1 truncate text-[14px] font-semibold text-fg tabular-nums">{formatPrice(overview.price, { compact: true })}/oy</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">To&apos;lovlar</dt>
              <dd className="mt-1 text-[14px] font-semibold text-fg tabular-nums">{paidCount} ta</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-3">Jami</dt>
              <dd className="mt-1 truncate text-[14px] font-semibold text-fg tabular-nums">{formatPrice(paidTotal, { compact: true })}</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="font-display text-[16px] font-semibold text-fg">Obuna nimalar beradi</h2>
          <ul className="mt-3 space-y-3">
            {PERKS.map((p) => (
              <li key={p.t} className="flex items-start gap-3">
                <span className="icon-tile-outline icon-tile-sm text-fg-2">
                  <p.icon size={14} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-fg">{p.t}</p>
                  <p className="text-[12px] leading-snug text-fg-3">{p.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rejalar va to'lov */}
      <section id="rejalar" aria-labelledby="plans-title" className="mt-8 scroll-mt-28">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="plans-title" className="font-display text-[20px] font-semibold text-fg">
              Rejani tanlang
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">Uzoqroq muddat — kattaroq chegirma. Yangi davr joriy muddat tugashidan boshlanadi, qolgan kunlar yo&apos;qolmaydi.</p>
          </div>
          <Link href="/narxlar" className="-mx-1 inline-flex min-h-10 items-center gap-1 px-1 text-[13px] font-semibold text-accent-text">
            Narxlar va savollar <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <SubscriptionCheckout
          plans={overview.plans}
          providers={overview.providers}
          manual={overview.manual}
          untilByMonths={untilByMonths}
          openManual={openManual}
          pendingManual={pendingManual}
          ctaLabel={renew}
        />
      </section>

      {/* Tarix */}
      <section aria-labelledby="history-title" className="card mt-8 p-5 sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="history-title" className="font-display text-[17px] font-semibold text-fg">
            To&apos;lovlar tarixi
          </h2>
          <Receipt size={16} className="text-fg-4" aria-hidden="true" />
        </div>
        <InvoiceHistory invoices={history} />
      </section>
    </div>
  );
}
