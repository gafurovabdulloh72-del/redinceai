"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, ArrowUpRight, Check, CheckCircle2, Copy, Hourglass, ShieldCheck } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PROVIDER_ICON } from "@/components/payments/PayButton";
import { ReceiptUpload } from "@/components/payments/ReceiptUpload";
import { PAYMENT_PROVIDERS, type PaymentProvider } from "@/lib/constants";
import type { PaymentDto } from "@/lib/payments/dto";
import { cn, formatPrice } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Checkout: provayder tanlash → Payme/Click'ga yo'naltirish yoki qo'lda o'tkazma rekvizitlari + "To'ladim".
 * Provayder o'zgartirilsa, yangi to'lov yozuvi yaratiladi (eski "created" yozuv keyin bekor bo'ladi).
 */
export function CheckoutPanel({ payment, providers, isPayer }: { payment: PaymentDto; providers: PaymentProvider[]; isPayer: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<PaymentProvider>(providers.includes(payment.provider) ? payment.provider : (providers[0] ?? payment.provider));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(payment.state === "pending");
  const [receiptUrl, setReceiptUrl] = useState("");

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const Icon = PROVIDER_ICON[choice];
  const sameProvider = choice === payment.provider;
  const manual = choice === "manual";

  /** Tanlangan provayder uchun to'lov yozuvi (kerak bo'lsa yangisi) va havola */
  const resolve = async (): Promise<{ paymentId: string; redirectUrl: string | null; checkoutPath: string } | null> => {
    if (sameProvider) return { paymentId: payment.id, redirectUrl: payment.redirectUrl, checkoutPath: `/tolov/${payment.id}` };
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: payment.orderId, provider: choice }),
    });
    const json = (await res.json().catch(() => null)) as ApiResponse<{ paymentId: string; redirectUrl: string | null; checkoutPath: string }> | null;
    if (!json || !json.ok) {
      setError(json?.error ?? "Serverda kutilmagan xatolik");
      return null;
    }
    return json.data;
  };

  const proceed = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await resolve();
      if (!r) return;
      if (manual) {
        if (r.paymentId !== payment.id) router.replace(r.checkoutPath);
        return;
      }
      if (r.redirectUrl) {
        window.location.assign(r.redirectUrl);
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
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await resolve();
      if (!r) return;
      const res = await fetch(`/api/payments/${r.paymentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sent", receiptUrl }) });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ state: string }> | null;
      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        return;
      }
      setSent(true);
      if (r.paymentId !== payment.id) router.replace(`/tolov/natija?payment=${r.paymentId}`);
      else router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  const copyCard = async () => {
    if (!payment.card) return;
    try {
      await navigator.clipboard.writeText(payment.card.number.replace(/\s/g, ""));
      setCopied(true);
    } catch {
      /* clipboard mavjud emas */
    }
  };

  if (!isPayer) {
    return (
      <div className="card p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[14px] font-medium text-fg">
          <Hourglass size={16} className="text-warning" /> Bu to'lovni faqat buyurtmachi amalga oshiradi.
        </p>
        <p className="mt-1 text-[13px] text-fg-3">Holat: {payment.state === "pending" ? "mijoz to'laganini bildirdi, tasdiq kutilmoqda" : "to'lov kutilmoqda"}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provayder tanlovi */}
      <div className="card p-5 sm:p-6">
        <p className="eyebrow">To'lov usuli</p>
        <div role="radiogroup" aria-label="To'lov usuli" className="mt-4 grid gap-2 sm:grid-cols-3">
          {PAYMENT_PROVIDERS.filter((p) => providers.includes(p.value)).map((p) => {
            const PIcon = PROVIDER_ICON[p.value];
            const active = choice === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy || sent}
                onClick={() => {
                  setChoice(p.value);
                  setError(null);
                }}
                className={cn(
                  "flex min-h-[64px] items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition disabled:opacity-60",
                  active ? "border-fg bg-surface shadow-[var(--shadow-1)]" : "border-line bg-surface-2 hover:border-line-2",
                )}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2")}>
                  <PIcon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-fg">{p.label}</span>
                  <span className="block text-[12px] leading-snug text-fg-3">{p.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        {providers.length === 0 && <p className="mt-3 text-[13px] text-warning">To'lov usullari hali ulanmagan. Administrator bilan bog'laning.</p>}
      </div>

      {/* Amal */}
      <div className="card p-5 sm:p-6">
        {manual ? (
          <>
            <div className="flex items-start gap-3">
              <span className="icon-tile-soft">
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[18px] font-semibold text-fg">Karta orqali o'tkazma</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                  Quyidagi kartaga aniq <span className="font-semibold text-fg">{formatPrice(payment.amount)}</span> o'tkazing, so'ng «To'ladim» tugmasini bosing. Administrator o'tkazmani tekshirib tasdiqlaydi (odatda 1 ish kuni ichida).
                </p>
              </div>
            </div>

            {payment.card ? (
              <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">Karta raqami</p>
                  <p className="mt-1 font-display text-[22px] font-semibold tracking-[0.06em] text-fg tabular-nums">{payment.card.number}</p>
                  <p className="mt-0.5 text-[13px] text-fg-2">{payment.card.name}</p>
                </div>
                <Button variant="outline" size="md" onClick={copyCard} className="self-start sm:self-auto">
                  {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />} {copied ? "Nusxalandi" : "Nusxalash"}
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-warning">Karta rekvizitlari sozlanmagan.</p>
            )}

            <p className="mt-3 text-[12px] text-fg-3">
              Izohga buyurtma raqamini yozing: <span className="font-mono text-fg-2">{payment.orderId.slice(0, 8)}</span>
            </p>

            {!sent && <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} disabled={busy} />}

            {sent ? (
              <div className="mt-5 flex items-start gap-3 rounded-[18px] bg-warning-soft px-4 py-3.5 text-[13px] text-fg">
                <Hourglass size={18} className="mt-0.5 shrink-0 text-warning" />
                <div>
                  <p className="font-semibold">To'lov tasdiqlanishi kutilmoqda</p>
                  <p className="mt-0.5 text-fg-2">Administrator o'tkazmani tekshirgach, buyurtma «To'langan (eskrou)» holatiga o'tadi va sizga bildirishnoma keladi.</p>
                  <Link href={`/tolov/natija?payment=${payment.id}`} className="mt-2 inline-flex items-center gap-1 font-semibold text-accent">
                    Holatni kuzatish <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
                  <ShieldCheck size={14} className="text-success" /> Pul eskrouda — ish qabul qilingach mutaxassisga o'tadi
                </p>
                <Button variant="accent" size="lg" onClick={markSent} disabled={busy || !payment.card} className="w-full sm:w-auto">
                  {busy ? <Spinner /> : <CheckCircle2 size={18} />} To'ladim
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="icon-tile-soft">
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[18px] font-semibold text-fg">{choice === "payme" ? "Payme orqali to'lash" : "Click orqali to'lash"}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-fg-2">
                  Sizni {choice === "payme" ? "Payme" : "Click"} to'lov sahifasiga yo'naltiramiz. To'lov tasdiqlangach avtomatik qaytasiz va buyurtma «To'langan (eskrou)» holatiga o'tadi.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
                <ShieldCheck size={14} className="text-success" /> Karta ma'lumotlari faqat {choice === "payme" ? "Payme" : "Click"} tomonida kiritiladi
              </p>
              <Button variant="accent" size="lg" onClick={proceed} disabled={busy || providers.length === 0} className="w-full sm:w-auto">
                {busy ? <Spinner /> : <ArrowUpRight size={18} />} To'lovga o'tish
              </Button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
            <AlertCircle size={15} /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
