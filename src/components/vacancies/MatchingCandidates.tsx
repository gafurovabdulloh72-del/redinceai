"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Loader2, Send, UserSearch } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_AI as T } from "@/lib/i18n/dict/vacancies-ai";
import { professionLabelTr, resumeExperienceTr, salaryLabelTr } from "@/lib/i18n/dict/vacancies";
import type { CandidateMatch } from "@/lib/vacancies/service";
import { cn } from "@/lib/utils";
import { MatchBreakdown, MatchRing } from "./ApplicantsList";

/**
 * MOS NOMZODLAR (hunting, ISH ON g'oyasi): platformadagi ochiq rezyumelar vakansiyaga solishtiriladi, eng moslari ball bilan.
 * «Taklif yuborish» — sayt chatiga xabar (+ Telegram/push bildirishnomasi), bir nomzodga bir marta. Kontakt ko'rsatilmaydi.
 */
export function MatchingCandidates({ vacancyId, vacancyOpen }: { vacancyId: string; vacancyOpen: boolean }) {
  const til = useLocale();
  const [items, setItems] = useState<CandidateMatch[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/nomzodlar`, { cache: "no-store" });
      const j = (await r.json()) as { ok?: boolean; data?: { items: CandidateMatch[] } };
      if (!r.ok || !j.ok || !j.data) throw new Error();
      setItems(j.data.items);
    } catch {
      setFailed(true);
    }
  }, [vacancyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed)
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-5 text-[13px] text-fg-3">
        {tr(til, T.loadFailed)}
        <button type="button" onClick={() => void load()} className="press font-semibold text-fg underline-offset-2 hover:underline">
          {tr(til, T.retry)}
        </button>
      </div>
    );
  if (!items)
    return (
      <ul className="grid gap-3" aria-busy>
        {[0, 1, 2].map((i) => (
          <li key={i} className="skeleton h-[92px] rounded-[14px]" />
        ))}
      </ul>
    );

  return (
    <div className="grid gap-3">
      <div>
        <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-fg">
          <UserSearch size={16} className="text-accent" /> {tr(til, T.huntTitle)}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{tr(til, T.huntDesc)}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">{tr(til, T.huntEmpty)}</p>
      ) : (
        <ul className="stagger grid gap-3">
          {items.map((c) => (
            <CandidateItem key={c.resume.id} c={c} vacancyId={vacancyId} canInvite={vacancyOpen} onInvited={() => setItems((p) => p?.map((x) => (x.resume.id === c.resume.id ? { ...x, invited: true } : x)) ?? p)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CandidateItem({ c, vacancyId, canInvite, onInvited }: { c: CandidateMatch; vacancyId: string; canInvite: boolean; onInvited: () => void }) {
  const til = useLocale();
  const [why, setWhy] = useState(false);
  const [composer, setComposer] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = c.resume;

  async function invite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/taklif`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: r.userId, message: msg.trim() }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, T.inviteFailed));
      setComposer(false);
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(til, T.inviteFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="min-w-0 rounded-[14px] border border-line p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={r.user.name} src={r.user.avatarUrl} size={40} decorative />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-fg">{r.user.name}</p>
          <p className="mt-0.5 text-[13px] text-fg-2">
            <span data-no-auto>{r.title}</span> · {professionLabelTr(til, r.profession, true)} · {resumeExperienceTr(til, r.experience)} · {salaryLabelTr(til, r.expectedSalary, null)}
          </p>
          {r.skills.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {r.skills.slice(0, 6).map((s) => (
                <li key={s} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-fg-2">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="press -m-1 rounded-full p-1" aria-label={tr(til, T.why)}>
          <MatchRing score={c.match.score} verdict={c.match.verdict} />
        </button>
      </div>
      {why && (
        <div className="expand-in mt-3 rounded-[12px] bg-fg/[0.03] p-3.5">
          <MatchBreakdown match={c.match} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {c.invited ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-success-soft px-3 text-[12.5px] font-semibold text-success-text">
            <Check size={13} className="animate-pop" /> {tr(til, T.invited)}
          </span>
        ) : (
          canInvite && (
            <button type="button" onClick={() => setComposer((v) => !v)} aria-expanded={composer} className="press btn-ink inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold">
              <Send size={13} /> {tr(til, T.invite)} <ChevronDown size={12} className={cn("transition-transform", composer && "rotate-180")} />
            </button>
          )
        )}
        <Link href={`/rezyumelar/${r.id}`} className="press inline-flex h-8 items-center rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
          {tr(til, T.viewResume)}
        </Link>
        <button type="button" onClick={() => setWhy((v) => !v)} className="press ml-auto inline-flex h-8 items-center rounded-full px-2 text-[12.5px] font-semibold text-fg-3 hover:text-fg">
          {why ? tr(til, T.hideWhy) : tr(til, T.why)}
        </button>
      </div>
      {composer && !c.invited && (
        <div className="expand-in mt-2 grid gap-2">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} rows={2} placeholder={tr(til, T.inviteMsgPh)} className="field w-full resize-y py-2 text-[13px]" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void invite()} disabled={busy} className="press btn-accent inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold disabled:opacity-60">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {tr(til, T.inviteSend)}
            </button>
            {error && (
              <span role="alert" className="text-[12.5px] text-danger-text">
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
