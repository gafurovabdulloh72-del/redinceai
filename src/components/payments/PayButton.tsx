"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CreditCard, Landmark, ShieldCheck, Smartphone, Wallet, X, type LucideIcon } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PAYMENT_PROVIDERS, type PaymentProvider } from "@/lib/constants";
import { cn, formatPrice } from "@/lib/utils";

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };
interface CheckoutData {
  paymentId: string;
  provider: PaymentProvider;
  redirectUrl: string | null;
  checkoutPath: string;
}

export const PROVIDER_ICON: Record<PaymentProvider, LucideIcon> = { payme: CreditCard, click: Smartphone, manual: Landmark };

/**
 * "To'lash" tugmasi: provayder tanlash oynasi → POST /api/payments/checkout → /tolov/[paymentId].
 * Bitta provayder sozlangan bo'lsa oyna ochilmaydi — to'g'ridan-to'g'ri checkout.
 */
export function PayButton({
  orderId,
  amount,
  providers,
  variant = "accent",
  size = "md",
  className,
  label,
}: {
  orderId: string;
  amount: number;
  providers: PaymentProvider[];
  variant?: "accent" | "primary" | "outline" | "tint-soft";
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<PaymentProvider>(providers[0] ?? "payme");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy]);

  const checkout = async (provider: PaymentProvider) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, provider }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<CheckoutData> | null;
      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        setOpen(true);
        return;
      }
      router.push(json.data.checkoutPath);
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  if (providers.length === 0) {
    return (
      <Button variant="outline" size={size} className={className} disabled title="To'lov usullari hali ulanmagan">
        <Wallet size={16} /> To'lov usuli ulanmagan
      </Button>
    );
  }

  const text = label ?? `To'lash · ${formatPrice(amount)}`;

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => (providers.length === 1 ? checkout(providers[0]) : setOpen(true))} disabled={busy} aria-haspopup="dialog">
        {busy ? <Spinner /> : <Wallet size={16} />} {text}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`pay-${orderId}-title`}
            className="card-elevated w-full max-w-md !rounded-b-none p-5 animate-fade-up sm:!rounded-[24px] sm:p-6"
            style={{ animationDuration: "0.3s" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Eskrou to'lov</p>
                <h2 id={`pay-${orderId}-title`} className="mt-2 font-display text-[20px] font-semibold text-fg">
                  {formatPrice(amount)}
                </h2>
                <p className="mt-1 text-[13px] text-fg-3">To'lov usulini tanlang. Pul ish qabul qilingunga qadar platformada saqlanadi.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Yopish" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
                <X size={18} />
              </button>
            </div>

            <div role="radiogroup" aria-label="To'lov usuli" className="mt-4 space-y-2">
              {PAYMENT_PROVIDERS.filter((p) => providers.includes(p.value)).map((p, i) => {
                const Icon = PROVIDER_ICON[p.value];
                const active = choice === p.value;
                return (
                  <button
                    key={p.value}
                    ref={i === 0 ? firstRef : undefined}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setChoice(p.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition",
                      active ? "border-fg bg-surface" : "border-line bg-surface-2 hover:border-line-2",
                    )}
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", active ? "bg-ink text-ink-fg" : "bg-fg/6 text-fg-2")}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-fg">{p.label}</span>
                      <span className="block text-[12px] text-fg-3">{p.description}</span>
                    </span>
                    <span className={cn("h-5 w-5 shrink-0 rounded-full border-2", active ? "border-accent bg-accent ring-4 ring-accent-soft" : "border-line-2")} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {error && (
              <p role="alert" className="mt-3 flex items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
                <AlertCircle size={15} /> {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-3">
                <ShieldCheck size={14} className="text-success" /> Himoyalangan eskrou
              </p>
              <Button variant="accent" onClick={() => checkout(choice)} disabled={busy} className="w-full sm:w-auto">
                {busy ? <Spinner /> : <ArrowRight size={16} />} Davom etish
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
