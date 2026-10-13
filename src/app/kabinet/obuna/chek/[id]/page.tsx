import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { PrintButton } from "@/components/payments/PrintButton";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { canViewInvoice, invoiceHref, loadInvoice } from "@/lib/subscriptions/billing";
import { INVOICE_PROVIDER_LABEL, INVOICE_STATE_LABEL, INVOICE_STATE_TONE, invoiceNumber, monthsLabel } from "@/lib/subscriptions/labels";
import { formatDate, formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Obuna cheki", robots: { index: false, follow: false } };

/** Chop etishda sayt qobig'i va kabinet navigatsiyasi yashiriladi — faqat chek (/chek bilan bir xil yondashuv) */
const PRINT_CSS = `
@media print {
  body > *:not(main), .no-print { display: none !important; }
  main { padding: 0 !important; }
  body { background: #fff !important; }
  .receipt { box-shadow: none !important; border: 1px solid #ddd !important; max-width: 100% !important; }
  .receipt, .receipt * { color: #111 !important; }
  .receipt .print-muted { color: #666 !important; }
}
@page { margin: 16mm; }
`;

/**
 * Obuna to'lovi cheki: to'lovchi (mutaxassis), reja, davr, summa (chegirma bilan), usul, tranzaksiya ID.
 * Faqat hisob egasi yoki admin; pul harakati bo'lgan (paid / refunded) hisoblar uchun — aks holda obuna sahifasiga.
 */
export default async function SubscriptionReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/kabinet/obuna/chek/${id}`));

  const inv = await loadInvoice(id);
  if (!inv || !canViewInvoice(inv, { id: user.id, role: user.role, specialistId: user.specialist?.id ?? null })) notFound();
  if (inv.state !== "paid" && inv.state !== "refunded") redirect(invoiceHref(inv.id));

  const payer = inv.specialistId
    ? await db.query.specialists.findFirst({ where: eq(specialists.id, inv.specialistId), columns: { title: true, slug: true }, with: { user: { columns: { name: true, email: true } } } })
    : null;
  const no = invoiceNumber(inv.id);
  const issuedAt = inv.paidAt ?? inv.createdAt;
  const unitPrice = typeof inv.meta.unitPrice === "number" ? inv.meta.unitPrice : null;
  const discountPct = typeof inv.meta.discountPct === "number" ? inv.meta.discountPct : 0;
  const full = unitPrice ? unitPrice * inv.months : null;
  const discount = full && full > inv.amount ? full - inv.amount : 0;

  const rows: Array<{ k: string; v: string; mono?: boolean }> = [
    { k: "Xizmat", v: `Mutaxassis obunasi — ${monthsLabel(inv.months)}` },
    ...(inv.periodStart && inv.periodEnd ? [{ k: "Davr", v: `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}` }] : []),
    { k: "To'lov usuli", v: INVOICE_PROVIDER_LABEL[inv.provider] },
    { k: "Tranzaksiya ID", v: inv.providerTxnId ?? "—", mono: true },
    { k: "To'lov sanasi", v: formatDateTime(issuedAt) },
    ...(inv.state === "refunded" && inv.cancelTime ? [{ k: "Qaytarilgan sana", v: formatDateTime(inv.cancelTime) }] : []),
  ];

  return (
    <div className="animate-fade-up">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/kabinet/obuna" className="inline-flex min-h-10 items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
          <ArrowLeft size={14} /> Obunaga qaytish
        </Link>
        <PrintButton />
      </div>

      <article className="receipt card-elevated mx-auto max-w-2xl p-6 sm:p-10" aria-labelledby="receipt-title">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-[22px] font-semibold tracking-tight text-fg">
              {SITE.name}
              <span className="text-accent">.</span>
            </p>
            <p className="print-muted mt-1 text-[12px] text-fg-3">{SITE.tagline}</p>
          </div>
          <div className="sm:text-right">
            <h1 id="receipt-title" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-fg">
              <FileText size={15} className="text-accent" /> Obuna to&apos;lovi cheki
            </h1>
            <p className="mt-1 font-mono text-[13px] text-fg-2">{no}</p>
            <p className="print-muted text-[12px] text-fg-3">{formatDateTime(issuedAt)}</p>
          </div>
        </header>

        <div className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <p className="print-muted text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">To&apos;lovchi (mutaxassis)</p>
            <p className="mt-1.5 text-[15px] font-semibold text-fg">{payer?.user.name ?? "—"}</p>
            {payer && <p className="print-muted break-all text-[12px] text-fg-3">{payer.user.email}</p>}
            {payer && <p className="print-muted text-[12px] text-fg-3">{payer.title}</p>}
          </div>
          <div>
            <p className="print-muted text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Qabul qiluvchi</p>
            <p className="mt-1.5 text-[15px] font-semibold text-fg">{SITE.name} platformasi</p>
            <p className="print-muted text-[12px] text-fg-3">Mutaxassis obunasi xizmati</p>
          </div>
        </div>

        <dl className="divide-y divide-line border-b border-line text-[14px]">
          {rows.map((r) => (
            <div key={r.k} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="print-muted shrink-0 text-fg-3">{r.k}</dt>
              <dd className={r.mono ? "max-w-[60%] break-all text-right font-mono text-[13px] text-fg" : "max-w-[60%] text-right font-medium text-fg"}>{r.v}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-5 space-y-2 text-[14px]">
          {full && discount > 0 ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <dt className="print-muted text-fg-3">
                  {formatPrice(unitPrice)} × {inv.months} oy
                </dt>
                <dd className="print-muted shrink-0 whitespace-nowrap text-fg-3 tabular-nums">{formatPrice(full)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="print-muted text-fg-3">Chegirma ({discountPct}%)</dt>
                <dd className="print-muted shrink-0 whitespace-nowrap text-fg-3 tabular-nums">− {formatPrice(discount)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
            <dt className="font-semibold text-fg">Jami to&apos;langan</dt>
            <dd className="shrink-0 whitespace-nowrap font-display text-[20px] font-semibold text-fg tabular-nums sm:text-[22px]">{formatPrice(inv.amount)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] bg-surface-2 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-fg-2">
            <ShieldCheck size={15} className={inv.state === "refunded" ? "text-danger-text" : "text-success"} />
            {inv.state === "refunded" ? "To'lov qaytarilgan — obuna muddati qisqartirildi" : "Obuna to'langan va faollashtirilgan"}
          </span>
          <Badge tone={INVOICE_STATE_TONE[inv.state]}>{INVOICE_STATE_LABEL[inv.state]}</Badge>
        </div>

        <p className="print-muted mt-6 text-[11px] leading-relaxed text-fg-4">
          Ushbu chek {SITE.name} platformasi tomonidan elektron shaklda yaratilgan va mutaxassis obunasi to&apos;lovini tasdiqlaydi. Hisob ID: <span className="break-all font-mono">{inv.id}</span>.
        </p>
      </article>
    </div>
  );
}
