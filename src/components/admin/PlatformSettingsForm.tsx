"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, BadgePercent, CheckCircle2, Save, SlidersHorizontal } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { TOP_RATED_RULE } from "@/lib/constants";
import { formatNumber, formatPrice } from "@/lib/utils";

export interface PlatformSettingsValue {
  commissionPct: number;
  minPayout: number;
  minOrderAmount: number;
  /** Komissiya darajalari (F21): yangi mutaxassis (< 3 bajarilgan buyurtma) va Top mutaxassis */
  commissionPctNew?: number;
  commissionPctTop?: number;
}
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string; fields?: Record<string, string> };

const digits = (s: string) => s.replace(/\D/g, "");

/** Platforma sozlamalari: komissiya foizi (Upwork uslubi), minimal payout va minimal buyurtma summasi */
export function PlatformSettingsForm({ initial }: { initial: PlatformSettingsValue }) {
  const router = useRouter();
  const [pct, setPct] = useState(String(initial.commissionPct));
  const [pctNew, setPctNew] = useState(String(initial.commissionPctNew ?? 15));
  const [pctTop, setPctTop] = useState(String(initial.commissionPctTop ?? 7));
  const [minPayout, setMinPayout] = useState(formatNumber(initial.minPayout));
  const [minOrder, setMinOrder] = useState(formatNumber(initial.minOrderAmount));
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pctNum = Math.min(100, Number(digits(pct)) || 0);
  const pctNewNum = Math.min(100, Number(digits(pctNew)) || 0);
  const pctTopNum = Math.min(100, Number(digits(pctTop)) || 0);
  const minPayoutNum = Number(digits(minPayout)) || 0;
  const minOrderNum = Number(digits(minOrder)) || 0;
  const dirty =
    pctNum !== initial.commissionPct ||
    pctNewNum !== (initial.commissionPctNew ?? 15) ||
    pctTopNum !== (initial.commissionPctTop ?? 7) ||
    minPayoutNum !== initial.minPayout ||
    minOrderNum !== initial.minOrderAmount;
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
        body: JSON.stringify({ commissionPct: pctNum, commissionPctNew: pctNewNum, commissionPctTop: pctTopNum, minPayout: minPayoutNum, minOrderAmount: minOrderNum }),
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

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
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
    </form>
  );
}
