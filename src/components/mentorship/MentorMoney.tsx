"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { showToast } from "@/components/ui/toast";
import { MIN_PAYOUT, MENTOR_FEE_PCT, EARNING_HOLD_DAYS, PURCHASE_LABEL, formatSom as fmt } from "@/lib/mentorship/format";
import type { PurchaseType } from "@/lib/mentorship/format";
import { formatCard } from "@/lib/payments/card";
import { cn, formatDateTime } from "@/lib/utils";

export type MoneyData = {
  mentorId: string;
  balance: { pending: number; available: number; paidOut: number; gross: number; sales: number };
  earnings: { id: string; kind: PurchaseType; title: string; gross: number; net: number; status: string; createdAt: number }[];
  payouts: { id: string; amount: number; status: string; createdAt: number; note: string | null }[];
  promos: { id: string; code: string; percent: number; uses: number; maxUses: number | null; expiresAt: number | null; isActive: boolean; courseTitle: string | null }[];
  courses: { id: string; title: string }[];
  slots: { id: string; startsAt: number; durationMin: number; priceSom: number; status: string }[];
  subPrice: number;
  refPercent: number;
};

async function call(url: string, method: string, body?: unknown): Promise<void> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: Record<string, string> };
  if (!r.ok) throw new Error(Object.values(j.fields ?? {})[0] || j.error || "Xatolik");
}

/** 0 ham «0 so'm» (formatSom 0 ni «Bepul» deydi — daromadda noto'g'ri) */
const formatSom = (n: number) => (n ? fmt(n) : "0 so'm");

const STATUS: Record<string, string> = { pending: "Ushlab turilmoqda", available: "Yechishga tayyor", paid_out: "Yechilgan", refunded: "Qaytarilgan", requested: "Kutilmoqda", paid: "To'langan", rejected: "Rad etilgan" };

/** Mentor daromadi va savdo sozlamalari: balans, yechish, promokod, obuna narxi, tavsiya foizi, 1:1 vaqtlar */
export function MentorMoney({ d }: { d: MoneyData }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      showToast(ok, "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
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
        <Stat label="Yechishga tayyor" value={formatSom(d.balance.available)} strong />
        <Stat label="Ushlab turilmoqda" value={formatSom(d.balance.pending)} hint={`${EARNING_HOLD_DAYS} kundan keyin ochiladi`} />
        <Stat label="Yechib olingan" value={formatSom(d.balance.paidOut)} />
        <Stat label="Jami sotuv" value={`${d.balance.sales} ta`} hint={`${formatSom(d.balance.gross)} · komissiya ${MENTOR_FEE_PCT}%`} />
      </section>

      <Box title="Pulni kartaga yechish" hint={`Kamida ${formatSom(MIN_PAYOUT)}. Administrator kartaga o'tkazadi.`}>
        <div className="flex flex-wrap gap-2">
          <input value={card} onChange={(e) => setCard(formatCard(e.target.value))} inputMode="numeric" placeholder="8600 0000 0000 0000" aria-label="Karta raqami" className="field h-11 min-w-0 flex-1 text-[14px] tabular-nums" />
          <button type="button" disabled={busy === "payout" || d.balance.available < MIN_PAYOUT} onClick={() => void run("payout", () => call("/api/mentorlik/daromad", "POST", { card }), "So'rov yuborildi")} className="btn-accent inline-flex h-11 items-center gap-2 px-5 text-[14px] disabled:opacity-50">
            {busy === "payout" && <Loader2 size={15} className="animate-spin" />} Yechish — {formatSom(d.balance.available)}
          </button>
        </div>
        {d.payouts.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-[13px]">
            {d.payouts.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span className="text-fg-3">{formatDateTime(p.createdAt)}</span>
                <span className="font-semibold tabular-nums text-fg">{formatSom(p.amount)}</span>
                <span className={cn(p.status === "paid" ? "text-success-text" : p.status === "rejected" ? "text-danger" : "text-fg-3")}>{STATUS[p.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box title="Obuna va tavsiya" hint="Obunachilar yopiq postlarni va narxli efirlarni ko'radi. Tavsiya: do'sti chegirma oladi, tavsiya qilgan — kredit.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12.5px] font-semibold text-fg-3">
            Oylik obuna narxi (so&apos;m, bo&apos;sh = o&apos;chiq)
            <input value={sub} onChange={(e) => setSub(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="49000" className="field mt-1 h-11 w-full text-[14px]" />
          </label>
          <label className="block text-[12.5px] font-semibold text-fg-3">
            Tavsiya chegirmasi (%, 0–50)
            <input value={ref} onChange={(e) => setRef(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="field mt-1 h-11 w-full text-[14px]" />
          </label>
        </div>
        <button type="button" disabled={busy === "set"} onClick={() => void run("set", () => call("/api/mentorlik/sozlama", "PATCH", { subPrice: Number(sub || 0), refPercent: Number(ref || 0) }), "Saqlandi")} className="mt-3 h-10 rounded-full bg-fg px-5 text-[13.5px] font-semibold text-bg">
          Saqlash
        </button>
      </Box>

      <Box title="Promokodlar">
        <div className="grid gap-2 sm:grid-cols-[1fr_90px_1fr]">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KOD (masalan YOZ20)" maxLength={20} className="field h-10 text-[14px] uppercase" aria-label="Kod" />
          <input value={percent} onChange={(e) => setPercent(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="%" className="field h-10 text-[14px]" aria-label="Chegirma foizi" />
          <select value={promoCourse} onChange={(e) => setPromoCourse(e.target.value)} className="field h-10 text-[13.5px]" aria-label="Kurs">
            <option value="">Barcha mahsulotlar</option>
            {d.courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Limit (nechta marta)" className="field h-10 text-[14px] sm:col-span-1" />
          <input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Necha kun amal qiladi" className="field h-10 text-[14px]" />
          <button type="button" disabled={busy === "promo"} onClick={() => void run("promo", () => call("/api/mentorlik/promo", "POST", { code, percent: Number(percent), courseId: promoCourse || null, maxUses: maxUses ? Number(maxUses) : null, days: days ? Number(days) : null }), "Promokod yaratildi")} className="h-10 rounded-full bg-fg px-5 text-[13.5px] font-semibold text-bg">
            Yaratish
          </button>
        </div>
        {d.promos.length > 0 && (
          <ul className="mt-3 divide-y divide-line">
            {d.promos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-[13.5px]">
                <span className={cn("rounded-md bg-fg/6 px-2 py-0.5 font-bold tracking-wide", !p.isActive && "line-through opacity-50")}>{p.code}</span>
                <span className="font-semibold text-fg">−{p.percent}%</span>
                <span className="text-fg-3">{p.courseTitle ?? "hammasi"} · {p.uses}{p.maxUses ? `/${p.maxUses}` : ""} marta{p.expiresAt ? ` · ${formatDateTime(p.expiresAt)} gacha` : ""}</span>
                <button type="button" onClick={() => void run(`p${p.id}`, () => call("/api/mentorlik/promo", "PATCH", { id: p.id, active: !p.isActive }), p.isActive ? "O'chirildi" : "Yoqildi")} className="ml-auto text-[12.5px] font-semibold text-fg-3 hover:text-fg">
                  {p.isActive ? "O'chirish" : "Yoqish"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box title="1:1 konsultatsiya vaqtlari" hint="Talaba vaqtni tanlab to'laydi, belgilangan soatda video qo'ng'iroq ochiladi.">
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field h-10 text-[14px]" aria-label="Boshlanish vaqti" />
          <select value={dur} onChange={(e) => setDur(e.target.value)} className="field h-10 text-[14px]" aria-label="Davomiylik">
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>{m} daq</option>
            ))}
          </select>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Narx, so'm" className="field h-10 text-[14px]" />
          <button type="button" disabled={busy === "slot" || !when} onClick={() => void run("slot", () => call("/api/mentorlik/slots", "POST", { startsAt: new Date(when).getTime(), durationMin: Number(dur), priceSom: Number(price || 0) }), "Vaqt qo'shildi")} className="h-10 rounded-full bg-fg px-5 text-[13.5px] font-semibold text-bg">
            Qo&apos;shish
          </button>
        </div>
        {d.slots.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-[13.5px]">
            {d.slots.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="font-semibold text-fg">{formatDateTime(s.startsAt)}</span>
                <span className="text-fg-3">{s.durationMin} daq · {formatSom(s.priceSom)}</span>
                <span className={cn("ml-auto text-[12.5px] font-semibold", s.status === "booked" ? "text-success-text" : "text-fg-3")}>{s.status === "booked" ? "Band qilingan" : s.status === "held" ? "To'lov kutilmoqda" : "Bo'sh"}</span>
                {s.status !== "booked" && (
                  <button type="button" onClick={() => void run(`s${s.id}`, () => call(`/api/mentorlik/slots?id=${s.id}`, "DELETE"), "O'chirildi")} className="text-[12.5px] font-semibold text-fg-3 hover:text-danger">
                    O&apos;chirish
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box title="So'nggi sotuvlar">
        {d.earnings.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Hozircha sotuv yo&apos;q. Kurs narxini belgilang, promokod yarating va efirlarda ulashing.</p>
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
                  <span className="rounded-md bg-fg/6 px-1.5 py-px text-[11px] font-bold text-fg-2">{PURCHASE_LABEL[e.kind]}</span>
                  <span>{formatDateTime(e.createdAt)} · {STATUS[e.status]}</span>
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
