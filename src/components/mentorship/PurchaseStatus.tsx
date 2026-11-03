"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { formatSom } from "@/lib/mentorship/format";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { MS, formatSomTr } from "@/lib/i18n/dict/mentorship";

type St = { state: "created" | "pending" | "paid" | "cancelled" | "refunded"; provider: "payme" | "click" | "manual"; amount: number; title: string; type: string; itemId: string; redirectUrl: string | null; manual: { card: string; name: string } | null; sent: boolean };

/** To'lovdan keyingi sahifa: holatni kuzatadi (Payme/Click qaytgach), o'tkazma uchun rekvizit va «To'ladim» */
/** apiBase — xarid turi: mentorlik (standart) yoki kontakt ochish (`/api/kontakt/tolov`) */
export function PurchaseStatus({ id, next, apiBase = "/api/mentorlik/tolov" }: { id: string; next: string; apiBase?: string }) {
  const til = useLocale();
  const [s, setS] = useState<St | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(0);

  async function load() {
    try {
      const r = await fetch(`${apiBase}/${id}`, { cache: "no-store" });
      const j = (await r.json()) as { data?: St };
      if (j.data) setS(j.data);
    } catch {
      /* keyingi urinish */
    }
  }
  useEffect(() => {
    void load();
    timer.current = window.setInterval(() => document.visibilityState === "visible" && void load(), 4000);
    return () => window.clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, apiBase]);
  useEffect(() => {
    if (s && (s.state === "paid" || s.state === "cancelled" || s.state === "refunded")) window.clearInterval(timer.current);
  }, [s]);

  async function sent() {
    setBusy(true);
    try {
      const r = await fetch(`${apiBase}/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sent" }) });
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error || tr(til, MS.error));
      showToast(tr(til, MS.thanksAdmin), "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : tr(til, MS.error), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-fg-3" /></div>;
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      {s.state === "paid" ? (
        <>
          <CheckCircle2 size={44} className="mx-auto text-success" />
          <h1 className="mt-3 font-display text-[22px] font-bold text-fg">{tr(til, MS.paymentAccepted)}</h1>
          <p className="mt-1 text-[14px] text-fg-3">{MS.nowOpen[til](s.title)}</p>
          <Link href={next} className="btn-accent mt-5 inline-flex h-11 items-center px-6 text-[14px] font-semibold">{tr(til, MS.continue)}</Link>
        </>
      ) : s.state === "cancelled" || s.state === "refunded" ? (
        <>
          <XCircle size={44} className="mx-auto text-danger" />
          <h1 className="mt-3 font-display text-[22px] font-bold text-fg">{s.state === "refunded" ? tr(til, MS.refunded) : tr(til, MS.cancelled)}</h1>
          <Link href={next} className="mt-5 inline-flex h-11 items-center rounded-full border border-line-2 px-6 text-[14px] font-semibold text-fg-2">{tr(til, MS.back)}</Link>
        </>
      ) : (
        <>
          <Clock size={40} className="mx-auto text-fg-3" />
          <h1 className="mt-3 font-display text-[20px] font-bold text-fg">{s.title}</h1>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-fg">{formatSomTr(til, s.amount)}</p>
          {s.provider === "manual" ? (
            s.sent ? (
              <p className="mt-4 text-[14px] text-fg-3">{tr(til, MS.awaitingConfirm)}</p>
            ) : (
              <>
                {s.manual && (
                  <div className="mt-4 rounded-[12px] bg-surface-2 p-3 text-left text-[14px]">
                    <p className="text-fg-3">{tr(til, MS.transferTo)}</p>
                    <p className="mt-1 text-[17px] font-bold tabular-nums text-fg">{s.manual.card}</p>
                    <p className="text-fg-3">{s.manual.name}</p>
                  </div>
                )}
                <button type="button" disabled={busy} onClick={() => void sent()} className="btn-accent mt-4 inline-flex h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold">
                  {busy && <Loader2 size={15} className="animate-spin" />} {tr(til, MS.iPaid)}
                </button>
              </>
            )
          ) : (
            <>
              <p className="mt-4 text-[14px] text-fg-3">{tr(til, MS.awaitingPayment)}</p>
              {s.redirectUrl && <a href={s.redirectUrl} className="btn-accent mt-4 inline-flex h-11 items-center px-6 text-[14px] font-semibold">{tr(til, MS.goToPay)}</a>}
            </>
          )}
        </>
      )}
    </div>
  );
}
