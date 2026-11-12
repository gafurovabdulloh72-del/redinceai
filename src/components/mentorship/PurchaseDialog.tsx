"use client";

import { useCallback, useEffect, useState } from "react";
import { NoPaymentMethods } from "@/components/payments/NoPaymentMethods";
import { useRouter } from "next/navigation";
import { Loader2, Send, Tag } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { MENTOR_FEATURES } from "@/lib/mentorship/format";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS, formatSomTr } from "@/lib/i18n/dict/mentorship";
import type { PurchaseType } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

const REF_KEY = "kasb_ref";
const PROVIDER_LABEL = { payme: "Payme", click: "Click", manual: "Karta o'tkazmasi" } as const;
const PROVIDER_LABEL_RU: Record<Provider, string> = { payme: "Payme", click: "Click", manual: "Перевод на карту" };
type Provider = keyof typeof PROVIDER_LABEL;

type Quote = {
  title: string;
  base: number;
  amount: number;
  promo: { code: string; percent: number; discount: number } | null;
  ref: { percent: number; discount: number } | null;
  creditUsed: number;
  creditBalance: number;
  providers: Provider[];
  telegram?: boolean;
};

/** ?ref=KOD bo'lsa, brauzerda eslab qoladi (xarid vaqtida do'st chegirmasi qo'llanadi) */
export function RefCapture() {
  useEffect(() => {
    try {
      const r = new URLSearchParams(location.search).get("ref");
      if (r && /^[A-Za-z0-9]{4,12}$/.test(r)) localStorage.setItem(REF_KEY, r.toUpperCase());
    } catch {
      /* noop */
    }
  }, []);
  return null;
}

/** Xarid oynasi: narx, promokod, do'st chegirmasi, kredit, to'lov usuli → Payme/Click yoki o'tkazma */
export function PurchaseDialog({ open, onClose, type, id, loggedIn = true }: { open: boolean; onClose: () => void; type: PurchaseType; id: string; loggedIn?: boolean }) {
  const router = useRouter();
  const til = useLocale();
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const ref = typeof window !== "undefined" ? (() => { try { return localStorage.getItem(REF_KEY) ?? undefined; } catch { return undefined; } })() : undefined;

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/mentorlik/tolov/narx", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id, promo: appliedPromo || undefined, ref, useCredit }) });
      const j = (await r.json()) as { data?: Quote; error?: string; fields?: Record<string, string> };
      if (!r.ok || !j.data) {
        if (appliedPromo && j.fields?.promo) {
          setAppliedPromo("");
          setErr(j.fields.promo);
          return;
        }
        throw new Error(j.error || tr(til, MS.quoteFailed));
      }
      setQ(j.data);
      setProvider((p) => p ?? j.data!.providers[0] ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr(til, MS.error));
    }
  }, [type, id, appliedPromo, ref, useCredit, til]);

  useEffect(() => {
    if (!open) return;
    if (!loggedIn) {
      router.push(`/auth/kirish?next=${encodeURIComponent(location.pathname + location.search)}`);
      onClose();
      return;
    }
    void load();
  }, [open, loggedIn, load, router, onClose]);

  /** Telegram bot orqali to'lash: bot ochiladi, usulni u yerda tanlaydi */
  async function payViaTelegram() {
    setBusy(true);
    try {
      const r = await fetch("/api/mentorlik/tolov/telegram", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id, promo: appliedPromo || undefined }) });
      const j = (await r.json()) as { data?: { linked: boolean; url: string }; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error || tr(til, MS.tgFailed));
      if (!j.data.linked) showToast(tr(til, MS.tgLinkFirst), "info");
      window.open(j.data.url, "_blank", "noopener");
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MS.error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!q) return;
    setBusy(true);
    try {
      const r = await fetch("/api/mentorlik/tolov", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id, provider: provider ?? "manual", promo: appliedPromo || undefined, ref, useCredit }) });
      const j = (await r.json()) as { data?: { free: boolean; redirectUrl?: string | null; statusPath?: string }; error?: string };
      if (!r.ok || !j.data) throw new Error(j.error || tr(til, MS.payFailed));
      if (j.data.free) {
        showToast(tr(til, MS.accessOpened), "success");
        onClose();
        router.refresh();
        return;
      }
      if (j.data.redirectUrl) window.location.href = j.data.redirectUrl;
      else if (j.data.statusPath) router.push(j.data.statusPath);
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MS.error), "error");
      setBusy(false);
    }
  }

  const free = q ? q.amount <= 0 : false;
  return (
    <Sheet open={open} onClose={onClose} title={tr(til, MS.confirmPurchase)} size="sm">
      {!q && !err && (
        <div className="grid h-32 place-items-center">
          <Loader2 className="animate-spin text-fg-3" />
        </div>
      )}
      {err && !q && <p className="py-6 text-center text-[14px] text-danger">{err}</p>}
      {q && (
        <div className="space-y-4">
          <p className="text-[15px] font-semibold text-fg">{q.title}</p>
          <dl className="space-y-1.5 text-[14px]">
            <Row k={tr(til, MS.price)} v={formatSomTr(til, q.base)} />
            {q.promo && <Row k={MS.promoRow[til](q.promo.code, q.promo.percent)} v={`−${formatSomTr(til, q.promo.discount)}`} good />}
            {q.ref && <Row k={MS.refRow[til](q.ref.percent)} v={`−${formatSomTr(til, q.ref.discount)}`} good />}
            {q.creditUsed > 0 && <Row k={tr(til, MS.credit)} v={`−${formatSomTr(til, q.creditUsed)}`} good />}
            <div className="flex justify-between border-t border-line pt-2 text-[16px] font-bold text-fg">
              <dt>{tr(til, MS.total)}</dt>
              <dd>{free ? tr(til, MS.free) : formatSomTr(til, q.amount)}</dd>
            </div>
          </dl>

          {MENTOR_FEATURES.promo && !q.ref && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAppliedPromo(promo.trim().toUpperCase());
              }}
              className="flex gap-2"
            >
              <div className="relative min-w-0 flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
                <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder={tr(til, MS.promo)} aria-label={tr(til, MS.promo)} className="field h-10 w-full pl-8 text-[14px] uppercase" maxLength={24} />
              </div>
              <button type="submit" className="h-10 rounded-lg border border-line-2 px-3 text-[13px] font-semibold text-fg-2 hover:text-fg">
                {tr(til, MS.apply)}
              </button>
            </form>
          )}
          {err && <p className="text-[12.5px] text-danger">{err}</p>}

          {q.creditBalance > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-fg-2">
              <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /> {MS.useCredit[til](formatSomTr(til, q.creditBalance))}
            </label>
          )}

          {!free && (
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-[12.5px] font-semibold text-fg-3">{tr(til, MS.payMethod)}</legend>
              {q.providers.length === 0 && <NoPaymentMethods til={til} />}
              {q.providers.map((p) => (
                <label key={p} className={cn("flex cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-[14px] font-semibold", provider === p ? "border-fg bg-fg/[0.03]" : "border-line")}>
                  <input type="radio" name="prov" checked={provider === p} onChange={() => setProvider(p)} /> {til === "ru" ? PROVIDER_LABEL_RU[p] : PROVIDER_LABEL[p]}
                </label>
              ))}
            </fieldset>
          )}

          <button type="button" disabled={busy || (!free && !provider)} onClick={() => void pay()} className="btn-accent inline-flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />} {free ? tr(til, MS.startFree) : MS.pay[til](formatSomTr(til, q.amount))}
          </button>
          {!free && q.telegram && (
            <button type="button" disabled={busy} onClick={() => void payViaTelegram()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-line-2 text-[14px] font-semibold text-fg-2 hover:text-fg disabled:opacity-50">
              <Send size={15} /> {tr(til, MS.payTelegram)}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Row({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-3">{k}</dt>
      <dd className={cn("font-semibold tabular-nums", good ? "text-success-text" : "text-fg")}>{v}</dd>
    </div>
  );
}

/** Tugma + oyna bir joyda */
export function BuyButton({ type, id, loggedIn, children, className }: { type: PurchaseType; id: string; loggedIn: boolean; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "btn-accent inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold"}>
        {children}
      </button>
      <PurchaseDialog open={open} onClose={() => setOpen(false)} type={type} id={id} loggedIn={loggedIn} />
    </>
  );
}
