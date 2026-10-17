"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, Check, CheckCircle2, Copy, Hourglass, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PROVIDER_ICON } from "@/components/payments/PayButton";
import { ReceiptUpload } from "@/components/payments/ReceiptUpload";
import { PAYMENT_PROVIDERS, type PaymentProvider } from "@/lib/constants";
import { invoiceNumber, type InvoiceView, type PlanView } from "@/lib/subscriptions/labels";
import { cn, formatDate, formatPrice } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };
interface CheckoutData {
  invoiceId: string;
  provider: PaymentProvider;
  months: number;
  amount: number;
  state: InvoiceView["state"];
  redirectUrl: string | null;
  manual: { card: string; name: string } | null;
}

const PROVIDER_HINT: Record<PaymentProvider, string> = {
  payme: "Payme ilovasi yoki karta",
  click: "Click ilovasi yoki karta",
  manual: "Karta o'tkazmasi, admin tasdiqlaydi",
};

/** Eng foydali reja (eng katta chegirma) belgisi */
function bestMonths(plans: PlanView[]): number | null {
  const best = plans.reduce<PlanView | null>((b, p) => (!b || p.discountPct > b.discountPct ? p : b), null);
  return best && best.discountPct > 0 ? best.months : null;
}

/**
 * Obuna rejasi + to'lov usuli → POST /api/subscription/checkout →
 *  Payme/Click: provayder sahifasiga yo'naltirish (qaytish: /kabinet/obuna?invoice=…)
 *  O'tkazma: rekvizitlar + «To'ladim» (PATCH /api/subscription/invoices/[id] {action:'sent'}) → admin tasdiqlaydi
 * openManual — avval yaratilgan, hali «To'ladim» bosilmagan o'tkazma hisobi (sahifa yangilansa ham davom etadi).
 */
export function SubscriptionCheckout({
  plans,
  providers,
  manual,
  untilByMonths,
  openManual,
  pendingManual,
  ctaLabel,
}: {
  plans: PlanView[];
  providers: PaymentProvider[];
  manual: { card: string; name: string } | null;
  /** To'lansa obuna qaysi sanagacha bo'ladi (ms) — oylar bo'yicha */
  untilByMonths: Record<number, number>;
  openManual: InvoiceView | null;
  pendingManual: InvoiceView | null;
  ctaLabel: string;
}) {
  const router = useRouter();
  const best = bestMonths(plans);
  const [months, setMonths] = useState<number>(openManual?.months ?? plans[0]?.months ?? 1);
  const [provider, setProvider] = useState<PaymentProvider>(openManual ? "manual" : (providers[0] ?? "payme"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualInvoice, setManualInvoice] = useState<{ id: string; amount: number; months: number } | null>(
    openManual ? { id: openManual.id, amount: openManual.amount, months: openManual.months } : null,
  );
  const [copied, setCopied] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const plan = plans.find((p) => p.months === months) ?? plans[0];
  const until = untilByMonths[months];
  // Tanlov o'zgarsa — ochilgan o'tkazma rekvizitlari boshqa summaga tegishli, yopiladi
  const showManual = provider === "manual" && manualInvoice && manualInvoice.months === months;

  const checkout = async () => {
    if (busy || !plan) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months, provider }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<CheckoutData> | null;
      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        return;
      }
      const d = json.data;
      if (d.provider === "manual") {
        if (d.state === "pending") {
          setNotice("Bu reja bo'yicha o'tkazmangiz allaqachon tekshirilmoqda — administrator tasdiqlashini kuting.");
          router.refresh();
          return;
        }
        setManualInvoice({ id: d.invoiceId, amount: d.amount, months: d.months });
        return;
      }
      if (d.redirectUrl) {
        window.location.assign(d.redirectUrl);
        return;
      }
      setError("To'lov havolasi tuzilmadi. Boshqa usulni tanlang.");
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const markSent = async () => {
    if (busy || !manualInvoice) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/subscription/invoices/${encodeURIComponent(manualInvoice.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sent", receiptUrl }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<InvoiceView> | null;
      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        return;
      }
      router.replace(`/kabinet/obuna?invoice=${encodeURIComponent(manualInvoice.id)}`);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const copyCard = async () => {
    if (!manual) return;
    try {
      await navigator.clipboard.writeText(manual.card.replace(/\s/g, ""));
      setCopied(true);
    } catch {
      /* clipboard mavjud emas */
    }
  };

  return (
    <div className="space-y-4">
      {/* Rejalar */}
      <div role="radiogroup" aria-label="Obuna muddati" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {plans.map((p) => {
          const active = p.months === months;
          return (
            <button
              key={p.months}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => {
                setMonths(p.months);
                setError(null);
              }}
              className={cn(
                "relative flex min-h-[132px] flex-col rounded-[var(--r-md)] border p-4 text-left transition disabled:opacity-60",
                active ? "border-fg bg-surface shadow-[var(--shadow-1)]" : "border-line bg-surface-2 hover:border-line-2",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-fg-2">{p.months} oy</span>
                {p.discountPct > 0 && <span className="rounded-full bg-accent-strong px-2 py-0.5 text-[11px] font-bold text-white">−{p.discountPct}%</span>}
              </span>
              <span className="mt-2 whitespace-nowrap font-display text-[19px] font-semibold leading-tight tracking-tight text-fg tabular-nums min-[400px]:text-[21px] sm:text-[24px]">{formatPrice(p.monthly)}</span>
              <span className="text-[12px] text-fg-3">oyiga</span>
              <span className="mt-auto pt-2 text-[12px] leading-snug text-fg-2">
                Jami <span className="font-semibold text-fg tabular-nums">{formatPrice(p.price)}</span>
                {p.savings > 0 && <span className="block text-success-text">{formatPrice(p.savings)} tejaysiz</span>}
              </span>
              {best === p.months && (
                <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-fg">
                  <Sparkles size={10} aria-hidden="true" /> Eng foydali
                </span>
              )}
              {active && (
                <span className="absolute right-3 bottom-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-ink-fg" aria-hidden="true">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* To'lov usuli */}
      <div className="card p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">To&apos;lov usuli</p>
        <div role="radiogroup" aria-label="To'lov usuli" className="mt-3 grid gap-2 sm:grid-cols-3">
          {PAYMENT_PROVIDERS.filter((p) => providers.includes(p.value)).map((p) => {
            const Icon = PROVIDER_ICON[p.value];
            const active = provider === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => {
                  setProvider(p.value);
                  setError(null);
                }}
                className={cn(
                  "flex min-h-[56px] items-center gap-3 rounded-[var(--r-md)] border px-3.5 py-2.5 text-left transition disabled:opacity-60",
                  active ? "border-fg bg-surface shadow-[var(--shadow-1)]" : "border-line bg-surface-2 hover:border-line-2",
                )}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)]", active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2")}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-fg">{p.label}</span>
                  <span className="block text-[12px] leading-snug text-fg-3">{PROVIDER_HINT[p.value]}</span>
                </span>
              </button>
            );
          })}
        </div>
        {providers.length === 0 && <p className="mt-3 text-[13px] text-warning-text">To&apos;lov usullari hali ulanmagan. Administrator bilan bog&apos;laning.</p>}

        {pendingManual && (
          <div className="mt-4 flex items-start gap-3 rounded-[var(--r-sm)] bg-warning-soft px-3.5 py-3 text-[13px]">
            <Hourglass size={16} className="mt-0.5 shrink-0 text-warning-text" aria-hidden="true" />
            <p className="text-fg-2">
              <span className="font-semibold text-fg">{invoiceNumber(pendingManual.id)}</span> — {formatPrice(pendingManual.amount)} o&apos;tkazmangiz administrator tomonidan tekshirilmoqda (odatda 1 ish kuni). Tasdiqlangach obuna avtomatik uzayadi.
            </p>
          </div>
        )}

        {/* Xulosa + amal */}
        {plan && !showManual && (
          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] text-fg-3">
                {plan.months} oy · {until ? `${formatDate(until)} gacha` : "obuna"}
              </p>
              <p className="font-display text-[24px] font-semibold leading-tight text-fg tabular-nums">{formatPrice(plan.price)}</p>
            </div>
            <Button variant="accent" size="lg" onClick={checkout} disabled={busy || providers.length === 0} className="w-full sm:w-auto">
              {busy ? <Spinner /> : provider === "manual" ? <CheckCircle2 size={18} /> : <ArrowUpRight size={18} />}
              {provider === "manual" ? "Rekvizitlarni olish" : ctaLabel}
            </Button>
          </div>
        )}

        {/* O'tkazma rekvizitlari */}
        {showManual && manualInvoice && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[13px] leading-relaxed text-fg-2">
              Quyidagi kartaga aniq <span className="font-semibold text-fg">{formatPrice(manualInvoice.amount)}</span> o&apos;tkazing, so&apos;ng «To&apos;ladim» tugmasini bosing. Administrator o&apos;tkazmani tekshirib, obunani faollashtiradi.
            </p>
            {manual ? (
              <div className="mt-3 flex flex-col gap-3 rounded-[var(--r-md)] border border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Karta raqami</p>
                  <p className="mt-1 font-display text-[20px] font-semibold tracking-[0.06em] text-fg tabular-nums sm:text-[22px]">{manual.card}</p>
                  <p className="mt-0.5 text-[13px] text-fg-2">{manual.name}</p>
                </div>
                <Button variant="outline" size="md" onClick={copyCard} className="self-start sm:self-auto">
                  {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />} {copied ? "Nusxalandi" : "Nusxalash"}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-warning-text">Karta rekvizitlari sozlanmagan.</p>
            )}
            <p className="mt-3 text-[12px] text-fg-3">
              Izohga hisob raqamini yozing: <span className="font-mono text-fg-2">{invoiceNumber(manualInvoice.id)}</span>
            </p>
            <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} disabled={busy} />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
                <ShieldCheck size={14} className="text-success" aria-hidden="true" /> Tasdiqlangach bildirishnoma keladi
              </p>
              <Button variant="accent" size="lg" onClick={markSent} disabled={busy || !manual} className="w-full sm:w-auto">
                {busy ? <Spinner /> : <CheckCircle2 size={18} />} To&apos;ladim
              </Button>
            </div>
          </div>
        )}

        {notice && (
          <p role="status" className="mt-4 flex items-center gap-2 rounded-[var(--r-sm)] bg-warning-soft px-3.5 py-2.5 text-[13px] font-medium text-fg">
            <Hourglass size={15} className="shrink-0 text-warning-text" aria-hidden="true" /> {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-[var(--r-sm)] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
            <AlertCircle size={15} aria-hidden="true" /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
