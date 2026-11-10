"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, FileUser, Send } from "lucide-react";
import { Button } from "@/components/ui";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_APPLY as T } from "@/lib/i18n/dict/vacancies-forms";
import { applicationStatusTr } from "@/lib/i18n/dict/vacancies";
import { COVER_LETTER_MAX, COVER_LETTER_MIN, type ApplicationStatus } from "@/lib/vacancies/format";
import { VAK_AI } from "@/lib/i18n/dict/vacancies-ai";
import { SCREEN_ANSWER_MAX, type PublicScreening } from "@/lib/vacancies/screening";
import { cn } from "@/lib/utils";

type Mine = { id: string; status: ApplicationStatus; createdAt: number } | null;

/**
 * Ariza yuborish: rezyume bo'lsa — biriktiriladi (xat ixtiyoriy), bo'lmasa — qisqa xat majburiy.
 * Nomzodga aniq aytiladi: ariza bilan uning ism, email va telefoni shu ish beruvchiga ochiladi.
 */
export function ApplyForm({ vacancyId, loggedIn, hasResume, resumeTitle, initialMine, applyUrl, screening = null, quizAnswered = [] }: { vacancyId: string; loggedIn: boolean; hasResume: boolean; resumeTitle?: string | null; initialMine: Mine; applyUrl: string | null; screening?: PublicScreening | null; /** Avval javob berilgan test savollari — qayta so'ralmaydi */ quizAnswered?: string[] }) {
  const router = useRouter();
  const til = useLocale();
  const [mine, setMine] = useState<Mine>(initialMine);
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qa, setQa] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<Record<string, number>>({});
  const needLetter = !hasResume;
  // Anketa: majburiy savollar (≥2 belgi) va testning barcha savollari
  // Test bir marta topshiriladi: avval javob berilgan savollar ko'rsatilmaydi (server birinchi javobni saqlab qolgan)
  const quizTodo = (screening?.quiz ?? []).filter((q) => !quizAnswered.includes(q.id));
  const quizTaken = Boolean(screening?.quiz.length) && quizTodo.length < (screening?.quiz.length ?? 0);
  const screeningDone = !screening || (screening.questions.every((q) => !q.required || (qa[q.id] ?? "").trim().length >= 2) && quizTodo.every((q) => typeof quiz[q.id] === "number"));
  const canSend = !busy && screeningDone && (!needLetter || letter.trim().length >= COVER_LETTER_MIN);
  // Nima yetishmayapti — tugma yonida aniq aytiladi (ilgari tugma shunchaki o'chiq turardi)
  const missQ = screening ? screening.questions.filter((q) => q.required && (qa[q.id] ?? "").trim().length < 2).length : 0;
  const missT = quizTodo.filter((q) => typeof quiz[q.id] !== "number").length;
  const missL = needLetter ? Math.max(0, COVER_LETTER_MIN - letter.trim().length) : 0;

  async function apply() {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vakansiyalar/${encodeURIComponent(vacancyId)}/ariza`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverLetter: letter.trim(), answers: { q: Object.fromEntries(Object.entries(qa).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)), quiz } }) });
      const j = (await res.json()) as { ok: boolean; data?: { id: string; status: ApplicationStatus }; error?: string; fields?: Record<string, string> };
      if (!res.ok || !j.ok || !j.data) throw new Error((j.fields && Object.values(j.fields)[0]) || j.error || tr(til, T.sendFailed));
      setMine({ id: j.data.id, status: j.data.status, createdAt: Date.now() });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(til, T.sendFailed));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!mine || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/arizalar/${encodeURIComponent(mine.id)}`, { method: "DELETE" });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || tr(til, T.withdrawFailed));
      setMine(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(til, T.withdrawFailed));
    } finally {
      setBusy(false);
    }
  }

  /** Tashqi forma bosildi — egasi uchun hisoblagich (javob kutilmaydi) */
  function countExternal() {
    const url = `/api/vakansiyalar/${encodeURIComponent(vacancyId)}/tashqi`;
    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
  }

  if (!loggedIn) {
    return (
      <div className="card p-5">
        <p className="text-[15px] font-semibold text-fg">{tr(til, T.loginTitle)}</p>
        <p className="mt-1 text-[13px] text-fg-3">{tr(til, T.loginDesc)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/auth/kirish?next=${encodeURIComponent(`/vakansiyalar/${vacancyId}`)}`} className="btn-ink inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold">
            {tr(til, T.login)}
          </Link>
          <Link href={`/auth/royxat?next=${encodeURIComponent(`/vakansiyalar/${vacancyId}`)}`} className="inline-flex h-11 items-center rounded-full border border-line-2 px-5 text-[14px] font-semibold text-fg">
            {tr(til, T.register)}
          </Link>
        </div>
      </div>
    );
  }

  if (mine) {
    return (
      <div className="card expand-in p-5">
        <p className="inline-flex items-center gap-2 text-[15px] font-semibold text-success-text">
          <CheckCircle2 size={18} className="animate-pop" /> {tr(til, T.sent)}
        </p>
        <p className="mt-1 text-[13px] text-fg-2">
          {tr(til, T.statusPre)}
          <strong className="text-fg">{applicationStatusTr(til, mine.status)}</strong>
          {tr(til, T.statusPost)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href="/kabinet/arizalarim" className="inline-flex h-10 items-center rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg">
            {tr(til, T.myApplications)}
          </Link>
          {(mine.status === "new" || mine.status === "viewed") && (
            <button type="button" onClick={withdraw} disabled={busy} className="press text-[13px] font-semibold text-fg-3 underline-offset-2 hover:text-danger-text hover:underline disabled:opacity-50">
              {tr(til, T.withdraw)}
            </button>
          )}
          {error && (
            <span role="alert" className="basis-full text-[12.5px] text-danger-text">
              {error}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <p className="text-[15px] font-semibold text-fg">{tr(til, T.title)}</p>
      <div className={`mt-3 flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[13px] ${hasResume ? "bg-success-soft text-fg" : "bg-warning-soft text-fg"}`}>
        <FileUser size={16} className="mt-0.5 shrink-0" />
        {hasResume ? (
          <span>
            {tr(til, T.resumeAttachedPre)}
            <strong>{resumeTitle}</strong>.{" "}
            <Link href="/kabinet/rezyume" className="underline underline-offset-2">
              {tr(til, T.update)}
            </Link>
          </span>
        ) : (
          <span>
            {tr(til, T.noResumePre)}
            <Link href="/kabinet/rezyume" className="font-semibold underline underline-offset-2">
              {tr(til, T.noResumeLink)}
            </Link>
            {T.noResumePost[til](COVER_LETTER_MIN)}
          </span>
        )}
      </div>
      {screening && screening.questions.length > 0 && (
        <fieldset className="mt-4 grid gap-3">
          <legend className="mb-1 text-[13px] font-semibold text-fg">{tr(til, VAK_AI.applyQuestions)}</legend>
          {screening.questions.map((q, i) => (
            <label key={q.id} className="grid gap-1.5">
              <span className="text-[13px] text-fg-2">
                {i + 1}. {q.text}
                {q.required && <span className="ml-0.5 text-danger-text" aria-hidden>*</span>}
              </span>
              <textarea value={qa[q.id] ?? ""} onChange={(e) => setQa((p) => ({ ...p, [q.id]: e.target.value }))} maxLength={SCREEN_ANSWER_MAX} rows={2} required={q.required} placeholder={tr(til, VAK_AI.answerPh)} className="field w-full resize-y py-2 text-[13.5px] leading-relaxed" />
            </label>
          ))}
        </fieldset>
      )}
      {quizTaken && <p className="mt-4 rounded-[12px] bg-fg/[0.04] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">{tr(til, VAK_AI.quizTaken)}</p>}
      {quizTodo.length > 0 && (
        <fieldset className="mt-4 grid gap-3">
          <legend className="mb-1 text-[13px] font-semibold text-fg">{tr(til, VAK_AI.applyQuiz)}</legend>
          {quizTodo.map((q, i) => (
            <div key={q.id} role="radiogroup" aria-label={q.text} className="grid gap-1.5 rounded-[12px] border border-line p-3">
              <p className="text-[13px] font-medium text-fg">
                {i + 1}. {q.text}
              </p>
              {q.options.map((opt, k) => (
                <label key={k} className={cn("flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] transition-colors", quiz[q.id] === k ? "bg-fg/6 text-fg" : "text-fg-2 hover:bg-fg/[0.03]")}>
                  <input type="radio" name={`quiz-${q.id}`} checked={quiz[q.id] === k} onChange={() => setQuiz((p) => ({ ...p, [q.id]: k }))} className="h-4 w-4 accent-[var(--accent)]" />
                  {opt}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
      )}
      <textarea
        value={letter}
        onChange={(e) => setLetter(e.target.value)}
        maxLength={COVER_LETTER_MAX}
        rows={4}
        placeholder={hasResume ? tr(til, T.letterPhResume) : tr(til, T.letterPhNoResume)}
        className="field mt-3 w-full resize-y py-2.5 text-[14px] leading-relaxed"
      />
      <div className="mt-1 flex justify-between text-[11.5px] text-fg-4">
        <span>{needLetter && letter.trim().length < COVER_LETTER_MIN ? T.moreChars[til](COVER_LETTER_MIN - letter.trim().length) : ""}</span>
        <span>
          {letter.length}/{COVER_LETTER_MAX}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-fg-3">{tr(til, T.contactNote)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="accent" size="md" onClick={apply} disabled={!canSend}>
          <Send size={15} /> {busy ? tr(til, T.sending) : tr(til, T.send)}
        </Button>
        {!busy && !canSend && (missQ > 0 || missT > 0 || missL > 0) && (
          <p className="basis-full text-[12.5px] font-medium text-warning-text" role="status">
            {VAK_AI.missing[til](missQ, missT, missL)}
          </p>
        )}
        {applyUrl && (
          <a href={applyUrl} target="_blank" rel="noopener noreferrer" onClick={countExternal} className="press inline-flex h-11 items-center gap-1.5 rounded-full border border-line-2 px-4 text-[13px] font-semibold text-fg-2 hover:text-fg">
            {tr(til, T.externalForm)} <ExternalLink size={14} />
          </a>
        )}
        {error && (
          <span role="alert" className="basis-full text-[13px] font-semibold text-danger-text">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
