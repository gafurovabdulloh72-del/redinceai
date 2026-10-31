import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, Clock3, CreditCard, Hourglass, Search, TrendingUp, UserCheck, UserX, X, type LucideIcon } from "lucide-react";
import { Pagination, buildHref } from "@/components/specialists/Pagination";
import { AdminExtendButton, AdminInvoiceActions } from "@/components/subscription/AdminSubscriptionActions";
import { Avatar, Badge, EmptyState, IconTile } from "@/components/ui";
import { ScrollRow } from "@/components/ui/ScrollRow";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { INVOICE_PROVIDER_LABEL, INVOICE_STATE_LABEL, INVOICE_STATE_TONE, SUB_STATUS_LABEL, SUB_STATUS_TONE, monthsLabel } from "@/lib/subscriptions/labels";
import { getAdminSubscriptionData } from "@/lib/subscriptions/queries";
import { adminSubscriptionsQuerySchema, type AdminSubFilter } from "@/lib/subscriptions/schemas";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { ADMIN_2FA_PATH, adminTwoFactorRequired } from "@/lib/security/admin-2fa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Obunalar", robots: { index: false, follow: false } };

const FILTERS: Array<{ key: AdminSubFilter; label: string }> = [
  { key: "all", label: "Barchasi" },
  { key: "active", label: "Faol" },
  { key: "trial", label: "Sinov" },
  { key: "grace", label: "Muhlat" },
  { key: "expired", label: "Tugagan" },
];
const INVOICE_FILTERS = [
  { key: "all", label: "Barchasi" },
  { key: "pending", label: "Kutilmoqda" },
  { key: "paid", label: "To'langan" },
  { key: "refunded", label: "Qaytarilgan" },
  { key: "cancelled", label: "Bekor" },
] as const;

function Tile({ icon: Icon, value, label, hint, tone, href }: { icon: LucideIcon; value: string; label: string; hint?: string; tone?: "warning" | "danger"; href?: string }) {
  const body = (
    <>
      <IconTile icon={Icon} size="sm" tone="outline" />
      <div className="mt-3 font-display text-[20px] font-semibold leading-tight tracking-tight break-words text-fg tabular-nums xl:text-[22px]">{value}</div>
      <div className="mt-1.5 text-[12px] font-medium text-fg-3">{label}</div>
      {hint && <div className={cn("mt-0.5 text-[11px] font-medium", tone === "danger" ? "text-danger-text" : tone === "warning" ? "text-warning-text" : "text-fg-4")}>{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card card-hover block min-w-0 p-4">
      {body}
    </Link>
  ) : (
    <div className="card min-w-0 p-4">{body}</div>
  );
}

type Search = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/admin/obunalar"));
  if (user.role !== "admin") redirect("/kabinet");
  if (adminTwoFactorRequired() && !user.totpEnabled) redirect(ADMIN_2FA_PATH);

  const raw = await searchParams;
  const parsed = adminSubscriptionsQuerySchema.safeParse({ status: first(raw.status), q: first(raw.q), page: first(raw.page), invoices: first(raw.invoices) });
  const f = parsed.success ? parsed.data : {};
  const status = f.status ?? "all";
  const invoiceFilter = f.invoices ?? "all";
  const data = await getAdminSubscriptionData(f);
  const t = data.totals;
  const query = { status: status === "all" ? undefined : status, q: f.q || undefined, invoices: invoiceFilter === "all" ? undefined : invoiceFilter };
  const countFor: Record<AdminSubFilter, number> = { all: t.active + t.trial + t.grace + t.expired + t.off, active: t.active, trial: t.trial, grace: t.grace, expired: t.expired };

  return (
    <div className="container-x animate-fade-up">
      <Link href="/admin" className="mb-5 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
        <ArrowLeft size={14} /> Admin panel
      </Link>
      <header className="max-w-2xl">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-4">
          <CreditCard size={12} aria-hidden="true" /> Admin panel
        </p>
        <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">Mutaxassis obunalari</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-3">
          Narx: {formatPrice(t.price)} / oy. Obunachilar holati, to&apos;lovlar, qo&apos;lda uzaytirish va o&apos;tkazmalarni tasdiqlash. Barcha amallar audit jurnaliga yoziladi.
        </p>
      </header>

      {!t.enforced && (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-[var(--r-md)] border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-fg-2">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning-text" aria-hidden="true" />
          <p>
            <span className="font-semibold text-fg">Obuna talabi o&apos;chirilgan</span> (subscriptionEnforced = 0) — obunasiz mutaxassislar ham katalogda ko&apos;rinadi. Sozlamalar admin paneldagi «Platforma sozlamalari» bo&apos;limida.
          </p>
        </div>
      )}

      {/* Ko'rsatkichlar */}
      <section aria-label="Ko'rsatkichlar" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={Banknote} value={formatPrice(t.revenueMonth, { compact: true })} label="Bu oy tushum" hint={`Jami ${formatPrice(t.revenueTotal, { compact: true })}`} />
        <Tile icon={TrendingUp} value={formatPrice(t.mrr, { compact: true })} label="MRR (taxminiy)" hint="Joriy davrlar / oy" />
        <Tile icon={UserCheck} value={String(t.active)} label="Faol obuna" href={buildHref("/admin/obunalar", { status: "active" })} />
        <Tile icon={Clock3} value={String(t.trial)} label="Sinov muddatida" href={buildHref("/admin/obunalar", { status: "trial" })} />
        <Tile icon={UserX} value={String(t.expired)} label="Tugagan" hint={t.grace ? `+ ${t.grace} ta muhlatda` : undefined} tone={t.grace ? "warning" : undefined} href={buildHref("/admin/obunalar", { status: "expired" })} />
        <Tile
          icon={Hourglass}
          value={String(t.pendingManual)}
          label="O'tkazma kutmoqda"
          hint={t.pendingManual ? "Tasdiqlash kerak" : undefined}
          tone={t.pendingManual ? "warning" : undefined}
          href={`${buildHref("/admin/obunalar", { ...query, invoices: "pending" })}#hisoblar`}
        />
      </section>

      {/* Obunachilar */}
      <section aria-labelledby="subs-title" className="mt-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="subs-title" className="font-display text-[22px] font-semibold text-fg">
            Obunachilar <span className="text-fg-4 tabular-nums">{data.total}</span>
          </h2>
          <form action="/admin/obunalar" method="get" className="flex w-full gap-2 lg:w-auto" role="search">
            {query.status && <input type="hidden" name="status" value={query.status} />}
            <label htmlFor="subs-q" className="sr-only">
              Ism, email yoki slug bo&apos;yicha qidirish
            </label>
            <div className="relative min-w-0 flex-1 lg:w-72">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-4" aria-hidden="true" />
              <input id="subs-q" name="q" defaultValue={f.q ?? ""} placeholder="Ism, email yoki slug" className="field !pl-10" maxLength={80} />
            </div>
            <button type="submit" className="btn-ink inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold">
              Qidirish
            </button>
          </form>
        </div>

        <nav aria-label="Holat bo'yicha filtr" className="mt-4">
          <ScrollRow label="Obuna holati">
            <div className="segment">
              {FILTERS.map((x) => (
                <Link key={x.key} href={buildHref("/admin/obunalar", { ...query, status: x.key === "all" ? undefined : x.key, invoices: query.invoices })} className="segment-item inline-flex items-center gap-1.5" data-active={status === x.key} aria-current={status === x.key ? "page" : undefined}>
                  {x.label} <span className="tabular-nums opacity-70">{countFor[x.key]}</span>
                </Link>
              ))}
            </div>
          </ScrollRow>
        </nav>
        {f.q && (
          <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-fg-3">
            «{f.q}» bo&apos;yicha natijalar
            <Link href={buildHref("/admin/obunalar", { ...query, q: undefined })} className="inline-flex min-h-9 items-center gap-1 font-semibold text-accent-text">
              <X size={13} /> tozalash
            </Link>
          </p>
        )}

        {data.subscribers.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon={Search} title="Hech kim topilmadi" description="Filtr yoki qidiruvni o'zgartirib ko'ring." />
          </div>
        ) : (
          <div className="card mt-5 overflow-hidden">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-4 border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3 md:grid">
              <span>Mutaxassis</span>
              <span>Holat</span>
              <span>Muddat</span>
              <span>So&apos;nggi to&apos;lov</span>
              <span>Jami to&apos;langan</span>
              <span className="w-[120px] text-right">Amal</span>
            </div>
            <ul className="divide-y divide-line">
              {data.subscribers.map((r) => (
                <li key={r.specialistId} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center md:gap-4 md:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name} src={r.avatarUrl} size={38} decorative />
                    <div className="min-w-0">
                      <Link href={`/mutaxassislar/${r.slug}`} className="-my-1.5 block truncate py-1.5 text-[14px] font-semibold text-fg hover:text-accent-text">
                        {r.name}
                      </Link>
                      <p className="truncate text-[12px] text-fg-3">{r.email}</p>
                      {r.isBanned && <span className="text-[11px] font-semibold text-danger-text">Bloklangan</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:block">
                    <Badge tone={SUB_STATUS_TONE[r.status]}>{SUB_STATUS_LABEL[r.status]}</Badge>
                    <span className="text-[12px] text-fg-3 md:hidden">
                      {formatDate(r.status === "grace" ? r.graceUntil : r.until)} gacha
                    </span>
                  </div>
                  <div className="hidden text-[13px] md:block">
                    <p className="font-medium text-fg">{formatDate(r.status === "grace" ? r.graceUntil : r.until)}</p>
                    <p className="text-[12px] text-fg-3">{r.status === "expired" ? "Yashirilgan" : `${r.daysLeft} kun qoldi`}</p>
                  </div>
                  {/* Mobil: to'lov ma'lumoti va amal bitta qatorda; md+ — grid ustunlari (contents) */}
                  <div className="flex flex-wrap items-end justify-between gap-3 md:contents">
                    <div className="min-w-0 space-y-1 md:contents">
                      <div className="text-[13px]">
                        {r.lastPaidAt ? (
                          <>
                            <p className="font-medium text-fg tabular-nums">
                              <span className="font-normal text-fg-3 md:hidden">So&apos;nggi: </span>
                              {formatPrice(r.lastAmount)}
                            </p>
                            <p className="text-[12px] text-fg-3">{formatDate(r.lastPaidAt)}</p>
                          </>
                        ) : (
                          <p className="text-[12px] text-fg-4">{r.paid ? "Qo'lda belgilangan" : "To'lov yo'q"}</p>
                        )}
                      </div>
                      <div className="text-[13px] font-semibold text-fg tabular-nums">
                        <span className="font-normal text-fg-3 md:hidden">Jami: </span>
                        {formatPrice(r.totalPaid)}
                        {r.invoiceCount > 0 && <span className="ml-1 text-[11px] font-normal text-fg-4">({r.invoiceCount})</span>}
                      </div>
                    </div>
                    <div className="shrink-0 has-[[role=group]]:basis-full md:w-[120px] md:justify-self-end md:has-[[role=group]]:basis-auto">
                      <AdminExtendButton specialistId={r.specialistId} name={r.name} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.pages > 1 && <Pagination page={data.page} pages={data.pages} query={query} basePath="/admin/obunalar" className="mt-6" />}
      </section>

      {/* Hisoblar */}
      <section id="hisoblar" aria-labelledby="inv-title" className="mt-12 scroll-mt-28">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="inv-title" className="font-display text-[22px] font-semibold text-fg">
              Obuna to&apos;lovlari
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-3">So&apos;nggi 40 ta hisob. O&apos;tkazmalarni bank ko&apos;chirmasi bilan solishtirib tasdiqlang.</p>
          </div>
        </div>
        <nav aria-label="Hisob holati" className="mt-4">
          <ScrollRow label="Hisob holati bo'yicha filtr">
            <div className="segment">
              {INVOICE_FILTERS.map((x) => (
                <Link
                  key={x.key}
                  href={`${buildHref("/admin/obunalar", { ...query, invoices: x.key === "all" ? undefined : x.key })}#hisoblar`}
                  className="segment-item inline-flex items-center"
                  data-active={invoiceFilter === x.key}
                  aria-current={invoiceFilter === x.key ? "page" : undefined}
                >
                  {x.label}
                  {x.key === "pending" && t.pendingManual > 0 && <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-[11px] text-warning-text tabular-nums">{t.pendingManual}</span>}
                </Link>
              ))}
            </div>
          </ScrollRow>
        </nav>

        {data.invoices.length === 0 ? (
          <div className="mt-5">
            <EmptyState icon={CreditCard} title="Hisoblar yo'q" description="Bu filtr bo'yicha obuna to'lovlari topilmadi." />
          </div>
        ) : (
          <ul className="card mt-5 divide-y divide-line overflow-hidden">
            {data.invoices.map((i) => (
              <li key={i.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-5 md:px-5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-fg">
                    {i.specialistSlug ? (
                      <Link href={`/mutaxassislar/${i.specialistSlug}`} className="hover:text-accent-text">
                        {i.specialistName ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-fg-3">O&apos;chirilgan mutaxassis</span>
                    )}
                    <span className="text-fg-4">·</span>
                    <span className="tabular-nums">{formatPrice(i.amount)}</span>
                    <span className="font-normal text-fg-3">({monthsLabel(i.months)})</span>
                    <Badge tone={INVOICE_STATE_TONE[i.state]}>{INVOICE_STATE_LABEL[i.state]}</Badge>
                  </p>
                  <p className="mt-1 break-words text-[12px] text-fg-3">
                    <span className="font-mono">{i.number}</span> · {INVOICE_PROVIDER_LABEL[i.provider]} · {formatDateTime(i.paidAt ?? i.sentAt ?? i.createdAt)}
                    {i.periodStart && i.periodEnd ? ` · ${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}` : ""}
                    {i.providerTxnId && i.provider !== "manual" ? (
                      <span className="block font-mono text-[11px] text-fg-4">txn: {i.providerTxnId}</span>
                    ) : null}
                  </p>
                </div>
                <div className="shrink-0">
                  {i.specialistId ? <AdminInvoiceActions specialistId={i.specialistId} invoiceId={i.id} state={i.state} provider={i.provider} inFlight={i.inFlight} /> : <span className="text-[12px] text-fg-4">—</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
