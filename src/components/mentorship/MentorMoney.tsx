"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { MIN_PAYOUT, MENTOR_FEE_PCT, EARNING_HOLD_DAYS, MENTOR_FEATURES } from "@/lib/mentorship/format";
import type { PurchaseType } from "@/lib/mentorship/format";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Locale } from "@/lib/i18n";
import { MK, formatSomTr, moneyStatusTr, purchaseLabelTr, countTa } from "@/lib/i18n/dict/mentorship";
import { formatCard } from "@/lib/payments/card";
import { cn, formatDateTime } from "@/lib/utils";

export type MoneyData = {
  mentorId: string;
  balance: { pending: number; available: number; paidOut: number; gross: number; sales: number };
  earnings: { id: string; kind: PurchaseType; title: string; gross: number; net: number; status: string; createdAt: number; availableAt?: number | null }[];
  payouts: { id: string; amount: number; status: string; createdAt: number; note: string | null }[];
  promos: { id: string; code: string; percent: number; uses: number; maxUses: number | null; expiresAt: number | null; isActive: boolean; courseTitle: string | null }[];
  courses: { id: string; title: string }[];
  slots: { id: string; startsAt: number; durationMin: number; priceSom: number; status: string }[];
  subPrice: number;
  refPercent: number;
};

async function call(url: string, method: string, body?: unknown, errText = "Xatolik"): Promise<void> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: Record<string, string> };
  if (!r.ok) throw new Error(Object.values(j.fields ?? {})[0] || j.error || errText);
}

/** 0 ham «0 so'm» (formatSom 0 ni «Bepul» deydi — daromadda noto'g'ri) */
const somOf = (til: Locale, n: number) => (n ? formatSomTr(til, n) : tr(til, MK.zeroSom));

/** Mentor daromadi va savdo sozlamalari: balans, yechish, promokod, obuna narxi, tavsiya foizi, 1:1 vaqtlar */
export function MentorMoney({ d }: { d: MoneyData }) {
  const til = useLocale();
  const router = useRouter();
  const formatSom = (n: number) => somOf(til, n);
  const STATUS = (st: string) => moneyStatusTr(til, st);
  const err = tr(til, MK.error);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      showToast(ok, "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : err, "error");
    } finally {
      setBusy(null);
    }
  };

  const [card, setCard] = useState("");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [promoCourse, setPromoCourse] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [days, setDays] = useState("");
  const [sub, setSub] = useState(String(d.subPrice || ""));
  const [ref, setRef] = useState(String(d.refPercent));
  const [when, setWhen] = useState("");
  const [dur, setDur] = useState("30");
  const [price, setPrice] = useState("");

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr(til, MK.readyToWithdraw)} value={formatSom(d.balance.available)} strong />
        <Stat label={tr(til, MK.onHold)} value={formatSom(d.balance.pending)} hint={MK.opensAfterDays[til](EARNING_HOLD_DAYS)} />
        <Stat label={tr(til, MK.withdrawn)} value={formatSom(d.balance.paidOut)} />
        <Stat label={tr(til, MK.totalSales)} value={countTa(til, d.balance.sales)} hint={MK.grossFee[til](formatSom(d.balance.gross), MENTOR_FEE_PCT)} />
      </section>

      <Box title={tr(til, MK.withdrawTitle)} hint={MK.withdrawHint[til](formatSom(MIN_PAYOUT))}>
        <div className="flex flex-wrap gap-2">
          <input value={card} onChange={(e) => setCard(formatCard(e.target.value))} inputMode="numeric" placeholder="8600 0000 0000 0000" aria-label={tr(til, MK.cardNumber)} className="field h-11 min-w-0 flex-1 text-[14px] tabular-nums" />
          <button type="button" disabled={busy === "payout" || d.balance.available < MIN_PAYOUT} onClick={() => void run("payout", () => call("/api/mentorlik/daromad", "POST", { card }, err), tr(til, MK.requestSent))} className="btn-accent inline-flex h-11 items-center gap-2 px-5 text-[14px] disabled:opacity-50">
            {busy === "payout" && <Loader2 size={15} className="animate-spin" />} {MK.withdrawBtn[til](formatSom(d.balance.available))}
          </button>
        </div>
        {d.payouts.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-[13px]">
            {d.payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="text-fg-3">{formatDateTime(p.createdAt, til)}</span>
                <span className="font-semibold tabular-nums text-fg">{formatSom(p.amount)}</span>
                <span className={cn(p.status === "paid" ? "text-success-text" : p.status === "rejected" ? "text-danger" : "text-fg-3")}>{STATUS(p.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </Box>

      {/* Oylik obuna va tavsiya foizi — MENTOR_FEATURES bilan yashirin (soddalashtirish) */}
      {(MENTOR_FEATURES.monthlySub || MENTOR_FEATURES.referral) && (
        <>
      <Box title={tr(til, MK.subRefTitle)} hint={tr(til, MK.subRefHint)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12.5px] font-semibold text-fg-3">
            {tr(til, MK.subPrice)}
            <input value={sub} onChange={(e) => setSub(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="49000" className="field mt-1 h-11 w-full text-[14px]" />
          </label>
          <label className="block text-[12.5px] font-semibold text-fg-3">
            {tr(til, MK.refPercent)}
            <input value={ref} onChange={(e) => setRef(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="field mt-1 h-11 w-full text-[14px]" />
          </label>
        </div>
        <button type="button" disabled={busy === "set"} onClick={() => void run("set", () => call("/api/mentorlik/sozlama", "PATCH", { subPrice: Number(sub || 0), refPercent: Number(ref || 0) }, err), tr(til, MK.saved))} className="mt-3 h-10 rounded-full bg-fg px-5 text-[13.5px] font-semibold text-bg">
          {tr(til, MK.save)}
        </button>
      </Box>
        </>
      )}

      {MENTOR_FEATURES.promo && (
        <>
      <Box title={tr(til, MK.promos)}>
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_1fr]">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={tr(til, MK.promoCodePh)} maxLength={20} className="field h-10 text-[14px] uppercase" aria-label={tr(til, MK.code)} />
          <input value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="%" className="field h-10 text-[14px]" aria-label={tr(til, MK.discountPct)} />
          <select value={promoCourse} onChange={(e) => setPromoCourse(e.target.value)} className="field h-10 text-[13.5px]" aria-label={tr(til, MK.course)}>
            <option value="">{tr(til, MK.allProducts)}</option>
            {d.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={tr(til, MK.limitUses)} className="field h-10 text-[14px] sm:col-span-1" />
          <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={tr(til, MK.validDays)} className="field h-10 text-[14px]" />
          <button type="button" disabled={busy === "promo"} onClick={() => void run("promo", () => call("/api/mentorlik/promo", "POST", { code, percent: Number(percent), courseId: promoCourse || null, maxUses: maxUses ? Number(maxUses) : null, days: days ? Number(days) : null }, err), tr(til, MK.promoCreated))} className="h-10 rounded-full bg-fg px-5 text-[13.5px] font-semibold text-bg">
            {tr(til, MK.create)}
          </button>
        </div>
        {d.promos.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {d.promos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
                <span className={cn("rounded-md bg-fg/6 px-2 py-0.5 font-bold tracking-wide", !p.isActive && "line-through opacity-50")}>{p.code}</span>
                <span className="font-semibold text-fg">−{p.percent}%</span>
                <span className="text-fg-3">{p.courseTitle ?? tr(til, MK.allItems)} · {MK.usesN[til](`${p.uses}${p.maxUses ? `/${p.maxUses}` : ""}`)}{p.expiresAt ? ` · ${MK.until[til](formatDateTime(p.expiresAt, til))}` : ""}</span>
                <button type="button" onClick={() => void run(`p${p.id}`, () => call("/api/mentorlik/promo", "PATCH", { id: p.id, active: !p.isActive }, err), p.isActive ? tr(til, MK.disabled) : tr(til, MK.enabled))} className="ml-auto text-[12.5px] font-semibold text-fg-3 hover:text-fg">
                  {p.isActive ? tr(til, MK.disable) : tr(til, MK.enable)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Box>
        </>
      )}

      <Box title={tr(til, MK.slotsTitle)} hint={tr(til, MK.slotsHint)}>
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
          <span className="grid gap-1"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field h-10 text-[14px]" aria-label={tr(til, MK.startTime)} /><span className="text-[11.5px] text-fg-4">{tr(til, MK.tashkentTime)}</span></span>
          <select value={dur} onChange={(e) => setDur(e.target.value)} className="field h-10 text-[14px]" aria-label={tr(til, MK.duration)}>
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>{MK.minShort[til](m)}</option>
            ))}
          </select>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={tr(til, MK.priceSom)} className="field h-10 text-[14px]" />
          <button type="button" disabled={busy === "slot" || !when} onClick={() => void run("slot", () => call("/api/mentorlik/slots", "POST", { startsAt: new Date(when).getTime(), durationMin: Number(dur), priceSom: Number(price || 0) }, err), tr(til, MK.slotAdded))} className="h-10 rounded-full bg-fg px-5 text-[13.5px] font-semibold text-bg">
            {tr(til, MK.add)}
          </button>
        </div>
        {d.slots.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-[13.5px]">
            {d.slots.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="font-semibold text-fg">{formatDateTime(s.startsAt, til)}</span>
                <span className="text-fg-3">{MK.minShort[til](s.durationMin)} · {formatSom(s.priceSom)}</span>
                <span className={cn("ml-auto text-[12.5px] font-semibold", s.status === "booked" ? "text-success-text" : "text-fg-3")}>{s.status === "booked" ? tr(til, MK.booked) : s.status === "held" ? tr(til, MK.awaitingPayment) : tr(til, MK.freeSlot)}</span>
                {s.status !== "booked" && (
                  <button type="button" onClick={() => void run(`s${s.id}`, () => call(`/api/mentorlik/slots?id=${s.id}`, "DELETE", undefined, err), tr(til, MK.deleted))} className="text-[12.5px] font-semibold text-fg-3 hover:text-danger">
                    {tr(til, MK.del)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box title={tr(til, MK.recentSales)}>
        {d.earnings.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">{tr(til, MK.noSales)}</p>
        ) : (
          <ul className="divide-y divide-line text-[13.5px]">
            {d.earnings.map((e) => (
              /* Telefonda ikki qator: nom + summa, ostida tur · sana · holat (nom kesilmasin) */
              <li key={e.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-semibold text-fg">{e.title}</span>
                  <span className="shrink-0 tabular-nums text-fg">{formatSom(e.net)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
                  <span className="rounded-md bg-fg/6 px-1.5 py-px text-[11px] font-bold text-fg-2">{purchaseLabelTr(til, e.kind)}</span>
                  <span>{formatDateTime(e.createdAt, til)} · {STATUS(e.status)}{e.status === "pending" && e.availableAt ? ` · ${MK.opensAt[til](formatDateTime(e.availableAt, til))}` : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Box>
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={cn("card p-4", strong && "border-fg/40")}>
      <p className="text-[12px] font-semibold text-fg-3">{label}</p>
      <p className="mt-1 font-display text-[20px] font-extrabold tabular-nums text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-fg-4">{hint}</p>}
    </div>
  );
}
function Box({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card m-flat p-4 sm:p-5">
      <h2 className="text-[15px] font-bold text-fg">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}
