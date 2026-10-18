"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, BookmarkPlus, CalendarClock, Send, Wallet, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { COVER_MAX, COVER_MIN } from "@/lib/jobs/format";
import { cn, formatPrice } from "@/lib/utils";

type ApiResponse = { ok: true; data: { id: string; remaining: number } } | { ok: false; error: string; fields?: Record<string, string> };

const FIELD_ORDER = ["amount", "deliveryDays", "coverLetter"] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

/** Xat shablonlari — faqat shu brauzerda (localStorage), ko'pi bilan 5 ta; serverga yuborilmaydi */
const TPL_KEY = "proposal-templates";
const TPL_MAX = 5;
type Template = { name: string; text: string };
function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TPL_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((t): t is Template => Boolean(t && typeof t === "object" && typeof (t as Template).name === "string" && typeof (t as Template).text === "string")).slice(0, TPL_MAX) : [];
  } catch {
    return [];
  }
}
function storeTemplates(list: Template[]) {
  try {
    localStorage.setItem(TPL_KEY, JSON.stringify(list.slice(0, TPL_MAX)));
  } catch {
    /* saqlash mavjud emas (maxfiy rejim) — e'tiborsiz */
  }
}

/**
 * Mutaxassisning taklifi: narx (umumiy, so'm), muddat (kun), xat (50–2000 belgi).
 * Kunlik limit hisoblagichi: «Bugun 7/10 taklif qoldi». Yuborilgach sahifa yangilanadi (yuborilgan holat ko'rinadi).
 */
export function ProposalForm({
  jobId,
  remaining,
  limit,
  budgetHint,
  hourly = false,
  initial,
}: {
  jobId: string;
  remaining: number;
  limit: number;
  /** E'lon byudjeti matni ("2–4 mln so'm") */
  budgetHint: string;
  hourly?: boolean;
  /** Qaytarib olingan taklifni qayta yuborishda oldingi qiymatlar */
  initial?: { amount: number; deliveryDays: number; coverLetter: string };
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [days, setDays] = useState(initial ? String(initial.deliveryDays) : "");
  const [cover, setCover] = useState(initial?.coverLetter ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Shablonlar faqat mount'dan keyin o'qiladi — server DOM'i o'zgarmaydi (hydration)
  const [templates, setTemplates] = useState<Template[]>([]);
  useEffect(() => setTemplates(loadTemplates()), []);
  const saveTemplate = () => {
    const text = cover.trim();
    if (text.length < COVER_MIN) return;
    const name = text.replace(/\s+/g, " ").slice(0, 28) + (text.length > 28 ? "…" : "");
    const next = [{ name, text }, ...templates.filter((t) => t.text !== text)].slice(0, TPL_MAX);
    setTemplates(next);
    storeTemplates(next);
  };
  const removeTemplate = (i: number) => {
    const next = templates.filter((_, j) => j !== i);
    setTemplates(next);
    storeTemplates(next);
  };
  const refs = useRef<Partial<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const setRef = (k: FieldKey) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    refs.current[k] = el;
  };

  const amountNum = Number(amount.replace(/\D/g, ""));
  const coverLen = cover.trim().length;
  const outOfLimit = remaining <= 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || outOfLimit) return;
    setError(null);
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, amount: amountNum || amount, deliveryDays: days, coverLetter: cover }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!json.ok) {
        setError(json.error);
        if (json.fields) {
          setErrors(json.fields);
          const key = FIELD_ORDER.find((k) => json.fields?.[k]);
          const el = key ? refs.current[key] : null;
          window.setTimeout(() => el?.focus(), 0);
        }
        return;
      }
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form id="taklif" onSubmit={submit} noValidate className="card scroll-mt-28 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-semibold text-fg">{initial ? "Taklifni qayta yuborish" : "Taklif yuborish"}</h2>
          <p className="mt-1 text-[13.5px] text-fg-3">Mijoz byudjeti: {budgetHint}</p>
        </div>
        <p
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
            outOfLimit ? "bg-danger-soft text-danger-text" : remaining <= 3 ? "bg-warning-soft text-warning-text" : "bg-fg/6 text-fg-2",
          )}
        >
          Bugun {remaining}/{limit} taklif qoldi
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="prop-amount" className="field-label">
            Narxingiz {hourly && <span className="font-normal text-fg-4">(umumiy, taxminiy)</span>}
          </label>
          <div className="relative">
            <Wallet size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input
              ref={setRef("amount")}
              id="prop-amount"
              className="field pl-10 pr-12"
              inputMode="numeric"
              placeholder="2 500 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ""))}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "prop-amount-err" : "prop-amount-hint"}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-medium text-fg-3">so'm</span>
          </div>
          {errors.amount ? (
            <p id="prop-amount-err" className="field-error">
              {errors.amount}
            </p>
          ) : (
            <p id="prop-amount-hint" className="mt-1 text-[12px] text-fg-4">
              {amountNum > 0 ? `≈ ${formatPrice(amountNum, { compact: true })}. ` : ""}Qabul qilinsa — buyurtma narxi shu bo'ladi.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="prop-days" className="field-label">
            Bajarish muddati
          </label>
          <div className="relative">
            <CalendarClock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input
              ref={setRef("deliveryDays")}
              id="prop-days"
              className="field pl-10 pr-12"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              placeholder="7"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={Boolean(errors.deliveryDays)}
              aria-describedby={errors.deliveryDays ? "prop-days-err" : undefined}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-medium text-fg-3">kun</span>
          </div>
          {errors.deliveryDays && (
            <p id="prop-days-err" className="field-error">
              {errors.deliveryDays}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label htmlFor="prop-cover" className="field-label">
            Mijozga xat
          </label>
          <button type="button" onClick={saveTemplate} disabled={coverLen < COVER_MIN || templates.some((t) => t.text === cover.trim())} className="press -mb-1 inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 hover:text-fg disabled:opacity-40" title="Xatni shablon sifatida saqlash (faqat shu qurilmada)">
            <BookmarkPlus size={13} aria-hidden="true" /> Shablonga saqlash
          </button>
        </div>
        {templates.length > 0 && (
          <div className="expand-in mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Xat shablonlari">
            {templates.map((t, i) => (
              <span key={t.text} className="inline-flex h-8 items-center gap-1 rounded-full border border-line pl-3 pr-1 text-[12px] font-semibold text-fg-2">
                <button type="button" onClick={() => setCover(t.text)} className="press hover:text-fg">
                  {t.name}
                </button>
                <button type="button" onClick={() => removeTemplate(i)} aria-label={`${t.name} shablonini o'chirish`} className="press flex h-6 w-6 items-center justify-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-fg">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={setRef("coverLetter")}
          id="prop-cover"
          className="field min-h-[150px] resize-y"
          maxLength={COVER_MAX}
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          placeholder="Nega aynan siz mossiz? O'xshash ishlaringiz, qanday bajarishingiz va savollaringiz. Portfolio profilingizda ko'rinadi."
          aria-invalid={Boolean(errors.coverLetter)}
          aria-describedby={errors.coverLetter ? "prop-cover-err" : "prop-cover-hint"}
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          {errors.coverLetter ? (
            <p id="prop-cover-err" className="field-error !mt-0">
              {errors.coverLetter}
            </p>
          ) : (
            <span id="prop-cover-hint" className={cn("text-[12px]", coverLen > 0 && coverLen < COVER_MIN ? "text-warning-text" : "text-fg-4")}>
              Kamida {COVER_MIN} ta belgi. Telefon va Telegram'ni xatga yozmang — kelishuv platformada xavfsiz.
            </span>
          )}
          <span className="shrink-0 text-[12px] tabular-nums text-fg-4">
            {cover.length}/{COVER_MAX}
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--r-sm)] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || outOfLimit}
        className="btn-accent mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold disabled:opacity-60 sm:w-auto"
      >
        {busy ? <Spinner /> : <Send size={16} aria-hidden="true" />}
        {outOfLimit ? "Bugungi limit tugadi" : "Taklifni yuborish"}
      </button>
    </form>
  );
}
