/**
 * MOSLIK BALLI (2026-11-09, ISH ON «Ball va xulosa» g'oyasi): nomzod ↔ vakansiya, 0–100.
 * Sof funksiya (server va klientda bir xil, DB yo'q) — har mezon bo'yicha ball va SABABI ko'rsatiladi.
 * Mezon ma'lumoti yo'q bo'lsa (masalan vakansiyada maosh yoki ko'nikma ko'rsatilmagan) — u hisobga olinmaydi
 * (nomzod jazolanmaydi), yakuniy ball faqat qo'llanadigan mezonlardan normallanadi.
 * AI tavsiya beradi — yakuniy qaror ish beruvchida (UI shuni aytadi).
 */
import type { Tr } from "@/lib/i18n";
import { REGION_BY_SLUG } from "@/lib/constants";
import { quizResult, type Screening, type ScreeningAnswers } from "./screening";

export type MatchKey = "profession" | "experience" | "skills" | "location" | "salary" | "quiz" | "answers";
export interface MatchCriterion {
  key: MatchKey;
  label: Tr;
  got: number;
  max: number;
  reason: Tr;
}
export type MatchVerdict = "strong" | "good" | "weak";
export interface MatchResult {
  score: number;
  verdict: MatchVerdict;
  criteria: MatchCriterion[];
  summary: Tr;
}

export interface MatchVacancy {
  profession: string;
  experience: "none" | "junior" | "middle" | "senior";
  skills: string[];
  format: "remote" | "hybrid" | "office";
  regionSlug: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  title: string;
  screening?: Screening | null;
}
export interface MatchCandidate {
  /** Rezyume bo'lmasa null — kasb/tajriba «noma'lum» */
  profession: string | null;
  experience: "none" | "junior" | "middle" | "senior" | null;
  skills: string[];
  expectedSalary: number | null;
  format: "any" | "remote" | "hybrid" | "office" | null;
  regionSlug: string | null;
  /** Rezyume sarlavhasi + xulosa + xat — kalit so'z qidiruvi uchun */
  text: string;
}

export const MATCH_LABELS: Record<MatchKey, Tr> = {
  profession: { uz: "Kasb", ru: "Профессия" },
  experience: { uz: "Tajriba", ru: "Опыт" },
  skills: { uz: "Ko'nikmalar", ru: "Навыки" },
  location: { uz: "Format va hudud", ru: "Формат и регион" },
  salary: { uz: "Maosh kutilmasi", ru: "Ожидания по зарплате" },
  quiz: { uz: "Test", ru: "Тест" },
  answers: { uz: "Anketa", ru: "Анкета" },
};
export const VERDICT_LABEL: Record<MatchVerdict, Tr> = {
  strong: { uz: "Kuchli mos", ru: "Сильное совпадение" },
  good: { uz: "O'rtacha mos", ru: "Среднее совпадение" },
  weak: { uz: "Kam mos", ru: "Слабое совпадение" },
};

const RANK = { none: 0, junior: 1, middle: 2, senior: 3 } as const;
const EXP_TR: Record<keyof typeof RANK, Tr> = {
  none: { uz: "tajribasiz", ru: "без опыта" },
  junior: { uz: "1 yilgacha", ru: "до 1 года" },
  middle: { uz: "1–3 yil", ru: "1–3 года" },
  senior: { uz: "3+ yil", ru: "3+ лет" },
};

/** Ko'nikma solishtirish uchun normallash: kichik harf, apostrof/nuqta/bo'shliqsiz ("Adobe Premiere Pro" ≈ "premiere pro") */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, "")
    .replace(/[^a-z0-9а-яё+#]+/gi, " ")
    .trim();

function skillHit(skill: string, candSkills: string[], text: string): boolean {
  const k = norm(skill);
  if (!k) return false;
  for (const c of candSkills) {
    const n = norm(c);
    if (!n) continue;
    if (n === k || n.includes(k) || (k.includes(n) && n.length >= 3)) return true;
  }
  // Matnda alohida so'z sifatida (qisqa so'zlar — «ps», «ai» — faqat aniq chegarada)
  return k.length >= 2 && new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(norm(text));
}

const fmtMln = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10} mln` : `${Math.round(n / 1000)} ming`);
const regionName = (slug: string | null) => (slug ? (REGION_BY_SLUG[slug]?.name ?? slug) : "");

export function scoreMatch(v: MatchVacancy, c: MatchCandidate, answers?: ScreeningAnswers | null): MatchResult {
  const criteria: MatchCriterion[] = [];
  const push = (key: MatchKey, got: number, max: number, reason: Tr) => criteria.push({ key, label: MATCH_LABELS[key], got: Math.max(0, Math.min(max, Math.round(got))), max, reason });

  // 1. Kasb — 20
  if (c.profession == null) push("profession", 0, 20, { uz: "Rezyume yo'q — kasb noma'lum", ru: "Нет резюме — профессия неизвестна" });
  else if (c.profession === v.profession) push("profession", 20, 20, { uz: "Kasb yo'nalishi to'liq mos", ru: "Профессия полностью совпадает" });
  else push("profession", 4, 20, { uz: "Boshqa yo'nalishdagi nomzod", ru: "Кандидат из другой сферы" });

  // 2. Tajriba — 15
  if (c.experience == null) push("experience", 0, 15, { uz: "Tajriba ko'rsatilmagan", ru: "Опыт не указан" });
  else {
    const diff = RANK[c.experience] - RANK[v.experience];
    const got = diff >= 0 ? 15 : diff === -1 ? 7 : 0;
    const reason: Tr =
      diff >= 0
        ? { uz: `Talab: ${EXP_TR[v.experience].uz}, nomzodda: ${EXP_TR[c.experience].uz} — yetarli`, ru: `Требуется: ${EXP_TR[v.experience].ru}, у кандидата: ${EXP_TR[c.experience].ru} — достаточно` }
        : { uz: `Talab: ${EXP_TR[v.experience].uz}, nomzodda: ${EXP_TR[c.experience].uz} — kamroq`, ru: `Требуется: ${EXP_TR[v.experience].ru}, у кандидата: ${EXP_TR[c.experience].ru} — меньше` };
    push("experience", got, 15, reason);
  }

  // 3. Ko'nikmalar — 25 (vakansiyada ko'nikma bo'lmasa — mezon yo'q)
  if (v.skills.length) {
    const hit = v.skills.filter((s) => skillHit(s, c.skills, c.text));
    const miss = v.skills.filter((s) => !hit.includes(s));
    const list = (a: string[]) => a.slice(0, 4).join(", ") + (a.length > 4 ? "…" : "");
    push("skills", (25 * hit.length) / v.skills.length, 25, {
      uz: `${hit.length}/${v.skills.length} ko'nikma mos${hit.length ? `: ${list(hit)}` : ""}${miss.length ? `. Yo'q: ${list(miss)}` : ""}`,
      ru: `Совпадает ${hit.length}/${v.skills.length} навыков${hit.length ? `: ${list(hit)}` : ""}${miss.length ? `. Нет: ${list(miss)}` : ""}`,
    });
  }

  // 4. Format va hudud — 10
  if (v.format === "remote") push("location", 10, 10, { uz: "Masofaviy ish — hudud muhim emas", ru: "Удалённая работа — регион не важен" });
  else if (c.format === "remote") push("location", 3, 10, { uz: "Nomzod faqat masofaviy ishni xohlaydi", ru: "Кандидат хочет только удалённо" });
  else if (!v.regionSlug || !c.regionSlug || c.regionSlug === v.regionSlug) {
    push("location", c.regionSlug || !v.regionSlug ? 10 : 6, 10, v.regionSlug && c.regionSlug ? { uz: `Hudud mos: ${regionName(v.regionSlug)}`, ru: `Регион совпадает: ${regionName(v.regionSlug)}` } : { uz: "Format mos keladi", ru: "Формат подходит" });
  } else push("location", 3, 10, { uz: `Boshqa hudud: ${regionName(c.regionSlug)} (kerak: ${regionName(v.regionSlug)})`, ru: `Другой регион: ${regionName(c.regionSlug)} (нужен: ${regionName(v.regionSlug)})` });

  // 5. Maosh — 10 (ikkala tomonda ham bo'lsa)
  const cap = v.salaryMax ?? v.salaryMin;
  if (cap && c.expectedSalary) {
    const r = c.expectedSalary / cap;
    const got = r <= 1 ? 10 : r <= 1.2 ? 5 : 0;
    push("salary", got, 10, {
      uz: `Kutilma ${fmtMln(c.expectedSalary)} so'm, taklif ${fmtMln(cap)} so'mgacha${r <= 1 ? " — mos" : r <= 1.2 ? " — biroz yuqori" : " — ancha yuqori"}`,
      ru: `Ожидания ${fmtMln(c.expectedSalary)} сум, предложение до ${fmtMln(cap)} сум${r <= 1 ? " — подходит" : r <= 1.2 ? " — немного выше" : " — значительно выше"}`,
    });
  }

  // 6. Test — 25
  const qr = quizResult(v.screening, answers);
  if (qr && answers) push("quiz", (25 * qr.correct) / qr.total, 25, { uz: `${qr.correct}/${qr.total} savolga to'g'ri javob`, ru: `Правильно: ${qr.correct} из ${qr.total}` });

  // 7. Anketa — 10 (javob uzunligi: 40+ belgi — to'liq, qisqa — yarim)
  const qs = v.screening?.questions ?? [];
  if (qs.length && answers) {
    let pts = 0;
    for (const q of qs) {
      const len = (answers.q[q.id] ?? "").trim().length;
      pts += len >= 40 ? 1 : len >= 2 ? 0.5 : 0;
    }
    const full = qs.filter((q) => (answers.q[q.id] ?? "").trim().length >= 40).length;
    push("answers", (10 * pts) / qs.length, 10, { uz: `${qs.length} savoldan ${full} tasiga batafsil javob`, ru: `Подробно отвечено на ${full} из ${qs.length}` });
  }

  const max = criteria.reduce((a, x) => a + x.max, 0);
  const got = criteria.reduce((a, x) => a + x.got, 0);
  const score = max ? Math.round((got / max) * 100) : 0;
  const verdict: MatchVerdict = score >= 75 ? "strong" : score >= 50 ? "good" : "weak";

  // Xulosa: eng kuchli va eng zaif tomon
  const ranked = [...criteria].sort((a, b) => b.got / b.max - a.got / a.max);
  const best = ranked.filter((x) => x.got / x.max >= 0.8).slice(0, 2);
  const worst = ranked.filter((x) => x.got / x.max < 0.5).slice(-2);
  const join = (a: MatchCriterion[], l: "uz" | "ru") => a.map((x) => x.label[l].toLowerCase()).join(", ");
  const summary: Tr = {
    uz: `${VERDICT_LABEL[verdict].uz} (${score}%).${best.length ? ` Kuchli: ${join(best, "uz")}.` : ""}${worst.length ? ` E'tibor bering: ${join(worst, "uz")}.` : ""}`,
    ru: `${VERDICT_LABEL[verdict].ru} (${score}%).${best.length ? ` Сильные стороны: ${join(best, "ru")}.` : ""}${worst.length ? ` Обратите внимание: ${join(worst, "ru")}.` : ""}`,
  };
  return { score, verdict, criteria, summary };
}

/** Rezyume (bo'lsa) + xat → nomzod modeli */
export function candidateFrom(resume: { title: string; profession: string; summary: string; skills: string[]; experience: MatchCandidate["experience"]; expectedSalary: number | null; format: MatchCandidate["format"]; regionSlug: string | null } | null | undefined, coverLetter = ""): MatchCandidate {
  if (!resume) return { profession: null, experience: null, skills: [], expectedSalary: null, format: null, regionSlug: null, text: coverLetter };
  return {
    profession: resume.profession,
    experience: resume.experience,
    skills: resume.skills,
    expectedSalary: resume.expectedSalary,
    format: resume.format,
    regionSlug: resume.regionSlug,
    text: `${resume.title}\n${resume.summary}\n${coverLetter}`,
  };
}
