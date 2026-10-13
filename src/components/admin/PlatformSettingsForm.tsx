"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, BadgePercent, CheckCircle2, History, Save, SlidersHorizontal } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { TOP_RATED_RULE } from "@/lib/constants";
import { cn, formatDateTime, formatNumber, formatPrice } from "@/lib/utils";

export interface PlatformSettingsValue {
  commissionPct: number;
  minPayout: number;
  minOrderAmount: number;
  /** Komissiya darajalari (F21): yangi mutaxassis (< 3 bajarilgan buyurtma) va Top mutaxassis */
  commissionPctNew?: number;
  commissionPctTop?: number;
  /** Mutaxassis obunasi: oylik narx (so'm), bepul sinov va imtiyozli muddat (kun), talab yoqilgan (1) / o'chiq (0) */
  subscriptionPrice?: number;
  subscriptionTrialDays?: number;
  subscriptionGraceDays?: number;
  subscriptionEnforced?: number;
  /** Shoshilinch buyurtma ustamasi (%) va USD kursi (1 $ = N so'm) */
  urgentPct?: number;
  usdRate?: number;
}

/** Sozlamalar tarixi yozuvi (admin/queries.ts listSettingsHistory bilan bir xil shakl) */
export interface SettingsHistoryItem {
  id: string;
  at: number;
  actor: { name: string; email: string } | null;
  changes: Array<{ key: string; from: number | null; to: number | null }>;
}

const DEFAULTS = { subscriptionPrice: 50_000, subscriptionTrialDays: 30, subscriptionGraceDays: 3, subscriptionEnforced: 1, urgentPct: 20, usdRate: 12_700 } as const;

/** Tarixda kalit nomi va qiymat formati */
const KEY_META: Record<string, { label: string; fmt: (v: number) => string }> = {
  commissionPctNew: { label: "Komissiya: yangi mutaxassis", fmt: (v) => `${v}%` },
  commissionPct: { label: "Komissiya: oddiy daraja", fmt: (v) => `${v}%` },
  commissionPctTop: { label: "Komissiya: top mutaxassis", fmt: (v) => `${v}%` },
  minOrderAmount: { label: "Minimal buyurtma", fmt: (v) => formatPrice(v) },
  minPayout: { label: "Minimal payout", fmt: (v) => formatPrice(v) },
  subscriptionPrice: { label: "Obuna narxi (oyiga)", fmt: (v) => formatPrice(v) },
  subscriptionTrialDays: { label: "Bepul sinov muddati", fmt: (v) => `${v} kun` },
  subscriptionGraceDays: { label: "Imtiyozli muddat", fmt: (v) => `${v} kun` },
  subscriptionEnforced: { label: "Obuna talabi", fmt: (v) => (v === 1 ? "Yoqilgan" : "O'chirilgan") },
  urgentPct: { label: "Shoshilinch ustama", fmt: (v) => `${v}%` },
  usdRate: { label: "USD kursi", fmt: (v) => `1 $ = ${formatNumber(v)} so'm` },
};
const fmtVal = (key: string, v: number | null) => (v == null ? "—" : (KEY_META[key]?.fmt ?? String)(v));
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const digits = (s: string) => s.replace(/\D/g, "");

/** Platforma sozlamalari: komissiya foizi (Upwork uslubi), minimal payout va minimal buyurtma summasi */
export function PlatformSettingsForm({ initial, history = [] }: { initial: PlatformSettingsValue; history?: SettingsHistoryItem[] }) {
  const router = useRouter();
  const [pct, setPct] = useState(String(initial.commissionPct));
  const [pctNew, setPctNew] = useState(String(initial.commissionPctNew ?? 15));
  const [pctTop, setPctTop] = useState(String(initial.commissionPctTop ?? 7));
  const [minPayout, setMinPayout] = useState(formatNumber(initial.minPayout));
  const [minOrder, setMinOrder] = useState(formatNumber(initial.minOrderAmount));
  const init = {
    subscriptionPrice: initial.subscriptionPrice ?? DEFAULTS.subscriptionPrice,
    subscriptionTrialDays: initial.subscriptionTrialDays ?? DEFAULTS.subscriptionTrialDays,
    subscriptionGraceDays: initial.subscriptionGraceDays ?? DEFAULTS.subscriptionGraceDays,
    subscriptionEnforced: initial.subscriptionEnforced ?? DEFAULTS.subscriptionEnforced,
    urgentPct: initial.urgentPct ?? DEFAULTS.urgentPct,
    usdRate: initial.usdRate ?? DEFAULTS.usdRate,
  };
  const [subPrice, setSubPrice] = useState(formatNumber(init.subscriptionPrice));
  const [trialDays, setTrialDays] = useState(String(init.subscriptionTrialDays));
  const [graceDays, setGraceDays] = useState(String(init.subscriptionGraceDays));
  const [enforced, setEnforced] = useState(init.subscriptionEnforced === 1);
  const [urgent, setUrgent] = useState(String(init.urgentPct));
  const [usdRate, setUsdRate] = useState(formatNumber(init.usdRate));
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pctNum = Math.min(100, Number(digits(pct)) || 0);
  const pctNewNum = Math.min(100, Number(digits(pctNew)) || 0);
  const pctTopNum = Math.min(100, Number(digits(pctTop)) || 0);
  const minPayoutNum = Number(digits(minPayout)) || 0;
  const minOrderNum = Number(digits(minOrder)) || 0;
  const subPriceNum = Number(digits(subPrice)) || 0;
  const trialNum = Number(digits(trialDays)) || 0;
  const graceNum = Number(digits(graceDays)) || 0;
  const urgentNum = Number(digits(urgent)) || 0;
  const usdNum = Number(digits(usdRate)) || 0;
  const dirty =
    pctNum !== initial.commissionPct ||
    pctNewNum !== (initial.commissionPctNew ?? 15) ||
    pctTopNum !== (initial.commissionPctTop ?? 7) ||
    minPayoutNum !== initial.minPayout ||
    minOrderNum !== initial.minOrderAmount ||
    subPriceNum !== init.subscriptionPrice ||
    trialNum !== init.subscriptionTrialDays ||
    graceNum !== init.subscriptionGraceDays ||
    (enforced ? 1 : 0) !== init.subscriptionEnforced ||
    urgentNum !== init.urgentPct ||
    usdNum !== init.usdRate;
  const example = 1_000_000;

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 4000);
    return () => window.clearTimeout(t);
  }, [saved]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !dirty) return;
    const errs: Record<string, string> = {};
    if (pctNum > 50) errs.commissionPct = "Ko'pi bilan 50%";
    if (pctNewNum > 50) errs.commissionPctNew = "Ko'pi bilan 50%";
    if (pctTopNum > 50) errs.commissionPctTop = "Ko'pi bilan 50%";
    if (pctTopNum > pctNum) errs.commissionPctTop = "Top daraja oddiy foizdan katta bo'lmasin";
    if (minOrderNum < 1000) errs.minOrderAmount = "Kamida 1 000 so'm";
    if (minPayoutNum < 1000) errs.minPayout = "Kamida 1 000 so'm";
    if (subPriceNum > 10_000_000) errs.subscriptionPrice = "Ko'pi bilan 10 mln so'm";
    else if (subPriceNum > 0 && subPriceNum < 1000) errs.subscriptionPrice = "Kamida 1 000 so'm (yoki 0 — bepul)";
    if (trialNum > 365) errs.subscriptionTrialDays = "Ko'pi bilan 365 kun";
    if (graceNum > 60) errs.subscriptionGraceDays = "Ko'pi bilan 60 kun";
    if (urgentNum > 100) errs.urgentPct = "Ko'pi bilan 100%";
    if (usdNum < 1000 || usdNum > 100_000) errs.usdRate = "1 000 – 100 000 so'm oralig'ida";
    if (Object.keys(errs).length) {
      setFields(errs);
      return;
    }
    setFields({});
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionPct: pctNum,
          commissionPctNew: pctNewNum,
          commissionPctTop: pctTopNum,
          minPayout: minPayoutNum,
          minOrderAmount: minOrderNum,
          subscriptionPrice: subPriceNum,
          subscriptionTrialDays: trialNum,
          subscriptionGraceDays: graceNum,
          subscriptionEnforced: enforced ? 1 : 0,
          urgentPct: urgentNum,
          usdRate: usdNum,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<PlatformSettingsValue> | null;
      if (!json || !json.ok) {
        setError(json?.error ?? "Serverda kutilmagan xatolik");
        if (json && !json.ok && json.fields) setFields(json.fields);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6" noValidate>
      <div className="flex items-start gap-3">
        <span className="icon-tile">
          <SlidersHorizontal size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[18px] font-semibold text-fg">Platforma sozlamalari</h3>
          <p className="mt-0.5 text-[13px] text-fg-3">Yangi to'lovlarga darhol qo'llanadi. Allaqachon to'langan buyurtmalar o'z foizini saqlaydi.</p>
        </div>
      </div>

      <GroupTitle>Komissiya darajalari</GroupTitle>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="set-pct-new" className="field-label">
            Yangi mutaxassis (%)
          </label>
          <div className="relative">
            <input id="set-pct-new" className="field !pr-10 tabular-nums" inputMode="numeric" value={pctNew} onChange={(e) => setPctNew(digits(e.target.value).slice(0, 3))} aria-invalid={Boolean(fields.commissionPctNew)} aria-describedby="set-pct-new-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">%</span>
          </div>
          {fields.commissionPctNew ? <p className="field-error">{fields.commissionPctNew}</p> : <p id="set-pct-new-hint" className="mt-1 text-[11px] text-fg-4">3 tadan kam bajarilgan buyurtma</p>}
        </div>
        <div>
          <label htmlFor="set-pct" className="field-label">
            Oddiy daraja (%)
          </label>
          <div className="relative">
            <input id="set-pct" className="field !pr-10 tabular-nums" inputMode="numeric" value={pct} onChange={(e) => setPct(digits(e.target.value).slice(0, 3))} aria-invalid={Boolean(fields.commissionPct)} aria-describedby="set-pct-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">%</span>
          </div>
          {fields.commissionPct ? <p className="field-error">{fields.commissionPct}</p> : <p id="set-pct-hint" className="mt-1 text-[11px] text-fg-4">3 va undan ko'p bajarilgan buyurtma</p>}
        </div>
        <div>
          <label htmlFor="set-pct-top" className="field-label">
            Top mutaxassis (%)
          </label>
          <div className="relative">
            <input id="set-pct-top" className="field !pr-10 tabular-nums" inputMode="numeric" value={pctTop} onChange={(e) => setPctTop(digits(e.target.value).slice(0, 3))} aria-invalid={Boolean(fields.commissionPctTop)} aria-describedby="set-pct-top-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">%</span>
          </div>
          {fields.commissionPctTop ? <p className="field-error">{fields.commissionPctTop}</p> : <p id="set-pct-top-hint" className="mt-1 text-[11px] text-fg-4">{`Reyting ≥ ${TOP_RATED_RULE.minRating} va ≥ ${TOP_RATED_RULE.minReviews} ta sharh`}</p>}
        </div>
      </div>

      <GroupTitle>Limitlar</GroupTitle>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="set-minorder" className="field-label">
            Minimal buyurtma
          </label>
          <div className="relative">
            <input id="set-minorder" className="field !pr-14 tabular-nums" inputMode="numeric" value={minOrder} onChange={(e) => setMinOrder(digits(e.target.value) ? formatNumber(Number(digits(e.target.value).slice(0, 9))) : "")} aria-invalid={Boolean(fields.minOrderAmount)} />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so'm</span>
          </div>
          {fields.minOrderAmount && <p className="field-error">{fields.minOrderAmount}</p>}
        </div>
        <div>
          <label htmlFor="set-minpayout" className="field-label">
            Minimal payout
          </label>
          <div className="relative">
            <input id="set-minpayout" className="field !pr-14 tabular-nums" inputMode="numeric" value={minPayout} onChange={(e) => setMinPayout(digits(e.target.value) ? formatNumber(Number(digits(e.target.value).slice(0, 9))) : "")} aria-invalid={Boolean(fields.minPayout)} />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so'm</span>
          </div>
          {fields.minPayout && <p className="field-error">{fields.minPayout}</p>}
        </div>
      </div>

      <GroupTitle>Mutaxassis obunasi</GroupTitle>
      <p className="mt-1 text-[12px] leading-snug text-fg-3">
        Mijozlar bepul foydalanadi. Mutaxassis oylik obuna to&apos;laydi; muddati (sinov + imtiyozli muddat) o&apos;tsa va talab yoqilgan bo&apos;lsa — profili katalog, xarita va qidiruvdan
        yashiriladi, yangi buyurtma va taklif qabul qilmaydi. Mavjud buyurtmalar va eskrou davom etadi.
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={enforced}
        onClick={() => setEnforced((v) => !v)}
        className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-[var(--r-sm)] border border-line px-4 py-2.5 text-left transition hover:border-line-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-fg">Obuna talabi</span>
          <span className="block text-[12px] text-fg-3">{enforced ? "Yoqilgan — to'lamaganlar katalogdan yashiriladi" : "O'chirilgan — hamma mutaxassislar ko'rinadi (masalan, ishga tushirish davrida)"}</span>
        </span>
        <span aria-hidden="true" className="switch" aria-checked={enforced} />
      </button>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="set-sub-price" className="field-label">
            Oylik narx
          </label>
          <div className="relative">
            <input id="set-sub-price" className="field !pr-14 tabular-nums" inputMode="numeric" value={subPrice} onChange={(e) => setSubPrice(digits(e.target.value) ? formatNumber(Number(digits(e.target.value).slice(0, 8))) : "")} aria-invalid={Boolean(fields.subscriptionPrice)} aria-describedby="set-sub-price-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so&apos;m</span>
          </div>
          {fields.subscriptionPrice ? <p className="field-error">{fields.subscriptionPrice}</p> : <p id="set-sub-price-hint" className="mt-1 text-[11px] text-fg-4">3/6/12 oylik rejalarga chegirma qo&apos;llanadi</p>}
        </div>
        <div>
          <label htmlFor="set-trial" className="field-label">
            Bepul sinov
          </label>
          <div className="relative">
            <input id="set-trial" className="field !pr-12 tabular-nums" inputMode="numeric" value={trialDays} onChange={(e) => setTrialDays(digits(e.target.value).slice(0, 3))} aria-invalid={Boolean(fields.subscriptionTrialDays)} aria-describedby="set-trial-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">kun</span>
          </div>
          {fields.subscriptionTrialDays ? <p className="field-error">{fields.subscriptionTrialDays}</p> : <p id="set-trial-hint" className="mt-1 text-[11px] text-fg-4">Ro&apos;yxatdan o&apos;tgan kundan (obuna ishga tushishidan oldingi profillar uchun — ishga tushgan kundan) hisoblanadi</p>}
        </div>
        <div>
          <label htmlFor="set-grace" className="field-label">
            Imtiyozli muddat
          </label>
          <div className="relative">
            <input id="set-grace" className="field !pr-12 tabular-nums" inputMode="numeric" value={graceDays} onChange={(e) => setGraceDays(digits(e.target.value).slice(0, 2))} aria-invalid={Boolean(fields.subscriptionGraceDays)} aria-describedby="set-grace-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">kun</span>
          </div>
          {fields.subscriptionGraceDays ? <p className="field-error">{fields.subscriptionGraceDays}</p> : <p id="set-grace-hint" className="mt-1 text-[11px] text-fg-4">Muddat tugagach hali ko&apos;rinib turadi</p>}
        </div>
      </div>

      <GroupTitle>Boshqa</GroupTitle>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="set-urgent" className="field-label">
            Shoshilinch ustama (%)
          </label>
          <div className="relative">
            <input id="set-urgent" className="field !pr-10 tabular-nums" inputMode="numeric" value={urgent} onChange={(e) => setUrgent(digits(e.target.value).slice(0, 3))} aria-invalid={Boolean(fields.urgentPct)} aria-describedby="set-urgent-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">%</span>
          </div>
          {fields.urgentPct ? <p className="field-error">{fields.urgentPct}</p> : <p id="set-urgent-hint" className="mt-1 text-[11px] text-fg-4">Shoshilinch buyurtmada narxga qo&apos;shiladi (mutaxassisga)</p>}
        </div>
        <div>
          <label htmlFor="set-usd" className="field-label">
            USD kursi (1 $)
          </label>
          <div className="relative">
            <input id="set-usd" className="field !pr-14 tabular-nums" inputMode="numeric" value={usdRate} onChange={(e) => setUsdRate(digits(e.target.value) ? formatNumber(Number(digits(e.target.value).slice(0, 6))) : "")} aria-invalid={Boolean(fields.usdRate)} aria-describedby="set-usd-hint" />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-fg-3">so&apos;m</span>
          </div>
          {fields.usdRate ? <p className="field-error">{fields.usdRate}</p> : <p id="set-usd-hint" className="mt-1 text-[11px] text-fg-4">Profillarda taxminiy $ narx uchun</p>}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-[14px] bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
        <BadgePercent size={16} className="mt-0.5 shrink-0 text-accent" />
        <span>
          Masalan, {formatPrice(example)} buyurtmadan oddiy darajada platformaga <span className="font-semibold text-fg">{formatPrice(Math.round((example * pctNum) / 100))}</span>, mutaxassisga{" "}
          <span className="font-semibold text-fg">{formatPrice(example - Math.round((example * pctNum) / 100))}</span> tushadi. Yangi mutaxassis {formatPrice(example - Math.round((example * pctNewNum) / 100))}, top mutaxassis{" "}
          {formatPrice(example - Math.round((example * pctTopNum) / 100))} oladi. Foiz narx belgilanganda buyurtmaga muhrlanadi.
        </span>
      </p>

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger-text">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-success-soft px-3.5 py-2.5 text-[13px] font-medium text-success-text">
          <CheckCircle2 size={15} /> Sozlamalar saqlandi
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <Button type="submit" size="md" disabled={busy || !dirty}>
          {busy ? <Spinner /> : <Save size={15} />} Saqlash
        </Button>
      </div>

      {/* ---------- O'zgarishlar tarixi (audit: admin_settings) ---------- */}
      <section className="mt-6 border-t border-line pt-5" aria-labelledby="settings-history-title">
        <h4 id="settings-history-title" className="flex items-center gap-2 text-[14px] font-semibold text-fg">
          <History size={16} className="text-fg-3" /> O&apos;zgarishlar tarixi
        </h4>
        {history.length === 0 ? (
          <p className="mt-2 text-[13px] text-fg-3">Hali o&apos;zgartirilmagan — barcha qiymatlar standart.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {history.map((h, i) => (
              <li key={h.id} className={cn("rounded-[var(--r-sm)] border border-line px-3.5 py-3", i === 0 && "bg-surface-2")}>
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]">
                  <span className="font-semibold text-fg">{h.actor ? h.actor.name : "Noma'lum admin"}</span>
                  <time dateTime={new Date(h.at).toISOString()} className="text-fg-3 tabular-nums">
                    {formatDateTime(h.at)}
                  </time>
                </p>
                <ul className="mt-1.5 space-y-1">
                  {h.changes.map((c) => (
                    <li key={c.key} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      <span className="text-fg-2">{KEY_META[c.key]?.label ?? c.key}:</span>
                      <span className="text-fg-3 line-through decoration-line-2 tabular-nums">{fmtVal(c.key, c.from)}</span>
                      <span aria-hidden="true" className="text-fg-4">
                        →
                      </span>
                      <span className="sr-only">dan</span>
                      <span className="font-semibold text-fg tabular-nums">{fmtVal(c.key, c.to)}</span>
                      <span className="sr-only">ga</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </form>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-3">{children}</p>;
}
