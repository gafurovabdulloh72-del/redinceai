"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Banknote, CheckCircle2, CreditCard, Landmark, Send, type LucideIcon } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { PAYOUT_METHOD_LABEL } from "@/components/payments/tones";
import { CARD_BRAND_LABEL, checkCard } from "@/lib/payments/card";
import { cn, formatNumber, formatPrice } from "@/lib/utils";

type Method = "card" | "bank" | "cash";
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const METHOD_ICON: Record<Method, LucideIcon> = { card: CreditCard, bank: Landmark, cash: Banknote };
const METHOD_HINT: Record<Method, string> = {
  card: "Humo/Uzcard/Visa karta raqami (16 raqam). Faqat oxirgi 4 raqami saqlanadi.",
  bank: "Bank nomi, hisob raqami (20 raqam) va MFO.",
  cash: "Qayerda va qachon olishingizni yozing — admin bog'lanadi.",
};
const METHOD_PLACEHOLDER: Record<Method, string> = { card: "8600 1234 5678 9012", bank: "Kapitalbank · 2020 8000 ... · MFO 01088", cash: "Toshkent, Yunusobod — ish kunlari" };

/** Pul chiqarish so'rovi: ≥ minPayout, ≤ mavjud balans, bir vaqtda bitta ochiq so'rov */
export function PayoutRequestForm({ available, minPayout, hasOpen }: { available: number; minPayout: number; hasOpen: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(available >= minPayout ? formatNumber(available) : "");
  const [method, setMethod] = useState<Method>("card");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const value = Number(amount.replace(/\D/g, "")) || 0;
  const locked = hasOpen || available < minPayout;

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(null), 8000);
    return () => window.clearTimeout(t);
  }, [done]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || locked) return;
    const errs: Record<string, string> = {};
    if (value < minPayout) errs.amount = `Kamida ${formatPrice(minPayout)}`;
    else if (value > available) errs.amount = `Mavjud: ${formatPrice(available)}`;
    if (details.trim().length < 4) errs.details = "Rekvizitlarni kiriting";
    if (method === "card") {
      const check = checkCard(details);
      if (!check.ok) errs.details = check.error ?? "Karta raqami noto'g'ri";
    }
    if (Object.keys(errs).length) {
      setFields(errs);
      return;
    }
    setFields({});
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method, details: details.trim() }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ id: string; amount: number; details: string }> | null;
      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        if (json && !json.ok && json.fields) setFields(json.fields);
        return;
      }
      setDone(`${formatPrice(json.data.amount)} — so'rov yuborildi (${json.data.details}). Admin 1–2 ish kunida ko'rib chiqadi.`);
      setDetails("");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6" noValidate id="pul-chiqarish">
      <div className="flex items-start gap-3">
        <span className="icon-tile">
          <Send size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-semibold text-fg">Pul chiqarish</h2>
          <p className="mt-0.5 text-[13px] text-fg-3">
            Mavjud balans: <span className="font-semibold text-fg">{formatPrice(available)}</span> · minimal {formatPrice(minPayout)}
          </p>
        </div>
      </div>

      {done && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-[14px] bg-success-soft px-4 py-2.5 text-[13px] font-medium text-success-text animate-fade-up" style={{ animationDuration: "0.25s" }}>
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {done}
        </p>
      )}

      {locked && !done ? (
        <p className="mt-4 flex items-start gap-2 rounded-[14px] bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
          {hasOpen ? "Sizda ko'rib chiqilayotgan so'rov bor. U yakunlangach yangisini yuborishingiz mumkin." : `Chiqarish uchun balans kamida ${formatPrice(minPayout)} bo'lishi kerak. Buyurtmalarni yakunlang — mijoz qabul qilgach pul balansga tushadi.`}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="payout-amount" className="field-label">
              Summa (so'm)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="payout-amount"
                  className="field !pr-14 tabular-nums"
                  inputMode="numeric"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setAmount(d ? formatNumber(Number(d)) : "");
                    setFields((f) => ({ ...f, amount: "" }));
                  }}
                  aria-invalid={Boolean(fields.amount)}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so'm</span>
              </div>
              <Button type="button" variant="outline" size="md" onClick={() => setAmount(formatNumber(available))}>
                Hammasi
              </Button>
            </div>
            {fields.amount && <p className="field-error">{fields.amount}</p>}
          </div>

          <div>
            <span className="field-label">Usul</span>
            <div className="segment flex w-full" role="radiogroup" aria-label="Pul olish usuli">
              {(Object.keys(PAYOUT_METHOD_LABEL) as Method[]).map((m) => {
                const Icon = METHOD_ICON[m];
                return (
                  <button key={m} type="button" role="radio" aria-checked={method === m} data-active={method === m} onClick={() => setMethod(m)} className="segment-item inline-flex min-h-10 flex-1 items-center justify-center gap-1.5">
                    <Icon size={14} /> {PAYOUT_METHOD_LABEL[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="payout-details" className="field-label">
              Rekvizitlar
            </label>
            <input
              id="payout-details"
              className={cn("field", method === "card" && "tabular-nums")}
              placeholder={METHOD_PLACEHOLDER[method]}
              inputMode={method === "card" ? "numeric" : "text"}
              autoComplete="off"
              value={details}
              maxLength={200}
              onChange={(e) => {
                const v = method === "card" ? e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ") : e.target.value;
                setDetails(v);
                setFields((f) => ({ ...f, details: "" }));
              }}
              aria-invalid={Boolean(fields.details)}
              aria-describedby="payout-details-hint"
            />
            {fields.details ? (
              <p className="field-error">{fields.details}</p>
            ) : method === "card" && details.replace(/\D/g, "").length >= 6 ? (
              (() => {
                // Avtomatik tekshiruv: terish paytida tizim (Uzcard/Humo/…) va nazorat raqami holati
                const check = checkCard(details);
                const partial = details.replace(/\D/g, "").length < 16;
                return (
                  <p id="payout-details-hint" className={cn("mt-1.5 text-[12px] font-medium", check.ok ? "text-success-text" : partial ? "text-fg-3" : "text-danger-text")} aria-live="polite">
                    {check.brand ? `${CARD_BRAND_LABEL[check.brand]} · ` : ""}
                    {check.ok ? "Karta raqami to'g'ri ✓" : partial ? "Raqamni oxirigacha kiriting" : check.error}
                  </p>
                );
              })()
            ) : (
              <p id="payout-details-hint" className="mt-1.5 text-[12px] text-fg-3">{METHOD_HINT[method]}</p>
            )}
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
              <AlertCircle size={15} /> {error}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-fg-3">So'rov admin tomonidan tasdiqlanadi va rekvizitingizga o'tkaziladi.</p>
            <Button type="submit" size="md" disabled={busy || value <= 0}>
              {busy ? <Spinner /> : <Send size={15} />} So'rov yuborish
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
