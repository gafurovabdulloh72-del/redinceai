"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Download, Sparkles } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Locale, type Tr } from "@/lib/i18n";
import { VAK_APPLICANTS as T } from "@/lib/i18n/dict/vacancies-forms";
import { applicationStatusTr, professionLabelTr, resumeExperienceTr, salaryLabelTr, slaHintTr } from "@/lib/i18n/dict/vacancies";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { APPLICATION_TONE, slaHint, type ApplicationStatus } from "@/lib/vacancies/format";
import type { ApplicantView } from "@/lib/vacancies/service";
import { cn, formatUzPhone } from "@/lib/utils";
import { VAK_AI } from "@/lib/i18n/dict/vacancies-ai";
import { VERDICT_LABEL, type MatchResult } from "@/lib/vacancies/match";

/** Moslik halqasi (0–100): rang hukmga qarab — kuchli yashil, o'rtacha sariq, kam kulrang */
export function MatchRing({ score, verdict, size = 44 }: { score: number; verdict: MatchResult["verdict"]; size?: number }) {
  const til = useLocale();
  const r = size / 2 - 3.5;
  const c = 2 * Math.PI * r;
  const color = verdict === "strong" ? "var(--success, #16a34a)" : verdict === "good" ? "var(--warning, #d97706)" : "var(--fg-4, #9ca3af)";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} title={`${tr(til, VERDICT_LABEL[verdict])} — ${score}%`} role="img" aria-label={`${tr(til, VAK_AI.matchTitle)}: ${score}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={3.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <span className="absolute text-[12px] font-bold tabular-nums text-fg">{score}</span>
    </span>
  );
}

/** Har mezon bo'yicha ball va sabab (ISH ON «Ball va xulosa») */
export function MatchBreakdown({ match }: { match: MatchResult }) {
  const til = useLocale();
  return (
    <div className="grid gap-2.5">
      <p className="text-[13px] leading-relaxed text-fg">{tr(til, match.summary)}</p>
      <ul className="grid gap-2">
        {match.criteria.map((c) => {
          const pct = c.max ? Math.round((c.got / c.max) * 100) : 0;
          return (
            <li key={c.key} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="font-semibold text-fg">{tr(til, c.label)}</span>
                <span className="tabular-nums text-fg-3">
                  {c.got}/{c.max}
                </span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-full bg-fg/8" aria-hidden>
                <span className={cn("block h-full rounded-full transition-[width] duration-700", pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-fg-4")} style={{ width: `${pct}%` }} />
              </span>
              <span className="text-[12px] text-fg-3">{tr(til, c.reason)}</span>
            </li>
          );
        })}
      </ul>
      <p className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-4">
        <Sparkles size={12} /> {tr(til, VAK_AI.aiNote)}
      </p>
    </div>
  );
}

/** Ariza holati belgisi — umumiy Badge; holat o'zgarganda qayta chiziladi (badge-pop) */
export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  const til = useLocale();
  return (
    <Badge key={status} tone={APPLICATION_TONE[status]} className={cn("animate-badge-pop", className)}>
      {applicationStatusTr(til, status)}
    </Badge>
  );
}

type Tab = "all" | ApplicationStatus;
const TABS: Array<{ key: Tab; label: Tr }> = [
  { key: "all", label: T.tabAll },
  { key: "new", label: T.tabNew },
  { key: "viewed", label: T.tabViewed },
  { key: "shortlisted", label: T.tabShortlisted },
  { key: "hired", label: T.tabHired },
  { key: "rejected", label: T.tabRejected },
];

const ACTIONS: Array<{ status: ApplicationStatus; label: Tr; cls: string }> = [
  { status: "shortlisted", label: T.actShortlist, cls: "border-line-2 text-fg-2 hover:border-fg hover:text-fg" },
  { status: "hired", label: T.actHire, cls: "border-success/40 text-success-text hover:bg-success-soft" },
  { status: "rejected", label: T.actReject, cls: "border-line-2 text-fg-3 hover:border-danger/40 hover:text-danger-text" },
];

type PatchResp = { ok: boolean; error?: string; data?: { status: ApplicationStatus; employerNote: string } };
async function patchApplication(til: Locale, id: string, body: Record<string, unknown>): Promise<PatchResp> {
  const res = await fetch(`/api/arizalar/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json().catch(() => ({ ok: false }))) as PatchResp;
  if (!res.ok || !j.ok) throw new Error(j.error || tr(til, T.failed));
  return j;
}

/**
 * Nomzodlar ro'yxati (ish beruvchi): holat bo'limlari, kontakt (nomzod ariza bilan rozilik bergan), rezyume, xat,
 * shaxsiy eslatma, CSV eksporti. Ochilganda "yangi" arizalar avtomatik "ko'rildi" bo'ladi — nomzod kabinetida ko'radi.
 */
export function ApplicantsList({ vacancyId, initial, vacancyOpen = true }: { vacancyId: string; initial: ApplicantView[]; vacancyOpen?: boolean }) {
  const router = useRouter();
  const til = useLocale();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<"best" | "new">("best");
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** «Ishga olindi» dan keyin vakansiyani yopish taklifi */
  const [askClose, setAskClose] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const fresh = initial.filter((a) => a.status === "new");
    if (!fresh.length) return;
    void Promise.all(fresh.map((a) => patchApplication(til, a.id, { status: "viewed" }).catch(() => undefined))).then(() =>
      setItems((prev) => prev.map((a) => (a.status === "new" ? { ...a, status: "viewed", viewedAt: a.viewedAt ?? Date.now() } : a))),
    );
  }, [initial, til]);

  async function setStatus(id: string, status: ApplicationStatus) {
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      await patchApplication(til, id, { status });
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      if (status === "hired" && vacancyOpen) setAskClose(true);
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : tr(til, T.failed) }));
    } finally {
      setBusy(null);
    }
  }

  async function saveNote(id: string, note: string) {
    try {
      await patchApplication(til, id, { note });
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, employerNote: note } : a)));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : tr(til, T.noteNotSaved) }));
    }
  }

  async function closeVacancy() {
    setClosing(true);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
      if (!res.ok) throw new Error();
      toast(tr(til, T.closed), "success");
      setAskClose(false);
      router.refresh();
    } catch {
      toast(tr(til, T.closeFailed), "error");
    } finally {
      setClosing(false);
    }
  }

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/vakansiyalar/${vacancyId}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast(tr(til, T.copyFailed), "error");
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">
        <p>{tr(til, T.empty)}</p>
        <button type="button" onClick={copyLink} className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3.5 text-[12.5px] font-semibold text-fg">
          {copied ? <Check key="ok" size={13} className="animate-pop text-success-text" /> : <Copy key="c" size={13} />} {copied ? tr(til, T.copied) : tr(til, T.copyLink)}
        </button>
      </div>
    );
  }

  const counts = items.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});
  const filtered = tab === "all" ? items : items.filter((a) => a.status === tab);
  const list = sort === "best" ? [...filtered].sort((a, b) => b.match.score - a.match.score || b.createdAt - a.createdAt) : filtered;
  const strong = items.filter((a) => a.match.verdict === "strong").length;
  const funnel = [
    { label: VAK_AI.funnelApplied, n: items.length },
    { label: VAK_AI.funnelStrong, n: strong },
    { label: VAK_AI.funnelShort, n: (counts.shortlisted ?? 0) + (counts.hired ?? 0) },
    { label: VAK_AI.funnelHired, n: counts.hired ?? 0 },
  ];

  return (
    <div className="grid gap-3">
      {/* Saralash bosqichlari (voronka) */}
      <div className="rounded-[14px] border border-line p-3" aria-label={tr(til, VAK_AI.funnelTitle)}>
        <p className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.12em] text-fg-3">{tr(til, VAK_AI.funnelTitle)}</p>
        <ol className="grid grid-cols-4 gap-1.5">
          {funnel.map((f, i) => (
            <li key={i} className="min-w-0">
              <span className="block h-1.5 overflow-hidden rounded-full bg-fg/8" aria-hidden>
                <span className={cn("block h-full rounded-full", i === 0 ? "bg-fg" : i === 1 ? "bg-success" : i === 2 ? "bg-accent" : "bg-success")} style={{ width: `${items.length ? Math.max(f.n ? 8 : 0, (f.n / items.length) * 100) : 0}%` }} />
              </span>
              <span className="mt-1.5 block truncate text-[11.5px] text-fg-3">{tr(til, f.label)}</span>
              <span className="block text-[16px] font-bold tabular-nums text-fg">{f.n}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="segment max-w-full overflow-x-auto no-scrollbar" role="tablist" aria-label={tr(til, T.tabsAria)}>
          {TABS.map((t) => {
            const n = t.key === "all" ? items.length : (counts[t.key] ?? 0);
            if (t.key !== "all" && n === 0) return null;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-active={tab === t.key} onClick={() => setTab(t.key)} className="segment-item inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap">
                {tr(til, t.label)} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="segment" role="group" aria-label={tr(til, VAK_AI.sortBest)}>
          {(["best", "new"] as const).map((k) => (
            <button key={k} type="button" data-active={sort === k} aria-pressed={sort === k} onClick={() => setSort(k)} className="segment-item min-h-9 whitespace-nowrap">
              {tr(til, k === "best" ? VAK_AI.sortBest : VAK_AI.sortNew)}
            </button>
          ))}
        </div>
        <a href={`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/ariza?format=csv`} className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg" download>
          <Download size={13} /> CSV
        </a>
      </div>

      {askClose && (
        <div role="status" className="expand-in flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-success-soft px-4 py-3 text-[13px] text-fg">
          <span className="font-semibold">{tr(til, T.askClose)}</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={closeVacancy} disabled={closing} className="press btn-ink inline-flex h-8 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-50">
              <Check size={13} /> {tr(til, T.yesClose)}
            </button>
            <button type="button" onClick={() => setAskClose(false)} className="press inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
              {tr(til, T.keepOpen)}
            </button>
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-3">{tr(til, T.emptyTab)}</p>
      ) : (
        <ul className="stagger grid gap-3">
          {list.map((a) => (
            <ApplicantItem key={a.id} a={a} busy={busy === a.id} error={errors[a.id]} onStatus={(s) => void setStatus(a.id, s)} onNote={(n) => void saveNote(a.id, n)} />
          ))}
        </ul>
      )}
    </div>
  );
}

const MAX_SKILLS = 6;

function ApplicantItem({ a, busy, error, onStatus, onNote }: { a: ApplicantView; busy: boolean; error?: string; onStatus: (s: ApplicationStatus) => void; onNote: (note: string) => void }) {
  const til = useLocale();
  const [noteOpen, setNoteOpen] = useState(Boolean(a.employerNote));
  const [whyOpen, setWhyOpen] = useState(false);
  const [note, setNote] = useState(a.employerNote);
  // SLA shartini format.ts hal qiladi (bitta manba); matn tilga mos — kun soni qayta hisoblanadi
  const waiting = slaHint(a.status, a.createdAt) ? slaHintTr(til, Math.floor((Date.now() - a.createdAt) / 86_400_000)) : null;
  const extra = a.resume ? a.resume.skills.length - MAX_SKILLS : 0;
  return (
    <li className="min-w-0 rounded-[14px] border border-line p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={a.user.name} src={a.user.avatarUrl} size={40} decorative />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-fg">{a.user.name}</p>
            <StatusBadge status={a.status} />
            <span className={cn("text-[12px] font-semibold", a.match.verdict === "strong" ? "text-success-text" : a.match.verdict === "good" ? "text-warning-text" : "text-fg-3")}>{tr(til, VERDICT_LABEL[a.match.verdict])}</span>
            <span className="text-[12px] text-fg-4" suppressHydrationWarning>
              {timeAgoLabel(til, a.createdAt)}
            </span>
            {waiting && <span className="text-[12px] font-semibold text-warning-text">{waiting}</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-fg-2">
            {a.resume ? `${a.resume.title} · ${professionLabelTr(til, a.resume.profession, true)} · ${resumeExperienceTr(til, a.resume.experience)} · ${salaryLabelTr(til, a.resume.expectedSalary, null)}` : tr(til, T.noResume)}
          </p>
          {/* Kontakt: nomzod ariza yuborish bilan shu ish beruvchiga ochgan */}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <a href={`mailto:${a.user.email}`} className="break-all font-semibold text-fg underline-offset-2 hover:underline">
              {a.user.email}
            </a>
            {a.user.phone && (
              <a href={`tel:${a.user.phone}`} className="whitespace-nowrap font-semibold text-fg underline-offset-2 hover:underline">
                {formatUzPhone(a.user.phone)}
              </a>
            )}
            {a.user.username && (
              <Link href={`/yozish/${a.user.username}`} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                {tr(til, T.chat)}
              </Link>
            )}
            {a.resume && (
              <Link href={`/rezyumelar/${a.resume.id}`} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                {tr(til, T.resume)}
              </Link>
            )}
            {a.user.specialistSlug && (
              <Link href={`/mutaxassislar/${a.user.specialistSlug}`} className="text-fg-2 underline-offset-2 hover:text-fg hover:underline">
                {tr(til, T.profile)}
              </Link>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} className="press -m-1 rounded-full p-1" aria-label={tr(til, VAK_AI.why)}>
          <MatchRing score={a.match.score} verdict={a.match.verdict} />
        </button>
      </div>
      <button type="button" onClick={() => setWhyOpen((v) => !v)} aria-expanded={whyOpen} className="press mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-fg-2 hover:text-fg">
        <Sparkles size={13} className="text-accent" /> {whyOpen ? tr(til, VAK_AI.hideWhy) : tr(til, VAK_AI.why)} <ChevronDown size={13} className={cn("transition-transform", whyOpen && "rotate-180")} />
      </button>
      {whyOpen && (
        <div className="expand-in mt-2 grid gap-4 rounded-[12px] bg-fg/[0.03] p-3.5">
          <MatchBreakdown match={a.match} />
          {a.quiz && (
            <div className="grid gap-1.5 border-t border-line pt-3">
              <p className="text-[12.5px] font-semibold text-fg">
                {tr(til, VAK_AI.quizTitle)}: <span className="tabular-nums">{a.quiz.correct}/{a.quiz.total}</span>
              </p>
              <ul className="grid gap-1.5">
                {a.quiz.items.map((q, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed">
                    <span className={q.ok ? "text-success-text" : "text-danger-text"}>{q.ok ? "✓" : "✗"}</span> <span className="text-fg-2">{q.question}</span>
                    <span className="block pl-4 text-fg-3">
                      {q.chosen ?? tr(til, VAK_AI.noAnswer)}
                      {!q.ok && (
                        <>
                          {" · "}
                          {tr(til, VAK_AI.rightAnswer)}: <span className="text-fg-2">{q.right}</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.answers.length > 0 && (
            <div className="grid gap-2 border-t border-line pt-3">
              <p className="text-[12.5px] font-semibold text-fg">{tr(til, VAK_AI.answersTitle)}</p>
              {a.answers.map((x, i) => (
                <div key={i} className="text-[12.5px] leading-relaxed">
                  <p className="text-fg-3">{x.question}</p>
                  <p className="whitespace-pre-wrap break-words text-fg" data-no-auto>
                    {x.answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {a.coverLetter && <p className="mt-3 whitespace-pre-wrap break-words rounded-[10px] bg-fg/4 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-fg">{a.coverLetter}</p>}
      {a.resume && a.resume.skills.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={tr(til, T.skillsAria)}>
          {a.resume.skills.slice(0, MAX_SKILLS).map((s) => (
            <li key={s} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-fg-2">
              {s}
            </li>
          ))}
          {extra > 0 && <li className="px-1 py-0.5 text-[11.5px] font-medium text-fg-3">+{extra}</li>}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {ACTIONS.map((act) => (
          <button
            key={act.status}
            type="button"
            disabled={busy || a.status === act.status}
            onClick={() => onStatus(act.status)}
            className={cn("press inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-semibold transition disabled:opacity-50", act.cls)}
          >
            {tr(til, act.label)}
          </button>
        ))}
        <button type="button" onClick={() => setNoteOpen((v) => !v)} aria-expanded={noteOpen} className="press ml-auto inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold text-fg-3 hover:text-fg">
          {a.employerNote ? tr(til, T.note) : tr(til, T.addNote)}
        </button>
        {error && (
          <span role="alert" className="basis-full text-[12px] text-danger-text">
            {error}
          </span>
        )}
      </div>
      {noteOpen && (
        <label className="expand-in mt-2 block">
          <span className="sr-only">{tr(til, T.privateNote)}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== a.employerNote && onNote(note.trim())}
            maxLength={500}
            rows={2}
            placeholder={tr(til, T.notePh)}
            className="field w-full resize-y py-2 text-[13px]"
          />
        </label>
      )}
    </li>
  );
}
