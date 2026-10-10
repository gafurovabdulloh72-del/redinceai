import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgePercent, Clock3, Handshake, Hourglass, Landmark, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";
import { Avatar, Badge, IconTile } from "@/components/ui";
import { PayButton } from "@/components/payments/PayButton";
import { PaymentsTable, type PaymentRow } from "@/components/payments/PaymentsTable";
import { PayoutRequestForm } from "@/components/payments/PayoutRequestForm";
import { PAYOUT_METHOD_LABEL, PAYOUT_TONE } from "@/components/payments/tones";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { PAYOUT_STATE_LABEL } from "@/lib/constants";
import { availableProviders } from "@/lib/payments/config";
import { findOpenPayout, getSpecialistBalance, listAwaitingOrdersForClient, listPaymentsForClient, listPaymentsForSpecialist, listPayoutsForSpecialist } from "@/lib/payments/queries";
import { getSettings } from "@/lib/payments/settings";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "To'lovlar" };

function Tile({ icon: Icon, value, label, hint, emphasis }: { icon: LucideIcon; value: string; label: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className={cn("card p-4 sm:p-5", emphasis && "card-elevated border-accent/30")}>
      <div className="flex items-start justify-between gap-3">
        <IconTile icon={Icon} tone={emphasis ? "soft" : "outline"} size="sm" />
      </div>
      <div className={cn("mt-4 font-display text-[22px] font-semibold leading-none tracking-tight sm:text-[26px]", emphasis ? "text-accent" : "text-fg")}>{value}</div>
      <div className="mt-2 text-[12px] font-medium text-fg-3">{label}</div>
      {hint && <div className="mt-1 text-[12px] text-fg-4">{hint}</div>}
    </div>
  );
}

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectPath("/kabinet/tolovlar"));

  const sp = user.specialist;
  const [settings, clientPayments, awaiting, specialistData] = await Promise.all([
    getSettings(),
    listPaymentsForClient(user.id),
    listAwaitingOrdersForClient(user.id),
    sp
      ? Promise.all([getSpecialistBalance(sp.id), listPaymentsForSpecialist(sp.id), listPayoutsForSpecialist(sp.id), findOpenPayout(sp.id)]).then(([balance, payments, payouts, open]) => ({ balance, payments, payouts, open }))
      : Promise.resolve(null),
  ]);
  const providers = availableProviders();

  const specialistRows: PaymentRow[] = (specialistData?.payments ?? []).map((p) => ({
    id: p.id,
    orderId: p.orderId,
    orderTitle: p.order.title,
    counterpart: p.client.name,
    provider: p.provider,
    state: p.state,
    amount: p.amount,
    commissionPct: p.commissionPct,
    commissionAmount: p.commissionAmount,
    netAmount: p.netAmount,
    createdAt: p.createdAt.getTime(),
    paidAt: p.paidAt?.getTime() ?? null,
    releasedAt: p.releasedAt?.getTime() ?? null,
  }));
  const clientRows: PaymentRow[] = clientPayments.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    orderTitle: p.order.title,
    counterpart: p.specialist.user.name,
    provider: p.provider,
    state: p.state,
    amount: p.amount,
    commissionPct: p.commissionPct,
    commissionAmount: p.commissionAmount,
    netAmount: p.netAmount,
    createdAt: p.createdAt.getTime(),
    paidAt: p.paidAt?.getTime() ?? null,
    releasedAt: p.releasedAt?.getTime() ?? null,
  }));

  const showClient = !sp || clientRows.length > 0 || awaiting.length > 0;

  return (
    <div className="animate-fade-up">
      <header className="mb-6 sm:mb-8">
        <span className="eyebrow">
          <Wallet size={13} className="text-accent" /> Kabinet
        </span>
        <h1 className="display-xl mt-4 text-[32px] text-fg sm:text-[40px]">
          {sp ? (
            <>
              To'lovlar va <span className="accent-serif text-accent">balans</span>
            </>
          ) : (
            <>
              Mening <span className="accent-serif text-accent">to'lovlarim</span>
            </>
          )}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-fg-2">
          {sp
            ? `Mijoz to'lovi eskrouda turadi; ish qabul qilingach ${100 - settings.commissionPct}% balansingizga tushadi (${settings.commissionPct}% — platforma xizmat haqi). Balansni istalgan vaqt chiqarib olishingiz mumkin.`
            : "Buyurtmalar uchun to'lovlar eskrou orqali: pul ish qabul qilingunga qadar platformada saqlanadi."}
        </p>
      </header>

      {/* ---------- Mutaxassis: balans + pul chiqarish ---------- */}
      {sp && specialistData && (
        <section className="space-y-5" aria-labelledby="balans">
          <h2 id="balans" className="sr-only">
            Balans
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Tile icon={Wallet} value={formatPrice(specialistData.balance.available, { compact: specialistData.balance.available >= 10_000_000 })} label="Chiqarish mumkin" hint={specialistData.balance.pendingPayouts > 0 ? `${formatPrice(specialistData.balance.pendingPayouts, { compact: true })} so'rovda` : undefined} emphasis />
            <Tile icon={ShieldCheck} value={formatPrice(specialistData.balance.escrow, { compact: specialistData.balance.escrow >= 10_000_000 })} label="Eskrouda" hint="Mijoz qabul qilgach tushadi" />
            <Tile icon={Handshake} value={formatPrice(specialistData.balance.released, { compact: specialistData.balance.released >= 10_000_000 })} label="Jami ishlab topilgan" hint={`Xizmat haqi ${formatPrice(specialistData.balance.commission, { compact: true })}`} />
            <Tile icon={Landmark} value={formatPrice(specialistData.balance.paidOut, { compact: specialistData.balance.paidOut >= 10_000_000 })} label="Chiqarilgan" />
          </div>

          <div className="grid gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PayoutRequestForm available={specialistData.balance.available} minPayout={settings.minPayout} hasOpen={Boolean(specialistData.open)} />
            </div>
            <div className="card p-5 sm:p-6 lg:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Qanday ishlaydi</p>
              <ol className="mt-3 space-y-3.5">
                {[
                  { icon: BadgePercent, t: "Narx belgilaysiz", d: "Qabul qilingan buyurtmaga narx qo'yasiz — mijozga to'lov havolasi boradi." },
                  { icon: ShieldCheck, t: "Mijoz eskrouga to'laydi", d: "Pul platformada turadi. Ishni xotirjam bajarasiz." },
                  { icon: Handshake, t: "Mijoz qabul qiladi", d: `Sof summa (${100 - settings.commissionPct}%) balansingizga tushadi.` },
                  { icon: Landmark, t: "Pul chiqarasiz", d: `Kartaga yoki bankka — minimal ${formatPrice(settings.minPayout, { compact: true })}.` },
                ].map((s, i) => (
                  <li key={s.t} className="flex items-start gap-3">
                    <IconTile icon={s.icon} tone="outline" size="sm" />
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

          {/* Payout tarixi */}
          {specialistData.payouts.length > 0 && (
            <div>
              <h3 className="mb-3 px-1 font-display text-[17px] font-semibold text-fg">Pul chiqarish tarixi</h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {specialistData.payouts.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg tabular-nums">{formatPrice(p.amount)}</p>
                      <p className="truncate text-[12px] text-fg-3">
                        {PAYOUT_METHOD_LABEL[p.method]} · {p.details}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:text-right">
                      <Badge tone={PAYOUT_TONE[p.state]}>{PAYOUT_STATE_LABEL[p.state]}</Badge>
                      <span className="text-[12px] text-fg-4">{formatDateTime(p.processedAt ?? p.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-3 px-1 font-display text-[17px] font-semibold text-fg">Kelib tushgan to'lovlar</h3>
            <PaymentsTable rows={specialistRows} role="specialist" emptyText="Mijoz buyurtma uchun to'laganida shu yerda ko'rinadi. Avval qabul qilingan buyurtmaga narx belgilang." />
          </div>
        </section>
      )}

      {/* ---------- Mijoz: to'lov kutilayotgan buyurtmalar + tarix ---------- */}
      {showClient && (
        <section className={cn("space-y-5", sp && "mt-10 border-t border-line pt-8")} aria-labelledby="mijoz-tolovlari">
          {sp && (
            <h2 id="mijoz-tolovlari" className="font-display text-[20px] font-semibold text-fg">
              Mijoz sifatida to'lovlarim
            </h2>
          )}

          {awaiting.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 px-1 font-display text-[17px] font-semibold text-fg">
                <Hourglass size={16} className="text-warning" /> To'lov kutilmoqda
              </h3>
              <ul className="grid items-start gap-3 md:grid-cols-2">
                {awaiting.map((o) => (
                  <li key={o.id} className="card flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={o.specialist.user.name} src={o.specialist.user.avatarUrl} size={40} decorative />
                      <div className="min-w-0 flex-1">
                        <Link href={`/kabinet/buyurtmalar?id=${o.id}`} className="block truncate text-[15px] font-semibold text-fg hover:text-accent">
                          {o.title}
                        </Link>
                        <p className="truncate text-[12px] text-fg-3">
                          {o.specialist.user.name} · {o.specialist.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Narx</p>
                        <p className="font-display text-[18px] font-semibold text-fg tabular-nums">{formatPrice(o.amount ?? 0)}</p>
                      </div>
                      <PayButton orderId={o.id} amount={o.amount ?? 0} providers={providers} label="To'lash" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-3 flex items-center gap-2 px-1 font-display text-[17px] font-semibold text-fg">
              <Clock3 size={16} className="text-fg-3" /> To'lovlar tarixi
            </h3>
            <PaymentsTable rows={clientRows} role="client" emptyText="Mutaxassis narx belgilagach «Buyurtmalar»da «To'lash» tugmasi chiqadi." />
          </div>

          {!sp && clientRows.length === 0 && awaiting.length === 0 && (
            <Link href="/mutaxassislar" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-accent">
              Mutaxassis topish <ArrowRight size={15} />
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
