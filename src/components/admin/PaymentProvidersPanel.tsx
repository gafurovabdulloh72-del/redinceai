"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, RefreshCw, XCircle } from "lucide-react";
import { checkCard, CARD_BRAND_LABEL, formatCard } from "@/lib/payments/card";
import { cn } from "@/lib/utils";

/**
 * Admin: to'lov tizimlari boshqaruvi.
 * - Payme/Click: kalitlar holati avtomatik tekshiriladi (env to'liqmi, rejim, callback manzillari).
 *   Kalitlarning o'zi xavfsizlik uchun faqat Vercel env'da turadi — bu yerda holati ko'rinadi.
 * - Qo'lda o'tkazma: platforma kartasi shu yerda sozlanadi (saqlashdan oldin Luhn/BIN avtotekshiruv).
 */

interface Check {
  label: string;
  ok: boolean;
  hint?: string;
}
interface Status {
  payme: { configured: boolean; mode: "test" | "prod"; checks: Check[] };
  click: { configured: boolean; checks: Check[] };
  manual: { configured: boolean; source: "settings" | "env" | "none"; card: string; name: string; valid: boolean; brand: string | null; error: string | null };
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 size={15} className="shrink-0 text-success-text" aria-label="Sozlangan" /> : <XCircle size={15} className="shrink-0 text-danger-text" aria-label="Sozlanmagan" />;
}

export function PaymentProvidersPanel() {
  const [st, setSt] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [card, setCard] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setChecking(true);
    const res = await fetch("/api/admin/payments").catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.ok) {
      setSt(json.data);
      setCard(json.data.manual.card);
      setName(json.data.manual.name);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Jonli tekshiruv — yozish paytida brend va Luhn holati */
  const live = card.replace(/\D/g, "").length > 0 ? checkCard(card) : null;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, name }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setMsg({ ok: true, text: card.replace(/\D/g, "") ? "Karta saqlandi — qo'lda o'tkazma yoqildi" : "Karta o'chirildi" });
      load();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Saqlab bo'lmadi" });
    } finally {
      setSaving(false);
    }
  };

  if (!st) {
    return (
      <div className="card p-5">
        <span className="block h-5 w-40 skeleton" />
        <span className="mt-3 block h-24 w-full skeleton" />
      </div>
    );
  }

  const providerCard = (title: string, configured: boolean, checks: Check[], extra?: string) => (
    <div className="card p-4.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14.5px] font-semibold text-fg">
          <StatusDot ok={configured} /> {title}
        </p>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", configured ? "bg-success-soft text-success-text" : "bg-danger-soft text-danger-text")}>
          {configured ? "Ulangan" : "Ulanmagan"}
        </span>
      </div>
      {extra && <p className="mt-1 text-[12px] font-medium text-fg-3">{extra}</p>}
      <ul className="mt-3 space-y-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-[12.5px]">
            <StatusDot ok={c.ok} />
            <span className="min-w-0">
              <span className={c.ok ? "text-fg-2" : "font-semibold text-fg"}>{c.label}</span>
              {c.hint && <span className="block truncate font-mono text-[11px] text-fg-4">{c.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] leading-relaxed text-fg-3">
          Payme/Click kalitlari xavfsizlik uchun faqat <b>Vercel → Environment Variables</b> da saqlanadi; bu yerda ularning holati avtomatik tekshiriladi. Qo'lda o'tkazma kartasi esa shu
          yerdan boshqariladi.
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={checking}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50"
        >
          {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Qayta tekshirish
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {providerCard("Payme", st.payme.configured, st.payme.checks, st.payme.configured ? (st.payme.mode === "test" ? "Rejim: TEST kassa" : "Rejim: ishchi (prod)") : "Merchant shartnoma kalitlari kutilmoqda")}
        {providerCard("Click", st.click.configured, st.click.checks, st.click.configured ? "SHOP API ulangan" : "SHOP API kalitlari kutilmoqda")}

        {/* Qo'lda o'tkazma — karta shu yerda sozlanadi */}
        <div className="card p-4.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[14.5px] font-semibold text-fg">
              <CreditCard size={15} className="text-accent" /> Qo'lda o'tkazma
            </p>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", st.manual.configured ? "bg-success-soft text-success-text" : "bg-surface-3 text-fg-3")}>
              {st.manual.configured ? (st.manual.source === "env" ? "Env'dan" : "Yoqilgan") : "O'chiq"}
            </span>
          </div>
          <label htmlFor="adm-card" className="field-label mt-3">
            Platforma kartasi
          </label>
          <input
            id="adm-card"
            className="field tabular-nums"
            inputMode="numeric"
            value={card}
            onChange={(e) => setCard(formatCard(e.target.value))}
            placeholder="8600 0000 0000 0000"
            maxLength={23}
          />
          {live && (
            <p className={cn("mt-1 flex items-center gap-1.5 text-[12px] font-medium", live.ok ? "text-success-text" : "text-danger-text")} aria-live="polite">
              {live.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {live.ok ? `To'g'ri — ${live.brand ? CARD_BRAND_LABEL[live.brand] : "karta"}` : live.error}
            </p>
          )}
          <label htmlFor="adm-card-name" className="field-label mt-3">
            Qabul qiluvchi nomi
          </label>
          <input id="adm-card-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Kasb Egalari MChJ" />
          {msg && (
            <p className={cn("mt-2 text-[12.5px] font-medium", msg.ok ? "text-success-text" : "text-danger-text")} role="status">
              {msg.text}
            </p>
          )}
          <button type="button" onClick={save} disabled={saving || Boolean(live && !live.ok)} className="btn-ink mt-3 h-10 w-full rounded-full text-[13px] font-semibold disabled:opacity-50">
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fg-4">Bo'sh qoldirib saqlansa — qo'lda o'tkazma o'chadi. Mijozlar checkout'da shu kartani ko'radi.</p>
        </div>
      </div>
    </div>
  );
}
