"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, Send } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { formatPrice } from "@/lib/utils";

type ApiResponse = { ok: true; data: { id: string } } | { ok: false; error: string; fields?: Record<string, string> };

const DEADLINE_HINTS = ["Shoshilinch (3 kun)", "1 hafta ichida", "2 hafta ichida", "1 oy ichida", "Kelishiladi"];

export function OrderForm({
  specialistId,
  specialistSlug,
  specialistName,
  defaultPhone = "",
}: {
  specialistId: string;
  specialistSlug: string;
  specialistName: string;
  /** Foydalanuvchi profilidagi telefon (bo'lsa oldindan to'ldiriladi) */
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contactPhone, setContactPhone] = useState(defaultPhone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  const budgetNum = Number(budget.replace(/\s/g, ""));
  const budgetHint = budget && Number.isFinite(budgetNum) && budgetNum > 0 ? `≈ ${formatPrice(budgetNum, { compact: true })}` : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialistId,
          title,
          description,
          budget: budget.trim() === "" ? null : budgetNum,
          deadline: deadline.trim(),
          contactPhone,
        }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) setErrors(json.fields);
        return;
      }
      setDoneId(json.data.id);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  if (doneId) {
    return (
      <div className="glass-strong animate-fade-up relative overflow-hidden p-6 text-center sm:p-10" style={{ animationDuration: "0.45s" }}>
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-ios-green/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-tint/20 blur-3xl" />
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ios-green/16 text-ios-green">
          <CheckCircle2 size={34} />
        </span>
        <h2 className="mt-5 text-[26px] font-bold tracking-tight text-fg sm:text-[30px]">Buyurtma yuborildi!</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-fg-2">
          <span className="font-semibold text-fg">{specialistName}</span> so'rovingizni kabinetida ko'radi va ko'rsatilgan raqam orqali siz bilan bog'lanadi.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/kabinet/buyurtmalar" size="lg">
            <ClipboardList size={18} /> Buyurtmalarim
          </ButtonLink>
          <ButtonLink href={`/mutaxassislar/${specialistSlug}`} variant="glass" size="lg">
            <ArrowLeft size={18} /> Profilga qaytish
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass p-5 sm:p-7" noValidate>
      <div className="space-y-5">
        {/* Sarlavha */}
        <div>
          <label htmlFor="order-title" className="field-label">
            Loyiha nomi
          </label>
          <input
            id="order-title"
            className="field"
            placeholder="Masalan: To'y uchun 2 kunlik videosyomka"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            autoComplete="off"
            aria-invalid={Boolean(errors.title)}
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>

        {/* Tavsif */}
        <div>
          <label htmlFor="order-desc" className="field-label">
            Loyiha tavsifi
          </label>
          <textarea
            id="order-desc"
            className="field min-h-[140px] resize-y"
            placeholder="Nima qilish kerak, qayerda va qachon? Havolalar, misollar yoki talablar bo'lsa yozing."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={3000}
            aria-invalid={Boolean(errors.description)}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            {errors.description ? <p className="field-error !mt-0">{errors.description}</p> : <span className="text-[12px] text-fg-4">Kamida 15 ta belgi</span>}
            <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{description.length}/3000</span>
          </div>
        </div>

        {/* Byudjet + muddat */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="order-budget" className="field-label">
              Byudjet <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </label>
            <div className="relative">
              <input
                id="order-budget"
                className="field pr-16"
                type="number"
                inputMode="numeric"
                min={0}
                step={50000}
                placeholder="1 500 000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                aria-invalid={Boolean(errors.budget)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-fg-3">so'm</span>
            </div>
            {errors.budget ? <p className="field-error">{errors.budget}</p> : budgetHint && <p className="mt-1 text-[12px] text-fg-3">{budgetHint}</p>}
          </div>

          <div>
            <label htmlFor="order-deadline" className="field-label">
              Muddat <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </label>
            <input
              id="order-deadline"
              className="field"
              placeholder="Masalan: 25-oktabrgacha"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              maxLength={40}
              autoComplete="off"
              aria-invalid={Boolean(errors.deadline)}
            />
            {errors.deadline && <p className="field-error">{errors.deadline}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEADLINE_HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDeadline(h)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                    deadline === h ? "bg-tint-soft text-tint" : "bg-fg/6 text-fg-2 hover:bg-fg/10"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telefon */}
        <div>
          <label htmlFor="order-phone" className="field-label">
            Bog'lanish uchun telefon
          </label>
          <input
            id="order-phone"
            className="field"
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            autoComplete="tel"
            aria-invalid={Boolean(errors.contactPhone)}
          />
          {errors.contactPhone ? <p className="field-error">{errors.contactPhone}</p> : <p className="mt-1 text-[12px] text-fg-4">Mutaxassis shu raqamga qo'ng'iroq qiladi yoki Telegram'da yozadi.</p>}
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-ios-red/12 px-3.5 py-2 text-[13px] font-medium text-ios-red">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/mutaxassislar/${specialistSlug}`} className="inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold text-fg-2 transition hover:text-fg">
          <ArrowLeft size={15} /> Profilga qaytish
        </Link>
        <Button type="submit" size="lg" disabled={busy} className="sm:min-w-[220px]">
          {busy ? (
            <Spinner />
          ) : (
            <>
              <Send size={17} /> Buyurtmani yuborish
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
