import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Download, FileChartColumn } from "lucide-react";
import { PrintButton } from "@/components/payments/PrintButton";
import { PAYOUT_METHOD_LABEL, PROVIDER_LABEL } from "@/components/payments/tones";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { PAYOUT_STATE_LABEL, SITE } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatPrice } from "@/lib/utils";
import { currentMonth, loadMonthlyReport, parseMonth, recentMonths, shiftMonth } from "./report";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Oylik hisobot", robots: { index: false, follow: false } };

/**
 * Chop etishda sayt qobig'i (navbar, footer, tab-bar), kabinet navigatsiyasi va boshqaruv tugmalari yashiriladi —
 * faqat hisobot qoladi (/chek sahifasi bilan bir xil yondashuv).
 */
const PRINT_CSS = `
@media print {
  body > *:not(main), .no-print { display: none !important; }
  main { padding: 0 !important; }
  body { background: #fff !important; }
  .report { box-shadow: none !important; border: 1px solid #ddd !important; max-width: 100% !important; }
  .report, .report * { color: #111 !important; }
  .report .print-muted { color: #666 !important; }
  .report section { break-inside: avoid; }
}
@page { margin: 14mm; }
`;

function Money({ value, strong, negative }: { value: number; strong?: boolean; negative?: boolean }) {
  return <span className={cn("tabular-nums", strong ? "font-semibold text-fg" : "text-fg-2")}>{negative && value > 0 ? `− ${formatPrice(value)}` : formatPrice(value)}</span>;
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="font-display text-[16px] font-semibold text-fg">{children}</h2>
      {hint && <p className="print-muted text-[12px] text-fg-3">{hint}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="print-muted rounded-[var(--r-sm)] bg-surface-2 px-4 py-3 text-[13px] text-fg-3">{children}</p>;
}

/** Mutaxassisning oylik hisoboti (F29): bajarilgan buyurtmalar, yalpi tushum, komissiya, sof daromad, payoutlar, obuna to'lovlari */
export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<{ oy?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.oy) ? sp.oy[0] : sp.oy;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/kabinet/hisobot${raw ? `?oy=${encodeURIComponent(raw)}` : ""}`));
  const specialist = user.specialist;
  if (!specialist) redirect("/kabinet");

  const month = parseMonth(raw);
  const cur = currentMonth();
  const prev = shiftMonth(month, -1);
  const next = month.key === cur.key ? null : shiftMonth(month, 1);
  const months = recentMonths(24);
  const r = await loadMonthlyReport(specialist.id, month);
  const t = r.totals;
  const isCurrent = month.key === cur.key;

  const summary: Array<{ k: string; v: React.ReactNode; hint?: string; strong?: boolean }> = [
    { k: "Bajarilgan buyurtmalar", v: <span className="tabular-nums">{t.completedCount} ta</span> },
    { k: "Yalpi tushum", v: <Money value={t.gross} strong />, hint: "Mijozlar to'lagan, sizga o'tkazilgan summalar" },
    { k: "Platforma komissiyasi", v: <Money value={t.commission} negative /> },
    { k: "Sof daromad", v: <Money value={t.net} strong />, strong: true },
    { k: "Obuna to'lovlari", v: <Money value={t.subscriptionPaid} negative /> },
    { k: "Obunadan keyingi sof", v: <Money value={t.netAfterSubscription} strong />, strong: true },
    { k: "To'langan payoutlar", v: <Money value={t.payoutsPaid} />, hint: "Shu oyda kartangizga o'tkazilgan" },
  ];

  return (
    <div className="animate-fade-up">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ---------- Boshqaruv (chop etilmaydi) ---------- */}
      <div className="no-print mb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow">
              <FileChartColumn size={13} /> Moliya
            </span>
            <h1 className="display-xl mt-4 text-fg">
              Oylik <span className="accent-serif">hisobot</span>
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={`/kabinet/hisobot/csv?oy=${month.key}`}
              download
              className="press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg transition hover:border-fg hover:bg-fg/4"
            >
              <Download size={15} /> CSV
            </a>
            <PrintButton className="w-full sm:w-auto" />
          </div>
        </div>
        {/* Tez tanlov: joriy va o'tgan oy */}
        <div className="flex flex-wrap gap-1.5" aria-label="Tez tanlov">
          {[cur, shiftMonth(cur, -1)].map((m) => (
            <Link
              key={m.key}
              href={`/kabinet/hisobot?oy=${m.key}`}
              aria-current={m.key === month.key ? "page" : undefined}
              className={cn("press inline-flex min-h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold transition", m.key === month.key ? "btn-ink border-transparent" : "border-line text-fg-2 hover:border-fg hover:text-fg")}
            >
              {m.key === cur.key ? "Joriy oy" : "O'tgan oy"} · {m.label}
            </Link>
          ))}
        </div>

        {/* Oy tanlash: JS'siz ham ishlaydi (GET forma) */}
        <div className="card flex flex-wrap items-center gap-2 p-2.5">
          <Link
            href={`/kabinet/hisobot?oy=${prev.key}`}
            aria-label={`Oldingi oy: ${prev.label}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-2 text-fg transition hover:border-fg"
          >
            <ChevronLeft size={18} />
          </Link>
          <form action="/kabinet/hisobot" method="get" className="flex min-w-0 flex-1 items-center gap-2">
            <label htmlFor="report-month" className="sr-only">
              Oy
            </label>
            <select id="report-month" name="oy" defaultValue={month.key} className="field h-11 min-w-0 flex-1 !py-0">
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-ink inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-3 text-[14px] font-semibold sm:px-4">
              <Check size={17} className="sm:hidden" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Ko&apos;rsatish</span>
            </button>
          </form>
          {next ? (
            <Link
              href={`/kabinet/hisobot?oy=${next.key}`}
              aria-label={`Keyingi oy: ${next.label}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-2 text-fg transition hover:border-fg"
            >
              <ChevronRight size={18} />
            </Link>
          ) : (
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-fg-4 opacity-50">
              <ChevronRight size={18} />
            </span>
          )}
        </div>
      </div>

      {/* ---------- Hisobot ---------- */}
      <article className="report card-elevated p-5 sm:p-8" aria-labelledby="report-title">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-display text-[20px] font-semibold tracking-tight text-fg">
              {SITE.name}
              <span className="text-accent">.</span>
            </p>
            <p className="print-muted mt-1 text-[12px] text-fg-3">{SITE.tagline}</p>
          </div>
          <div className="sm:text-right">
            <p id="report-title" className="font-display text-[18px] font-semibold text-fg">
              {month.label}
            </p>
            <p className="print-muted text-[12px] text-fg-3">
              Oylik hisobot{isCurrent ? " · oy hali tugamagan" : ""} · tuzilgan {formatDateTime(Date.now())}
            </p>
          </div>
        </header>

        <div className="grid gap-1 border-b border-line py-5 text-[13px] sm:grid-cols-2">
          <div className="min-w-0">
            <p className="print-muted text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Mutaxassis</p>
            <p className="mt-1 truncate font-semibold text-fg">{user.name}</p>
            <p className="print-muted truncate text-[12px] text-fg-3">{specialist.title}</p>
          </div>
          <div className="mt-3 min-w-0 sm:mt-0 sm:text-right">
            <p className="print-muted text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Davr</p>
            <p className="mt-1 font-semibold text-fg">
              {formatDate(month.startMs)} — {formatDate(month.endMs - 1)}
            </p>
            <p className="print-muted text-[12px] text-fg-3">Toshkent vaqti bo&apos;yicha</p>
          </div>
        </div>

        {/* Xulosa */}
        <section className="py-5" aria-label="Xulosa">
          <dl className="divide-y divide-line rounded-[var(--r-md)] border border-line">
            {summary.map((row) => (
              <div key={row.k} className={cn("flex items-start justify-between gap-4 px-4 py-3", row.strong && "bg-surface-2")}>
                <dt className="min-w-0">
                  <span className={cn("block text-[14px]", row.strong ? "font-semibold text-fg" : "text-fg-2")}>{row.k}</span>
                  {row.hint && <span className="print-muted block text-[12px] text-fg-3">{row.hint}</span>}
                </dt>
                <dd className="shrink-0 text-right text-[14px]">{row.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Yakunlangan to'lovlar */}
        <section className="border-t border-line py-5">
          <SectionTitle hint={`${r.released.length} ta to'lov`}>Yakunlangan to&apos;lovlar (eskroudan o&apos;tgan)</SectionTitle>
          {r.released.length === 0 ? (
            <Empty>Bu oyda mutaxassisga o&apos;tkazilgan to&apos;lov yo&apos;q.</Empty>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="print-muted border-b border-line text-left text-[11px] font-bold uppercase tracking-[0.1em] text-fg-3">
                  <th scope="col" className="pb-2 pr-3 font-bold">
                    Buyurtma
                  </th>
                  <th scope="col" className="pb-2 text-right font-bold">
                    Sof summa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.released.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="py-2.5 pr-3">
                      <span className="block font-medium text-fg [overflow-wrap:anywhere]">{p.orderTitle}</span>
                      <span className="print-muted block text-[12px] text-fg-3">{p.releasedAt ? formatDate(p.releasedAt) : "—"}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="block font-semibold text-fg tabular-nums">{formatPrice(p.netAmount)}</span>
                      <span className="print-muted block whitespace-nowrap text-[12px] text-fg-3 tabular-nums">
                        {formatPrice(p.amount)} − {p.commissionPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Bajarilgan buyurtmalar */}
        <section className="border-t border-line py-5">
          <SectionTitle hint={`${r.completed.length} ta`}>Bajarilgan buyurtmalar</SectionTitle>
          {r.completed.length === 0 ? (
            <Empty>Bu oyda yakunlangan buyurtma yo&apos;q.</Empty>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {r.completed.map((o) => (
                <li key={o.id} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium text-fg [overflow-wrap:anywhere]">{o.title}</span>
                    <span className="print-muted block text-[12px] text-fg-3">
                      {o.completedAt ? formatDate(o.completedAt) : "—"}
                      {o.paymentState === "released" ? " · eskrou orqali" : o.paymentState === "paid" ? " · eskrouda" : " · platformadan tashqari"}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-fg tabular-nums">{o.amount ? formatPrice(o.amount) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Payoutlar */}
        <section className="border-t border-line py-5">
          <SectionTitle hint="So'ralgan yoki shu oyda to'langan">Pul chiqarish (payoutlar)</SectionTitle>
          {r.payouts.length === 0 ? (
            <Empty>Bu oyda pul chiqarish so&apos;rovi bo&apos;lmagan.</Empty>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {r.payouts.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium text-fg">
                      {PAYOUT_METHOD_LABEL[p.method]} · {PAYOUT_STATE_LABEL[p.state]}
                    </span>
                    <span className="print-muted block text-[12px] text-fg-3">
                      So&apos;ralgan {formatDate(p.createdAt)}
                      {p.processedAt && p.state === "paid" ? ` · to'langan ${formatDate(p.processedAt)}` : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", p.state === "rejected" ? "text-fg-3 line-through" : "text-fg")}>{formatPrice(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Obuna */}
        <section className="border-t border-line py-5">
          <SectionTitle hint={`${r.subscriptions.length} ta to'lov`}>Obuna to&apos;lovlari</SectionTitle>
          {r.subscriptions.length === 0 ? (
            <Empty>Bu oyda obuna to&apos;lovi bo&apos;lmagan.</Empty>
          ) : (
            <ul className="divide-y divide-line text-[13px]">
              {r.subscriptions.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-medium text-fg">
                      {s.months} oylik obuna · {PROVIDER_LABEL[s.provider]}
                    </span>
                    <span className="print-muted block text-[12px] text-fg-3">
                      {s.paidAt ? formatDate(s.paidAt) : "—"}
                      {s.periodStart && s.periodEnd ? ` · davr ${formatDate(s.periodStart)} — ${formatDate(s.periodEnd)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-fg tabular-nums">{formatPrice(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="print-muted border-t border-line pt-4 text-[11.5px] leading-relaxed text-fg-3">
          Hisobot ma&apos;lumot uchun tuzilgan va soliq hujjati hisoblanmaydi. Summalar so&apos;mda; komissiya to&apos;lov paytidagi darajangiz bo&apos;yicha muhrlangan. Har bir to&apos;lov
          bo&apos;yicha chekni «To&apos;lovlar» bo&apos;limidan olishingiz mumkin.
        </footer>
      </article>
    </div>
  );
}
