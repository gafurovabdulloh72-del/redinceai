/**
 * AI SARALASH (2026-11-09, ISH ON g'oyasi): vakansiya anketasi va testi — server va klientda bir xil (server importlari YO'Q).
 *  - Anketa: ochiq savollar (≤5) — nomzod matn bilan javob beradi; `required` bo'lsa javobsiz ariza yuborilmaydi.
 *  - Test: bir to'g'ri javobli savollar (≤10, 2–4 variant) — server avtomatik baholaydi.
 * MAXFIYLIK: to'g'ri javob (`correct`) faqat vakansiya egasiga beriladi — nomzodga `publicScreening()` orqali.
 */
import { z } from "zod";

export const SCREEN_Q_MAX = 5;
export const SCREEN_QUIZ_MAX = 10;
export const SCREEN_Q_TEXT_MAX = 200;
export const SCREEN_OPTION_MAX = 120;
export const SCREEN_ANSWER_MAX = 1000;

export interface ScreenQuestion {
  id: string;
  text: string;
  required: boolean;
}
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  /** To'g'ri variant indeksi — faqat egasiga */
  correct: number;
}
export interface Screening {
  questions: ScreenQuestion[];
  quiz: QuizQuestion[];
}
/** Nomzodga ko'rinadigan shakl (to'g'ri javobsiz) */
export interface PublicScreening {
  questions: ScreenQuestion[];
  quiz: Array<Omit<QuizQuestion, "correct">>;
}
export interface ScreeningAnswers {
  /** savol id → matn */
  q: Record<string, string>;
  /** test savoli id → tanlangan variant indeksi */
  quiz: Record<string, number>;
}

const id = z.string().trim().min(1).max(24).regex(/^[a-z0-9_-]+$/i);

export const screeningSchema = z
  .object({
    questions: z
      .array(z.object({ id, text: z.string().trim().min(3, "Savol kamida 3 ta belgi").max(SCREEN_Q_TEXT_MAX, `Savol ${SCREEN_Q_TEXT_MAX} belgidan oshmasin`), required: z.boolean().default(true) }))
      .max(SCREEN_Q_MAX, `Ko'pi bilan ${SCREEN_Q_MAX} ta savol`)
      .default([]),
    quiz: z
      .array(
        z
          .object({
            id,
            text: z.string().trim().min(3, "Test savoli kamida 3 ta belgi").max(SCREEN_Q_TEXT_MAX),
            options: z.array(z.string().trim().min(1, "Variant bo'sh").max(SCREEN_OPTION_MAX)).min(2, "Kamida 2 ta variant").max(4, "Ko'pi bilan 4 ta variant"),
            correct: z.number().int().min(0),
          })
          .refine((q) => q.correct < q.options.length, { message: "To'g'ri javobni belgilang", path: ["correct"] }),
      )
      .max(SCREEN_QUIZ_MAX, `Ko'pi bilan ${SCREEN_QUIZ_MAX} ta test savoli`)
      .default([]),
  })
  .superRefine((s, ctx) => {
    const ids = [...s.questions.map((q) => q.id), ...s.quiz.map((q) => q.id)];
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Savol identifikatorlari takrorlanmasin" });
  })
  .transform((s): Screening | null => (s.questions.length || s.quiz.length ? s : null));

export const answersSchema = z
  .object({
    q: z.record(z.string().max(24), z.string().trim().max(SCREEN_ANSWER_MAX, `Javob ${SCREEN_ANSWER_MAX} belgidan oshmasin`)).default({}),
    quiz: z.record(z.string().max(24), z.number().int().min(0).max(3)).default({}),
  })
  .default({ q: {}, quiz: {} });

export function publicScreening(s: Screening | null | undefined): PublicScreening | null {
  if (!s || (!s.questions.length && !s.quiz.length)) return null;
  return { questions: s.questions, quiz: s.quiz.map(({ correct: _c, ...rest }) => rest) };
}

/**
 * Javoblarni vakansiya anketasiga moslab tozalash va tekshirish: noma'lum id'lar tashlanadi, majburiy savol bo'sh — xato,
 * test savollari hammasiga javob shart. Xato bo'lsa {field: xabar} qaytadi.
 */
export function checkAnswers(s: Screening | null | undefined, raw: ScreeningAnswers): { answers: ScreeningAnswers | null; error: { field: string; message: string } | null } {
  if (!s) return { answers: null, error: null };
  const q: Record<string, string> = {};
  for (const item of s.questions) {
    const v = (raw.q[item.id] ?? "").trim();
    if (item.required && v.length < 2) return { answers: null, error: { field: `q.${item.id}`, message: `Savolga javob bering: «${item.text.slice(0, 60)}»` } };
    if (v) q[item.id] = v.slice(0, SCREEN_ANSWER_MAX);
  }
  const quiz: Record<string, number> = {};
  for (const item of s.quiz) {
    const v = raw.quiz[item.id];
    if (typeof v !== "number" || v < 0 || v >= item.options.length) return { answers: null, error: { field: `quiz.${item.id}`, message: `Test savoliga javob tanlang: «${item.text.slice(0, 60)}»` } };
    quiz[item.id] = v;
  }
  return { answers: { q, quiz }, error: null };
}

/** Test natijasi: to'g'ri javoblar soni / jami (test yo'q — null) */
export function quizResult(s: Screening | null | undefined, a: ScreeningAnswers | null | undefined): { correct: number; total: number } | null {
  if (!s || !s.quiz.length) return null;
  let correct = 0;
  for (const item of s.quiz) if (a?.quiz?.[item.id] === item.correct) correct++;
  return { correct, total: s.quiz.length };
}

/** Yangi savol id'si (klientda) */
export const newScreenId = (prefix: "q" | "t") => `${prefix}${Math.random().toString(36).slice(2, 9)}`;
