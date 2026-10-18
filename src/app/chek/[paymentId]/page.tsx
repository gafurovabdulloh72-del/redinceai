import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { PrintButton } from "@/components/payments/PrintButton";
import { PAYMENT_TONE, PROVIDER_LABEL } from "@/components/payments/tones";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { ORDER_STATUS_LABEL, PAYMENT_STATE_LABEL, SITE } from "@/lib/constants";
import { canViewPayment, loadPaymentDetail } from "@/lib/payments/dto";
import { formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "To'lov cheki", robots: { index: false, follow: false } };

/**
 * Chop etishda sayt qobig'i (navbar, footer, mobil tab-bar, orqaga tugmasi) yashiriladi — faqat chek qoladi.
 * Selektor body'ning bevosita bolalari bilan cheklangan: chekning ichidagi <header> (platforma nomi, raqam) qoladi.
 */
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
 * To'lov cheki / hisob-faktura (E59/F20): to'lovchi, mutaxassis, buyurtma, summa, komissiya, sof summa,
 * provayder, tranzaksiya ID, sanalar. Faqat mijoz, mutaxassis egasi yoki admin; pul harakati bo'lgan
 * (paid / released / refunded) to'lovlar uchun — aks holda natija sahifasiga.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/chek/${paymentId}`));

  const p = await loadPaymentDetail(paymentId);
  if (!p || !canViewPayment(p, { sub: user.id, role: user.role })) notFound();
  if (p.state !== "paid" && p.state !== "released" && p.state !== "refunded") redirect(`/tolov/natija?payment=${paymentId}`);

  const isSpecialist = p.specialist.userId === user.id && user.role !== "admin";
  const no = `RD-${p.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const issuedAt = p.paidAt ?? p.createdAt;

  const rows: Array<{ k: string; v: string; strong?: boolean }> = [
    { k: "Buyurtma", v: p.order.title },
    { k: "Buyurtma holati", v: ORDER_STATUS_LABEL[p.order.status] },
    { k: "To'lov usuli", v: PROVIDER_LABEL[p.provider] },
    { k: "Tranzaksiya ID", v: p.providerTxnId ?? "—" },
    { k: "To'lov sanasi", v: formatDateTime(issuedAt) },
    ...(p.releasedAt ? [{ k: "Mutaxassisga o'tkazildi", v: formatDateTime(p.releasedAt) }] : []),
    ...(p.state === "refunded" && p.cancelTime ? [{ k: "Qaytarilgan sana", v: formatDateTime(p.cancelTime) }] : []),
  ];

  return (
    <div className="container-x animate-fade-up">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={isSpecialist ? "/kabinet/tolovlar" : `/kabinet/buyurtmalar?id=${p.orderId}`} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
          <ArrowLeft size={14} /> {isSpecialist ? "To'lovlarga qaytish" : "Buyurtmaga qaytish"}
        </Link>
        <PrintButton fileName={`chek-${no}`} />
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
              <FileText size={15} className="text-accent" /> To'lov cheki
            </h1>
            <p className="mt-1 font-mono text-[13px] text-fg-2">{no}</p>
            <p className="print-muted text-[12px] text-fg-3">{formatDateTime(issuedAt)}</p>
          </div>
        </header>

        <div className="grid gap-6 border-b border-line py-6 sm:grid-cols-2">
          <div>
            <p className="print-muted text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">To'lovchi (mijoz)</p>
            <p className="mt-1.5 text-[15px] font-semibold text-fg">{p.client.name}</p>
          </div>
          <div>
            <p className="print-muted text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Ijrochi (mutaxassis)</p>
            <p className="mt-1.5 text-[15px] font-semibold text-fg">{p.specialist.user.name}</p>
            <p className="print-muted text-[12px] text-fg-3">{p.specialist.title}</p>
          </div>
        </div>

        <dl className="divide-y divide-line border-b border-line text-[14px]">
          {rows.map((r) => (
            <div key={r.k} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="print-muted text-fg-3">{r.k}</dt>
              <dd className={r.k === "Tranzaksiya ID" ? "max-w-[60%] break-all text-right font-mono text-[13px] text-fg" : "max-w-[60%] text-right font-medium text-fg"}>{r.v}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-5 space-y-2 text-[14px]">
          {p.order.urgent && p.order.urgentFee ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <dt className="print-muted text-fg-3">Asosiy narx</dt>
                <dd className="print-muted shrink-0 whitespace-nowrap text-fg-3 tabular-nums">{formatPrice(p.amount - p.order.urgentFee)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="print-muted text-fg-3">Shoshilinch ustama</dt>
                <dd className="print-muted shrink-0 whitespace-nowrap text-fg-3 tabular-nums">+ {formatPrice(p.order.urgentFee)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <dt className="text-fg-2">Kelishilgan narx (mijoz to'ladi)</dt>
            <dd className="shrink-0 whitespace-nowrap font-medium text-fg tabular-nums">{formatPrice(p.amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="print-muted text-fg-3">Platforma xizmat haqi ({p.commissionPct}%)</dt>
            <dd className="print-muted shrink-0 whitespace-nowrap text-fg-3 tabular-nums">− {formatPrice(p.commissionAmount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
            <dt className="font-semibold text-fg">Mutaxassisga (sof summa)</dt>
            {/* Summa raqam va "so'm" orasida bo'linmasin (390px'da yorliq ikki qatorga tushadi, summa — yo'q) */}
            <dd className="shrink-0 whitespace-nowrap font-display text-[20px] font-semibold text-fg tabular-nums sm:text-[22px]">{formatPrice(p.netAmount)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-surface-2 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-fg-2">
            <ShieldCheck size={15} className="text-success" />
            {p.state === "released" ? "Ish qabul qilindi — pul mutaxassisga o'tkazildi" : p.state === "refunded" ? "To'lov mijozga qaytarildi" : "Pul eskrouda — ish qabul qilingach mutaxassisga o'tadi"}
          </span>
          <Badge tone={PAYMENT_TONE[p.state]}>{PAYMENT_STATE_LABEL[p.state]}</Badge>
        </div>

        <p className="print-muted mt-6 text-[11px] leading-relaxed text-fg-4">
          Ushbu chek {SITE.name} platformasi tomonidan elektron shaklda yaratilgan va eskrou to'lovini tasdiqlaydi. To'lov ID: <span className="font-mono">{p.id}</span>. Buyurtma ID: <span className="font-mono">{p.orderId}</span>.
        </p>
      </article>
    </div>
  );
}
