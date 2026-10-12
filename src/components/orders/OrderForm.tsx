"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ClipboardList, Lock, PhoneCall, Send, ShieldCheck } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { cn, formatPrice } from "@/lib/utils";

type ApiResponse = { ok: true; data: { id: string } } | { ok: false; error: string; fields?: Record<string, string> };

const DEADLINE_HINTS = ["Shoshilinch (3 kun)", "1 hafta ichida", "2 hafta ichida", "1 oy ichida", "Kelishiladi"];
const FIELD_ORDER = ["title", "description", "budget", "deadline", "contactPhone"] as const;
type FieldKey = (typeof FIELD_ORDER)[number];

/** Byudjet tez tanlovlari — mutaxassis narxidan kelib chiqib (50 ming so'mga yaxlitlangan) */
function budgetPresets(priceFrom: number, priceTo?: number | null): number[] {
  const round = (n: number) => Math.max(50_000, Math.round(n / 50_000) * 50_000);
  if (!priceFrom) return [500_000, 1_000_000, 2_000_000, 5_000_000];
  const base = [priceFrom, priceTo && priceTo > priceFrom ? priceTo : priceFrom * 1.5, priceFrom * 2, priceFrom * 3].map(round);
  return [...new Set(base)].sort((a, b) => a - b).slice(0, 4);
}

export function OrderForm({
  specialistId,
  specialistSlug,
  specialistName,
  defaultPhone = "",
  priceFrom = 0,
  priceTo = null,
}: {
  specialistId: string;
  specialistSlug: string;
  specialistName: string;
  /** Foydalanuvchi profilidagi telefon (bo'lsa oldindan to'ldiriladi) */
  defaultPhone?: string | null;
  priceFrom?: number;
  priceTo?: number | null;
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

  // «Yana buyurtma berish» (F47): ?title= bilan kelgan sarlavha oldindan to'ldiriladi
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("title")?.trim();
      if (t) setTitle((cur) => cur || t.slice(0, 120));
    } catch {
      /* noop */
    }
  }, []);

  const refs = useRef<Record<FieldKey, HTMLInputElement | HTMLTextAreaElement | null>>({
    title: null,
    description: null,
    budget: null,
    deadline: null,
    contactPhone: null,
  });
  const setRef = (key: FieldKey) => (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    refs.current[key] = el;
  };

  const presets = useMemo(() => budgetPresets(priceFrom, priceTo), [priceFrom, priceTo]);
  const budgetNum = Number(budget.replace(/\s/g, ""));
  const budgetHint = budget && Number.isFinite(budgetNum) && budgetNum > 0 ? `≈ ${formatPrice(budgetNum, { compact: true })}` : null;
  const belowPrice = priceFrom > 0 && Number.isFinite(budgetNum) && budgetNum > 0 && budgetNum < priceFrom;

  /** Server xatosidan keyin birinchi noto'g'ri maydonga fokus (tartib bo'yicha) */
  const focusFirstInvalid = (fields: Record<string, string>) => {
    const key = FIELD_ORDER.find((k) => fields[k]);
    const el = key ? refs.current[key] : null;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

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
        if (json.fields) {
          setErrors(json.fields);
          // State yangilangach fokus (aria-invalid qo'yilgan bo'lsin)
          window.setTimeout(() => focusFirstInvalid(json.fields!), 0);
        }
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

  /* ---------- Muvaffaqiyat: keyingi qadamlar + buyurtmaga to'g'ri havola ---------- */
  if (doneId) {
    const orderHref = `/kabinet/buyurtmalar?id=${doneId}`;
    const steps = [
      { icon: ClipboardList, t: "So'rov mutaxassis kabinetiga tushdi", d: `${specialistName} uni ko'rib chiqadi va qabul qiladi yoki savol beradi.` },
      { icon: PhoneCall, t: "U siz bilan bog'lanadi", d: "Ko'rsatgan raqamingizga qo'ng'iroq yoki Telegram orqali." },
      { icon: Lock, t: "Narx kelishilgach — xavfsiz to'lov", d: "Pul eskrouda saqlanadi, ishni qabul qilganingizdan keyingina mutaxassisga o'tadi." },
    ];
    return (
      <div className="card-elevated animate-fade-up overflow-hidden" style={{ animationDuration: "0.45s" }}>
        <div className="px-6 pb-6 pt-8 text-center sm:px-10 sm:pt-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 size={34} />
          </span>
          <span className="eyebrow mt-6 justify-center">Buyurtma yuborildi</span>
          <h2 className="display-xl mt-3 text-[28px] text-fg sm:text-[34px]">
            Rahmat, so'rov <span className="accent-serif text-accent">yetib bordi</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-fg-2">
            <span className="font-semibold text-fg">{specialistName}</span> so'rovingizni kabinetida ko'radi. Holatni «Buyurtmalarim» bo'limida kuzatib boring.
          </p>
        </div>

        <ol className="mx-6 grid grid-cols-1 gap-3 border-t border-line py-5 sm:mx-10 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="flex items-start gap-3 sm:flex-col sm:gap-2.5">
              <span className="icon-tile icon-tile-sm">
                <s.icon size={15} />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold leading-snug text-fg">
                  <span className="mr-1 text-fg-4">{i + 1}.</span>
                  {s.t}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col justify-center gap-3 border-t border-line px-6 py-5 sm:flex-row sm:px-10">
          <ButtonLink href={orderHref} variant="accent" size="lg">
            <ClipboardList size={18} /> Buyurtmani kuzatish
          </ButtonLink>
          <ButtonLink href={`/mutaxassislar/${specialistSlug}`} variant="outline" size="lg">
            <ArrowLeft size={18} /> Profilga qaytish
          </ButtonLink>
        </div>
      </div>
    );
  }

  const chipCls = (on: boolean) =>
    cn(
      "inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[0.97]",
      on ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
    );

  return (
    <form onSubmit={submit} className="card p-5 sm:p-7" noValidate aria-describedby="order-form-hint">
      <p id="order-form-hint" className="sr-only">
        Barcha maydonlar o'zbek tilida to'ldiriladi. Byudjet va muddat ixtiyoriy.
      </p>
      <div className="space-y-6">
        {/* Sarlavha */}
        <div>
          <label htmlFor="order-title" className="field-label">
            Loyiha nomi
          </label>
          <input
            ref={setRef("title")}
            id="order-title"
            className="field"
            placeholder="Masalan: To'y uchun 2 kunlik videosyomka"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            autoComplete="off"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "order-title-err" : "order-title-hint"}
          />
          {errors.title ? (
            <p id="order-title-err" className="field-error">
              {errors.title}
            </p>
          ) : (
            <p id="order-title-hint" className="mt-1 text-[12px] text-fg-4">
              Qisqa va aniq — mutaxassis bir qarashda tushunsin.
            </p>
          )}
        </div>

        {/* Tavsif */}
        <div>
          <label htmlFor="order-desc" className="field-label">
            Loyiha tavsifi
          </label>
          <textarea
            ref={setRef("description")}
            id="order-desc"
            className="field min-h-[140px] resize-y"
            placeholder="Nima qilish kerak, qayerda va qachon? Havolalar, misollar yoki talablar bo'lsa yozing."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={3000}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "order-desc-err" : "order-desc-hint"}
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            {errors.description ? (
              <p id="order-desc-err" className="field-error !mt-0">
                {errors.description}
              </p>
            ) : (
              <span id="order-desc-hint" className="text-[12px] text-fg-4">
                Kamida 15 ta belgi. Joy, sana, davomiylik va kutilgan natijani yozing — narx aniqroq bo'ladi.
              </span>
            )}
            <span className="shrink-0 text-[12px] tabular-nums text-fg-4">{description.length}/3000</span>
          </div>
        </div>

        {/* Byudjet */}
        <div>
          <label htmlFor="order-budget" className="field-label">
            Byudjet <span className="font-normal text-fg-4">(ixtiyoriy)</span>
          </label>
          <div className="relative">
            <input
              ref={setRef("budget")}
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
              aria-describedby={errors.budget ? "order-budget-err" : "order-budget-hint"}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[13px] font-medium text-fg-3">so'm</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Byudjet tez tanlovi">
            {presets.map((p) => {
              const on = budgetNum === p;
              return (
                <button key={p} type="button" aria-pressed={on} onClick={() => setBudget(on ? "" : String(p))} className={chipCls(on)}>
                  {on && <Check size={13} />}
                  {formatPrice(p, { compact: true })}
                </button>
              );
            })}
          </div>
          {errors.budget ? (
            <p id="order-budget-err" className="field-error">
              {errors.budget}
            </p>
          ) : (
            <p id="order-budget-hint" className={cn("mt-1.5 text-[12px]", belowPrice ? "text-warning" : "text-fg-4")}>
              {belowPrice
                ? `Mutaxassisning boshlang'ich narxi ${formatPrice(priceFrom, { compact: true })} — kichikroq byudjet kelishuvni qiyinlashtirishi mumkin.`
                : budgetHint
                  ? `${budgetHint}. Yakuniy narxni mutaxassis bilan kelishasiz — to'lov eskrou orqali, ish qabul qilingach o'tadi.`
                  : priceFrom
                    ? `Mutaxassis narxi ${formatPrice(priceFrom, { compact: true })} dan boshlanadi. Taxminiy summani yozing yoki bo'sh qoldiring.`
                    : "Taxminiy summani yozing yoki bo'sh qoldiring — narx kelishiladi."}
            </p>
          )}
        </div>

        {/* Muddat */}
        <div>
          <label htmlFor="order-deadline" className="field-label">
            Muddat <span className="font-normal text-fg-4">(ixtiyoriy)</span>
          </label>
          <input
            ref={setRef("deadline")}
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
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Muddat tez tanlovi">
            {DEADLINE_HINTS.map((h) => {
              const on = deadline === h;
              return (
                <button key={h} type="button" aria-pressed={on} onClick={() => setDeadline(on ? "" : h)} className={chipCls(on)}>
                  {on && <Check size={13} />}
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        {/* Telefon */}
        <div>
          <label htmlFor="order-phone" className="field-label">
            Bog'lanish uchun telefon
          </label>
          <input
            ref={setRef("contactPhone")}
            id="order-phone"
            className="field"
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            autoComplete="tel"
            aria-invalid={Boolean(errors.contactPhone)}
            aria-describedby={errors.contactPhone ? "order-phone-err" : "order-phone-hint"}
          />
          {errors.contactPhone ? (
            <p id="order-phone-err" className="field-error">
              {errors.contactPhone}
            </p>
          ) : (
            <p id="order-phone-hint" className="mt-1 flex items-start gap-1.5 text-[12px] text-fg-4">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" />
              Raqam faqat shu mutaxassisga ko'rinadi — u qo'ng'iroq qiladi yoki Telegram'da yozadi.
            </p>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/mutaxassislar/${specialistSlug}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-semibold text-fg-2 transition hover:text-fg">
          <ArrowLeft size={15} /> Profilga qaytish
        </Link>
        <Button type="submit" variant="accent" size="lg" disabled={busy} className="sm:min-w-[220px]">
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
