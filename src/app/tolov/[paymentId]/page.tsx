import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BadgePercent, Handshake, Lock, ShieldCheck, Wallet, Zap } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { CheckoutPanel } from "@/components/payments/CheckoutPanel";
import { PAYMENT_TONE } from "@/components/payments/tones";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { PAYMENT_STATE_LABEL } from "@/lib/constants";
import { availableProviders, siteOrigin } from "@/lib/payments/config";
import { canViewPayment, loadPaymentDetail, toPaymentDto } from "@/lib/payments/dto";
import { getSettings } from "@/lib/payments/settings";
import { formatPrice, formatUsd } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "To'lov", robots: { index: false, follow: false } };

type Params = Promise<{ paymentId: string }>;

export default async function CheckoutPage({ params }: { params: Params }) {
  const { paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath(`/tolov/${paymentId}`));

  const p = await loadPaymentDetail(paymentId);
  if (!p || !canViewPayment(p, { sub: user.id, role: user.role })) notFound();
  if (p.state === "paid" || p.state === "released" || p.state === "refunded" || p.state === "cancelled") redirect(`/tolov/natija?payment=${paymentId}`);

  const dto = await toPaymentDto(p, siteOrigin(await headers()));
  const providers = await availableProviders();
  // Dollar ekvivalenti (F99) — faqat ma'lumot uchun, to'lov so'mda
  const usd = formatUsd(dto.amount, (await getSettings()).usdRate);
  const isPayer = p.clientId === user.id || user.role === "admin";

  const steps = [
    { icon: Wallet, t: "Siz to'laysiz", d: "Pul platformaning eskrou hisobida saqlanadi." },
    { icon: Handshake, t: "Mutaxassis ishlaydi", d: "Natijani «Buyurtmalar»da ko'rasiz va qabul qilasiz." },
    { icon: ShieldCheck, t: "Pul o'tadi", d: `Qabul qilgach ${formatPrice(dto.netAmount)} mutaxassisga, ${dto.commissionPct}% platformaga.` },
  ];

  return (
    <div className="container-x animate-fade-up">
      <Link href={`/kabinet/buyurtmalar?id=${dto.orderId}`} className="mb-5 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-fg-3 transition hover:text-fg">
        <ArrowLeft size={14} /> Buyurtmaga qaytish
      </Link>

      <header className="mb-6 max-w-2xl sm:mb-8">
        <span className="eyebrow">
          <Lock size={13} className="text-accent" /> Xavfsiz to'lov
        </span>
        <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[44px]">
          Eskrou <span className="accent-serif text-accent">to'lov</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-2 sm:text-[16px]">
          «{dto.orderTitle}» uchun <span className="font-semibold text-fg">{formatPrice(dto.amount)}</span>. Pul ish qabul qilingunga qadar platformada turadi — mutaxassis uni oldindan ololmaydi.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7 xl:col-span-8">
          <CheckoutPanel payment={dto} providers={providers} isPayer={isPayer} />
        </div>

        {/* Xulosa */}
        <aside className="lg:col-span-5 xl:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-28">
            <div className="card-elevated p-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Kimga</p>
              <div className="flex items-center gap-3.5">
                <Avatar name={dto.specialist.name} src={dto.specialist.avatarUrl} size={52} decorative />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-fg">{dto.specialist.name}</p>
                  <p className="truncate text-[13px] text-fg-2">{dto.specialist.title}</p>
                  <Link href={`/mutaxassislar/${dto.specialist.slug}`} className="-my-2 -mx-1 inline-flex min-h-10 items-center px-1 text-[12px] font-semibold text-accent-text">
                    Profilni ko'rish
                  </Link>
                </div>
              </div>

              <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-[14px]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-fg-3">Buyurtma</dt>
                  <dd className="max-w-[60%] text-right font-medium text-fg">{dto.orderTitle}</dd>
                </div>
                {dto.urgentFee ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-fg-3">Asosiy narx</dt>
                      <dd className="font-medium text-fg tabular-nums">{formatPrice(dto.amount - dto.urgentFee)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="inline-flex items-center gap-1.5 text-fg-3">
                        <Zap size={14} className="text-warning-text" /> Shoshilinch ustama
                      </dt>
                      <dd className="font-medium text-fg tabular-nums">{formatPrice(dto.urgentFee)}</dd>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-fg-3">Kelishilgan narx</dt>
                    <dd className="font-medium text-fg tabular-nums">{formatPrice(dto.amount)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="inline-flex items-center gap-1.5 text-fg-3">
                    <BadgePercent size={14} /> Xizmat haqi (platforma) {dto.commissionPct}%
                  </dt>
                  <dd className="text-fg-2 tabular-nums">{formatPrice(dto.commissionAmount)}</dd>
                </div>
                <p className="text-[12px] leading-snug text-fg-3">Xizmat haqi summaga kiritilgan — mutaxassis {formatPrice(dto.netAmount)} oladi, siz qo'shimcha to'lamaysiz.</p>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                  <dt className="font-semibold text-fg">Jami to'lov</dt>
                  <dd className="text-right">
                    <span className="block font-display text-[22px] font-semibold text-fg tabular-nums">{formatPrice(dto.amount)}</span>
                    {usd && <span className="block text-[12px] text-fg-3 tabular-nums">{usd}</span>}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-between text-[12px] text-fg-3">
                <span>To'lov holati</span>
                <Badge tone={PAYMENT_TONE[dto.state]}>{PAYMENT_STATE_LABEL[dto.state]}</Badge>
              </div>
            </div>

            <div className="card p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Eskrou qanday ishlaydi</p>
              <ol className="mt-3 space-y-3">
                {steps.map((s, i) => (
                  <li key={s.t} className="flex items-start gap-3">
                    <span className="icon-tile-outline icon-tile-sm text-fg-2">
                      <s.icon size={14} />
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-fg">
                        {i + 1}. {s.t}
                      </p>
                      <p className="text-[12px] leading-snug text-fg-3">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
