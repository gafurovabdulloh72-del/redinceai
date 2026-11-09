"use client";

import { ListChecks, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { VAK_AI as T } from "@/lib/i18n/dict/vacancies-ai";
import { SCREEN_OPTION_MAX, SCREEN_Q_MAX, SCREEN_Q_TEXT_MAX, SCREEN_QUIZ_MAX, newScreenId, type Screening } from "@/lib/vacancies/screening";
import { cn } from "@/lib/utils";

const LABEL = "text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3";
const iconBtn = "press grid h-9 w-9 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-fg/6 hover:text-danger-text";

/**
 * Vakansiya anketasi (ochiq savollar) va testi (bitta to'g'ri javob) muharriri — VacancyForm ichida.
 * To'g'ri javob doirachasi faqat egasiga ko'rinadi; nomzodga server `publicScreening()` bilan to'g'ri javobsiz beradi.
 */
export function ScreeningEditor({ value, onChange }: { value: Screening; onChange: (s: Screening) => void }) {
  const til = useLocale();
  const setQ = (i: number, patch: Partial<Screening["questions"][number]>) => onChange({ ...value, questions: value.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const setT = (i: number, patch: Partial<Screening["quiz"][number]>) => onChange({ ...value, quiz: value.quiz.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <section className="grid gap-4 rounded-[16px] border border-line p-4 sm:p-5" aria-labelledby="screening-title">
      <div>
        <h3 id="screening-title" className="text-[15px] font-semibold text-fg">
          {tr(til, T.screeningTitle)}
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{tr(til, T.screeningDesc)}</p>
      </div>

      {/* Anketa */}
      <div className="grid gap-2">
        <span className={cn(LABEL, "inline-flex items-center gap-1.5")}>
          <MessageSquareText size={13} /> {tr(til, T.questions)} · {value.questions.length}/{SCREEN_Q_MAX}
        </span>
        {value.questions.map((q, i) => (
          <div key={q.id} className="expand-in flex items-start gap-2">
            <span className="mt-2.5 w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-fg-4">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <input value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} maxLength={SCREEN_Q_TEXT_MAX} placeholder={tr(til, T.questionPh)} aria-label={`${tr(til, T.questions)} ${i + 1}`} className="field h-10 w-full text-[13.5px]" />
              <label className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-fg-3">
                <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[var(--accent)]" /> {tr(til, T.required)}
              </label>
            </div>
            <button type="button" onClick={() => onChange({ ...value, questions: value.questions.filter((_, j) => j !== i) })} className={iconBtn} aria-label={tr(til, T.remove)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {value.questions.length < SCREEN_Q_MAX && (
          <button type="button" onClick={() => onChange({ ...value, questions: [...value.questions, { id: newScreenId("q"), text: "", required: true }] })} className="press inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
            <Plus size={14} /> {tr(til, T.addQuestion)}
          </button>
        )}
      </div>

      {/* Test */}
      <div className="grid gap-3 border-t border-line pt-4">
        <span className={cn(LABEL, "inline-flex items-center gap-1.5")}>
          <ListChecks size={13} /> {tr(til, T.quiz)} · {value.quiz.length}/{SCREEN_QUIZ_MAX}
        </span>
        {value.quiz.length > 0 && <p className="-mt-1 text-[12px] text-fg-4">{tr(til, T.correctHint)}</p>}
        {value.quiz.map((q, i) => (
          <div key={q.id} className="expand-in grid gap-2 rounded-[12px] bg-fg/[0.03] p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-fg-4">{i + 1}.</span>
              <input value={q.text} onChange={(e) => setT(i, { text: e.target.value })} maxLength={SCREEN_Q_TEXT_MAX} placeholder={tr(til, T.quizPh)} aria-label={`${tr(til, T.quiz)} ${i + 1}`} className="field h-10 min-w-0 flex-1 text-[13.5px]" />
              <button type="button" onClick={() => onChange({ ...value, quiz: value.quiz.filter((_, j) => j !== i) })} className={iconBtn} aria-label={tr(til, T.remove)}>
                <Trash2 size={15} />
              </button>
            </div>
            <div className="grid gap-1.5 pl-7" role="radiogroup" aria-label={tr(til, T.correctAria)}>
              {q.options.map((opt, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${q.id}`} checked={q.correct === k} onChange={() => setT(i, { correct: k })} className="h-4 w-4 shrink-0 accent-[var(--success,#16a34a)]" aria-label={`${tr(til, T.correctAria)}: ${opt || k + 1}`} />
                  <input
                    value={opt}
                    onChange={(e) => setT(i, { options: q.options.map((o, m) => (m === k ? e.target.value : o)) })}
                    maxLength={SCREEN_OPTION_MAX}
                    placeholder={`${tr(til, T.optionPh)} ${k + 1}`}
                    className={cn("field h-9 min-w-0 flex-1 text-[13px]", q.correct === k && "border-success/50")}
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setT(i, { options: q.options.filter((_, m) => m !== k), correct: q.correct === k ? 0 : q.correct > k ? q.correct - 1 : q.correct })}
                      className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-fg-4 hover:text-danger-text"
                      aria-label={tr(til, T.remove)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 4 && (
                <button type="button" onClick={() => setT(i, { options: [...q.options, ""] })} className="press inline-flex h-8 w-fit items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-fg-3 hover:text-fg">
                  <Plus size={13} /> {tr(til, T.addOption)}
                </button>
              )}
            </div>
          </div>
        ))}
        {value.quiz.length < SCREEN_QUIZ_MAX && (
          <button type="button" onClick={() => onChange({ ...value, quiz: [...value.quiz, { id: newScreenId("t"), text: "", options: ["", ""], correct: 0 }] })} className="press inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-dashed border-line-2 px-3.5 text-[12.5px] font-semibold text-fg-2 hover:border-fg hover:text-fg">
            <Plus size={14} /> {tr(til, T.addQuiz)}
          </button>
        )}
      </div>
    </section>
  );
}

/** Formadan serverga: bo'sh savol/variantlarni tashlab yuborish (yarim to'ldirilgan qator 422 bermasin) */
export function cleanScreening(s: Screening): Screening | null {
  const questions = s.questions.map((q) => ({ ...q, text: q.text.trim() })).filter((q) => q.text.length >= 3);
  const quiz = s.quiz
    .map((q) => {
      const opts = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      const correct = Math.max(0, opts.findIndex((x) => x.i === q.correct));
      return { ...q, text: q.text.trim(), options: opts.map((x) => x.o), correct };
    })
    .filter((q) => q.text.length >= 3 && q.options.length >= 2);
  return questions.length || quiz.length ? { questions, quiz } : null;
}
