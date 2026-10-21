"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ClipboardList, ImagePlus, Lock, MessageCircle, Package, Send, ShieldCheck, X, Zap } from "lucide-react";
import { Button, ButtonLink, Spinner } from "@/components/ui";
import { MAX_ATTACHMENTS, UPLOAD_ACCEPT_DOCS, isImageAttachment, uploadAttachment, type Attachment } from "@/components/chat/attachments";
import type { PackageKey, ServicePackage } from "@/lib/db/schema";
import { PACKAGE_TIERS } from "@/lib/constants";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import { DueDatePicker, addDays, nextFreeDate, tashkentToday } from "./DueDatePicker";

/** queued/availableFrom (#43): mutaxassis ta'tilda/band bo'lsa server navbat belgisini qaytaradi */
type ApiResponse = { ok: true; data: { id: string; queued?: boolean; availableFrom?: string | null } } | { ok: false; error: string; fields?: Record<string, string> };

const FIELD_ORDER = ["packageKey", "title", "description", "budget", "dueDate", "attachments", "contactPhone"] as const;
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
  packages = [],
  initialPackage = null,
  blockedDates = [],
  urgentPct = 20,
}: {
  specialistId: string;
  specialistSlug: string;
  specialistName: string;
  /** Foydalanuvchi profilidagi telefon (bo'lsa oldindan to'ldiriladi) */
  defaultPhone?: string | null;
  priceFrom?: number;
  priceTo?: number | null;
  /** Mutaxassis xizmat paketlari (F31) */
  packages?: ServicePackage[];
  /** ?paket= bilan kelgan paket */
  initialPackage?: PackageKey | null;
  /** Mutaxassis band kunlari (YYYY-MM-DD) — sana tanlagichda yopiq */
  blockedDates?: string[];
  /** Shoshilinch ustama foizi (F30) */
  urgentPct?: number;
}) {
  const router = useRouter();
  const pkgInit = initialPackage ? (packages.find((p) => p.key === initialPackage) ?? null) : null;
  const blockedSet = useMemo(() => new Set(blockedDates), [blockedDates]);
  /** Paket muddatidan taklif qilinadigan sana (band kunni chetlab) */
  const suggestDue = (pkg: ServicePackage | null) => (pkg ? nextFreeDate(addDays(tashkentToday(), Math.max(1, pkg.deliveryDays)), blockedSet, addDays(tashkentToday(), 365)) : null);
  const [packageKey, setPackageKey] = useState<PackageKey | null>(pkgInit?.key ?? null);
  const [title, setTitle] = useState(pkgInit ? `«${pkgInit.title}» paketi` : "");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(pkgInit ? String(pkgInit.price) : "");
  const [dueDate, setDueDate] = useState<string | null>(() => suggestDue(pkgInit));
  const [urgent, setUrgent] = useState(false);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [contactPhone, setContactPhone] = useState(defaultPhone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; queued?: boolean; availableFrom?: string | null } | null>(null);
  /** Qoralama (F56): tiklanganini ko'rsatadigan yopiladigan eslatma */
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKey = `order:${specialistId}`;

  // «Yana buyurtma berish» (F47): ?title= bilan kelgan sarlavha oldindan to'ldiriladi
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("title")?.trim();
      if (t) setTitle((cur) => cur || t.slice(0, 120));
    } catch {
      /* noop */
    }
  }, []);

  // Qoralama (F56): bo'sh maydonlarga oxirgi yozilganlarni qaytaramiz (paket/?title= qiymatlari ustidan yozilmaydi)
  useEffect(() => {
    const d = loadDraft<{ title?: string; description?: string; budget?: string }>(draftKey);
    if (!d) return;
    let used = false;
    if (d.title && !title.trim()) {
      setTitle(d.title.slice(0, 120));
      used = true;
    }
    if (d.description && !description.trim()) {
      setDescription(d.description.slice(0, 3000));
      used = true;
    }
    if (d.budget && !budget.trim()) {
      setBudget(d.budget);
      used = true;
    }
    if (used) setDraftRestored(true);
    // Faqat birinchi ochilishda — keyingi o'zgarishlar foydalanuvchiniki
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Qoralama (F56): asosiy matn maydonlari 800 ms kechikish bilan saqlanadi; hammasi bo'sh — o'chiriladi
  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => {
      if (title.trim() || description.trim() || budget.trim()) saveDraft(draftKey, { title, description, budget });
      else clearDraft(draftKey);
    }, 800);
    return () => window.clearTimeout(t);
  }, [draftKey, title, description, budget, done]);

  const refs = useRef<Record<FieldKey, HTMLElement | null>>({
    packageKey: null,
    title: null,
    description: null,
    budget: null,
    dueDate: null,
    attachments: null,
    contactPhone: null,
  });
  const setRef = (key: FieldKey) => (el: HTMLElement | null) => {
    refs.current[key] = el;
  };

  const presets = useMemo(() => budgetPresets(priceFrom, priceTo), [priceFrom, priceTo]);
  const budgetNum = Number(budget.replace(/\s/g, ""));
  const budgetHint = budget && Number.isFinite(budgetNum) && budgetNum > 0 ? `≈ ${formatPrice(budgetNum, { compact: true })}` : null;
  const belowPrice = priceFrom > 0 && Number.isFinite(budgetNum) && budgetNum > 0 && budgetNum < priceFrom;

  /** Server xatosidan keyin birinchi noto'g'ri maydonga fokus (tartib bo'yicha) */
  const focusFirstInvalid = (fields: Record<string, string>) => {
    const key = FIELD_ORDER.find((k) => fields[k] || Object.keys(fields).some((f) => f.startsWith(`${k}.`)));
    const el = key ? (key === "dueDate" ? document.getElementById("order-due") : refs.current[key]) : null;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const choosePackage = (pkg: ServicePackage | null) => {
    const prev = packages.find((p) => p.key === packageKey) ?? null;
    setPackageKey(pkg?.key ?? null);
    if (pkg) {
      setBudget(String(pkg.price));
      // Sarlavha va sana — foydalanuvchi o'zi o'zgartirmagan bo'lsa (avvalgi paketdan kelgan qiymat) yangilanadi
      setTitle((cur) => (!cur.trim() || (prev && cur === `«${prev.title}» paketi`) ? `«${pkg.title}» paketi` : cur));
      setDueDate((cur) => (!cur || cur === suggestDue(prev) ? suggestDue(pkg) : cur));
    } else if (prev && budget === String(prev.price)) {
      setBudget("");
    }
    setErrors((m) => ({ ...m, packageKey: "" }));
  };

  const pickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_ATTACHMENTS - files.length;
    if (!list.length || room <= 0) return;
    setErrors((m) => ({ ...m, attachments: "" }));
    for (const f of list.slice(0, room)) {
      setUploading((n) => n + 1);
      try {
        const a = await uploadAttachment(f, { docs: true });
        setFiles((cur) => (cur.some((x) => x.url === a.url) ? cur : [...cur, a]));
      } catch (err) {
        setErrors((m) => ({ ...m, attachments: err instanceof Error ? err.message : "Faylni yuklab bo'lmadi" }));
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (list.length > room) setErrors((m) => ({ ...m, attachments: `Ko'pi bilan ${MAX_ATTACHMENTS} ta fayl` }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || uploading > 0) return;
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
          deadline: "",
          dueDate: dueDate ?? "",
          urgent,
          packageKey,
          attachments: files,
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
      setDone({ id: json.data.id, queued: json.data.queued, availableFrom: json.data.availableFrom ?? null });
      clearDraft(draftKey);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Muvaffaqiyat: keyingi qadamlar + buyurtmaga to'g'ri havola ---------- */
  if (done) {
    const orderHref = `/kabinet/buyurtmalar?id=${done.id}`;
    // Halol muddat (#43): ta'tilda — qaytish sanasi bilan, band — bo'shagach; aks holda odatiy matn
    const firstStep = done.queued
      ? done.availableFrom
        ? `Mutaxassis ${formatDate(done.availableFrom)}gacha ta'tilda — qaytgach ko'rib chiqadi.`
        : `${specialistName} hozir band — bo'shagach so'rovingizni ko'rib chiqadi.`
      : `${specialistName} uni ko'rib chiqadi va qabul qiladi yoki savol beradi.`;
    const steps = [
      { icon: ClipboardList, t: "So'rov mutaxassis kabinetiga tushdi", d: firstStep },
      { icon: MessageCircle, t: "Buyurtma chatida yozishasiz", d: "Savollar, fayllar va video qo'ng'iroq havolasi — hammasi buyurtma ichida." },
      { icon: Lock, t: "Narx kelishilgach — xavfsiz to'lov", d: "Pul eskrouda saqlanadi, ishni qabul qilganingizdan keyingina mutaxassisga o'tadi." },
    ];
    return (
      <div className="card-elevated animate-fade-up overflow-hidden" style={{ animationDuration: "0.45s" }}>
        <div className="px-6 pb-6 pt-8 text-center sm:px-10 sm:pt-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success-text">
            <CheckCircle2 size={34} />
          </span>
          <span className="eyebrow mt-6 justify-center">Buyurtma yuborildi</span>
          <h2 className="display-xl mt-3 text-[28px] text-fg sm:text-[34px]">
            Rahmat, so'rov <span className="accent-serif text-accent">yetib bordi</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-fg-2">
            {done.queued && done.availableFrom ? (
              <>
                <span className="font-semibold text-fg">{specialistName}</span> {formatDate(done.availableFrom)}gacha ta'tilda — qaytgach so'rovingizni ko'rib chiqadi. Holatni «Buyurtmalarim» bo'limida kuzatib boring.
              </>
            ) : done.queued ? (
              <>
                <span className="font-semibold text-fg">{specialistName}</span> hozir band — bo'shagach so'rovingizni ko'rib chiqadi. Holatni «Buyurtmalarim» bo'limida kuzatib boring.
              </>
            ) : (
              <>
                <span className="font-semibold text-fg">{specialistName}</span> so'rovingizni kabinetida ko'radi. Holatni «Buyurtmalarim» bo'limida kuzatib boring.
              </>
            )}
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
        Barcha maydonlar o'zbek tilida to'ldiriladi. Paket, byudjet, muddat va fayllar ixtiyoriy.
      </p>
      {/* Qoralama tiklandi (F56) — yopiladigan eslatma */}
      {draftRestored && (
        <div role="status" className="mb-5 flex items-center justify-between gap-3 rounded-[14px] bg-accent-soft px-3.5 py-2.5 text-[13px] font-medium text-accent-text">
          <span>Qoralama tiklandi — oxirgi yozganlaringiz qayta yuklandi.</span>
          <button type="button" onClick={() => setDraftRestored(false)} aria-label="Eslatmani yopish" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-fg/8">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="space-y-6">
        {/* Xizmat paketi (F31) */}
        {packages.length > 0 && (
          <fieldset ref={setRef("packageKey")} tabIndex={-1} className="outline-none">
            <legend className="field-label">
              Xizmat paketi <span className="font-normal text-fg-4">(ixtiyoriy)</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Xizmat paketi">
              {packages.map((p) => {
                const on = packageKey === p.key;
                const tier = PACKAGE_TIERS.find((t) => t.key === p.key)?.label ?? p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => choosePackage(on ? null : p)}
                    className={cn(
                      "flex min-h-[88px] flex-col items-start rounded-[16px] border p-3.5 text-left transition active:scale-[0.99]",
                      on ? "border-fg bg-fg/4 ring-1 ring-fg" : "border-line bg-surface hover:border-line-2",
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-3">{tier}</span>
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", on ? "border-fg bg-fg text-bg" : "border-line-2")}>{on && <Check size={12} />}</span>
                    </span>
                    <span className="mt-1 line-clamp-1 text-[14px] font-semibold text-fg">{p.title}</span>
                    <span className="mt-0.5 font-display text-[16px] font-semibold text-fg tabular-nums">{formatPrice(p.price, { compact: true })}</span>
                    <span className="mt-0.5 text-[12px] text-fg-3">
                      {p.deliveryDays} kun · {p.revisions} ta tuzatish
                    </span>
                  </button>
                );
              })}
            </div>
            {(() => {
              const sel = packages.find((p) => p.key === packageKey);
              return sel && sel.features.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Paket tarkibi">
                  {sel.features.map((f) => (
                    <li key={f} className="inline-flex items-center gap-1 rounded-full bg-fg/6 px-2.5 py-1 text-[12px] text-fg-2">
                      <Check size={11} className="text-success-text" /> {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-fg-4">
                  <Package size={13} /> Paket tanlansa narx va muddat avtomatik to'ldiriladi — keyin o'zgartirishingiz mumkin.
                </p>
              );
            })()}
            {errors.packageKey && <p className="field-error">{errors.packageKey}</p>}
          </fieldset>
        )}

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
                ? `Mutaxassisning boshlang'ich narxi ${formatPrice(priceFrom)} — kichikroq byudjet kelishuvni qiyinlashtirishi mumkin.`
                : budgetHint
                  ? `${budgetHint}. Yakuniy narxni mutaxassis bilan kelishasiz — to'lov eskrou orqali, ish qabul qilingach o'tadi.`
                  : priceFrom
                    ? `Mutaxassis narxi ${formatPrice(priceFrom)} dan boshlanadi. Taxminiy summani yozing yoki bo'sh qoldiring.`
                    : "Taxminiy summani yozing yoki bo'sh qoldiring — narx kelishiladi."}
            </p>
          )}
        </div>

        {/* Topshirish sanasi (F37) */}
        <div>
          <label htmlFor="order-due" className="field-label">
            Topshirish sanasi <span className="font-normal text-fg-4">(ixtiyoriy)</span>
          </label>
          <DueDatePicker id="order-due" value={dueDate} onChange={(v) => (setDueDate(v), setErrors((m) => ({ ...m, dueDate: "" })))} blocked={blockedDates} error={errors.dueDate} describedBy="order-due-hint" />
          {errors.dueDate ? (
            <p className="field-error">{errors.dueDate}</p>
          ) : (
            <p id="order-due-hint" className="mt-1.5 text-[12px] text-fg-4">
              {blockedDates.length ? "Qizil belgilangan kunlarda mutaxassis band. " : ""}Muddatdan 2 kun oldin ikkalangizga eslatma keladi.
            </p>
          )}
        </div>

        {/* Shoshilinch (F30) */}
        <div className="flex items-start justify-between gap-4 rounded-[16px] border border-line bg-surface-2 p-3.5">
          <div className="min-w-0">
            <p id="order-urgent-label" className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
              <Zap size={15} className="text-warning-text" /> Shoshilinch buyurtma <span className="font-normal text-fg-3">(+{urgentPct}%)</span>
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-fg-3">
              Mutaxassis ishni birinchi navbatda bajaradi. Narx belgilanganda {urgentPct}% ustama qo'shiladi
              {urgent && budgetNum > 0 ? ` — taxminan ${formatPrice(budgetNum + Math.round((budgetNum * urgentPct) / 100), { compact: true })}` : ""}.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={urgent} aria-labelledby="order-urgent-label" onClick={() => setUrgent((v) => !v)} className="switch mt-1" />
        </div>

        {/* Fayllar (F35) */}
        <div ref={setRef("attachments")} tabIndex={-1} className="outline-none">
          <span className="field-label">
            Fayllar <span className="font-normal text-fg-4">(ixtiyoriy, {MAX_ATTACHMENTS} tagacha)</span>
          </span>
          <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT_DOCS} multiple className="hidden" onChange={pickFiles} tabIndex={-1} />
          <div className="flex flex-wrap items-center gap-2">
            {files.map((f) => (
              <span key={f.url} className="inline-flex min-h-11 max-w-[240px] items-center gap-2 rounded-full border border-line bg-surface pl-1.5 pr-1 text-[13px] text-fg-2">
                {isImageAttachment(f) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : null}
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x.url !== f.url))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-fg/6" aria-label={`${f.name} — olib tashlash`}>
                  <X size={14} />
                </button>
              </span>
            ))}
            {uploading > 0 && (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-fg/6 px-3.5 text-[13px] text-fg-3">
                <Spinner className="h-4 w-4" /> Yuklanmoqda…
              </span>
            )}
            {files.length < MAX_ATTACHMENTS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-line-2 px-4 text-[13px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
              >
                <ImagePlus size={15} /> Fayl qo'shish
              </button>
            )}
          </div>
          {errors.attachments ? (
            <p className="field-error">{errors.attachments}</p>
          ) : (
            <p className="mt-1.5 text-[12px] text-fg-4">Brief, texnik topshiriq yoki referenslar — rasm (JPG, PNG, WEBP, GIF) yoki hujjat (PDF, DOC, DOCX), har biri 5 MB gacha.</p>
          )}
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
        <div role="alert" className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/mutaxassislar/${specialistSlug}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-semibold text-fg-2 transition hover:text-fg">
          <ArrowLeft size={15} /> Profilga qaytish
        </Link>
        <Button type="submit" variant="accent" size="lg" disabled={busy || uploading > 0} className="sm:min-w-[220px]">
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
