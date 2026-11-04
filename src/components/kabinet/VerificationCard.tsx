"use client";

import { useState } from "react";
import { BadgeCheck, CheckCircle2, Circle, Hourglass, XCircle } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { TASDIQ } from "@/lib/i18n/dict/moderation";
import { formatDate } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/verification";

type ApiResp = { ok: boolean; data?: { requestedAt: number }; error?: string };

/**
 * Kabinet → Profil → «Tasdiqlangan profil» (ko'k belgi): mezonlar ro'yxati (server hisoblaydi),
 * «Tasdiqlash so'rovi» tugmasi (hammasi bajarilgach faol), kutish holati va rad etish sababi.
 */
export function VerificationCard({ initial }: { initial: VerificationStatus }) {
  const til = useLocale();
  const { toast } = useToast();
  const [st, setSt] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function request() {
    if (busy || !st.eligible || st.requestedAt) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/tasdiq", { method: "POST", headers: { "Content-Type": "application/json" } });
      const j = (await res.json()) as ApiResp;
      if (!res.ok || !j.ok || !j.data) throw new Error(j.error || tr(til, TASDIQ.error));
      setSt((s) => ({ ...s, requestedAt: j.data!.requestedAt, note: null }));
      toast(tr(til, TASDIQ.sent), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : tr(til, TASDIQ.error), "error");
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<{ ok: boolean; text: string }> = [
    { ok: st.criteria.profile, text: tr(til, TASDIQ.critProfile) },
    { ok: st.criteria.portfolio.ok, text: TASDIQ.critPortfolio[til](st.criteria.portfolio.n) },
    { ok: st.criteria.activity, text: tr(til, TASDIQ.critActivity) },
    { ok: st.criteria.age.ok, text: TASDIQ.critAge[til](st.criteria.age.days) },
  ];

  return (
    <section id="tasdiq" className="card m-flat scroll-mt-28 p-5 sm:p-6" aria-labelledby="sec-tasdiq">
      <div className="flex items-start gap-3">
        <span className={st.verified ? "text-accent" : "text-fg-3"} aria-hidden="true">
          <BadgeCheck size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sec-tasdiq" className="font-display text-[19px] font-semibold tracking-tight text-fg">
            {tr(til, TASDIQ.title)}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{tr(til, st.verified ? TASDIQ.verified : TASDIQ.lead)}</p>
        </div>
      </div>
      {!st.verified && (
        <>
          <ul className="mt-4 grid gap-2" aria-label={tr(til, TASDIQ.title)}>
            {rows.map((r) => (
              <li key={r.text} className="flex items-start gap-2 text-[13.5px]">
                {r.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> : <Circle size={16} className="mt-0.5 shrink-0 text-fg-4" aria-hidden="true" />}
                <span className={r.ok ? "text-fg" : "text-fg-2"}>{r.text}</span>
              </li>
            ))}
          </ul>
          {st.note && !st.requestedAt && (
            <p className="mt-4 flex items-start gap-2 rounded-[12px] border border-line bg-fg/[0.03] p-3 text-[13px] text-fg-2" role="status">
              <XCircle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
              <span>
                <b className="text-fg">{tr(til, TASDIQ.rejected)}.</b> {tr(til, TASDIQ.reason)}: {st.note}
              </span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {st.requestedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-3 py-1.5 text-[12.5px] font-semibold text-fg-2" role="status">
                <Hourglass size={13} aria-hidden="true" /> {tr(til, TASDIQ.pending)} · {TASDIQ.pendingAt[til](formatDate(st.requestedAt, til))}
              </span>
            ) : (
              <>
                <Button type="button" onClick={() => void request()} disabled={busy || !st.eligible} title={st.eligible ? undefined : tr(til, TASDIQ.notMet)}>
                  {busy ? <Spinner className="h-4 w-4" /> : <BadgeCheck size={15} />} {tr(til, TASDIQ.request)}
                </Button>
                {!st.eligible && <span className="text-[12px] text-fg-3">{tr(til, TASDIQ.notMet)}</span>}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
