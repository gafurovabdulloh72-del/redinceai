import "server-only";
import { z } from "zod";
import { geminiJson } from "@/lib/i18n/gemini";
import { PROFESSION_SLUGS, VACANCY_TITLE_MAX, type ProfessionSlug } from "./format";
import { KEYWORDS, TITLES, detectEmployment, detectExperience, detectFormat, detectProfession, detectRegion, detectSalary } from "./assistant";

/**
 * Kanal postini saralash (vakansiyami, lavozim, kasb, joy) — lib/vacancies/import.ts ishlatadi.
 * AI (Gemini) bo'lmasa kalit so'zlar: lavozim nomi postning o'zidan olinadi, kasb — avval lavozimdan.
 */
export interface Classified {
  isVacancy: boolean;
  reason: string;
  title: string;
  profession: ProfessionSlug;
  format: "remote" | "hybrid" | "office";
  employment: "full" | "part" | "project" | "internship";
  experience: "none" | "junior" | "middle" | "senior";
  regionSlug: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  company: string;
  source: "ai" | "keywords";
}

const VACANCY_RE = /lavozim\s*:|должность\s*:|vakans|вакан|ishga\s+(?:taklif|olamiz|olinadi|qabul)|xodim\s+(?:kerak|izla|qidir)|kerak\b|talab\s+qilinadi|izlayapmiz|qidiryapmiz|izlaymiz|требует|ищем|ищу\s+(?:монтаж|дизайн|smm)|в\s+команду|hiring|we\s+are\s+looking|#ish\b|#job/i;
const RESUME_RE = /#?rezyume|#?резюме|ish\s+(?:qidiryapman|izlayapman|kerak\s+edi)|ищу\s+работу|portfolio(?:m|im)\s|xizmat(?:imni|lar)\s+taklif|buyurtma\s+qabul\s+qilaman|kurs(?:ga)?\s+(?:yozil|qabul)|reklama\s+uchun/i;

/* ---------- Lavozim nomi, kasb va ish joyi (kalit so'zlar) ---------- */
const ACRONYMS: Array<[RegExp, string]> = [[/\bsmm\b/gi, "SMM"], [/\bui\s*\/\s*ux\b/gi, "UI/UX"], [/\bhr\b/gi, "HR"], [/\bseo\b/gi, "SEO"], [/\b3d\b/gi, "3D"], [/\bit\b/g, "IT"], [/\bai\b/g, "AI"]];
const strip = (s: string) =>
  s
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/[*_`~|•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Postdagi lavozim nomi: «📌 SMM menejer kerak», «VAKANSIYA: Video montajchi», «Lavozim: Dizayner», «Требуется монтажёр».
 * Topilmasa — null (kasb nomidan sarlavha qo'yiladi).
 */
export function extractJobTitle(text: string): string | null {
  const lines = text.split("\n").map(strip).filter(Boolean).slice(0, 12);
  const tidy = (t: string) => {
    let x = t
      .replace(/^[-–—:,.\s]+|[-–—:,.!\s]+$/g, "")
      .replace(/^(?:masofaviy|onlayn|online|remote|ofisga|ofis|offline|yarim\s+stavka|to'liq\s+stavka|udalyonniy|удал[её]нн\S*)\s+/i, "")
      .replace(/\s+/g, " ");
    if (x.length < 3 || x.length > 60 || /\d{2,}|https?:|@/.test(x)) return null;
    x = x.charAt(0).toUpperCase() + x.slice(1);
    for (const [re, v] of ACRONYMS) x = x.replace(re, v);
    return x;
  };
  for (const l of lines) {
    const label = /^(?:lavozim|vakansiya|vakansiyasi|kasb|position|должность|вакансия)\s*[:\-–—]\s*(.+)$/i.exec(l);
    if (label) {
      const t = tidy(label[1].replace(/\s+(?:kerak|talab qilinadi|izlanmoqda)\b.*$/i, ""));
      if (t) return t;
    }
    const need = /^(?:(?:bizga|kompaniyaga|studiyaga|jamoamizga|jamoaga|ofisga)\s+)?(.{3,60}?)\s+(?:kerak|talab\s+qilinadi|izlanmoqda|qidirilmoqda|ishga\s+olinadi|izlayapmiz|qidiryapmiz)\b/i.exec(l);
    if (need) {
      const t = tidy(need[1].replace(/^(?:tajribali|malakali|yosh|shoshilinch(?:\s+ravishda)?)\s+/i, ""));
      if (t && !/^(?:bizga|sizga|xodim|ishchi|odam|mutaxassis)$/i.test(t)) return t;
    }
    const ru = /^(?:требуется|требуются|ищем|нужен|нужна)\s+(.{3,60})$/i.exec(l);
    if (ru) {
      const t = tidy(ru[1]);
      if (t) return t;
    }
  }
  return null;
}

/** Saytdagi shablon kalit so'zlariga qo'shimcha: ruscha va kanal e'lonlarida ko'p uchraydigan so'zlar */
const EXTRA_KEYWORDS: Array<[ProfessionSlug, RegExp]> = [
  ["video", /mobilograf|videograf|operator|монтаж|видео|мобилограф|оператор|моушн|анимац/i],
  ["dizayn", /дизайн|иллюстрат|верстальщик|motion\s+dizayn/i],
  ["marketing", /таргет|smm|маркетолог|реклам|контент[\s-]*менеджер/i],
  ["kontent", /копирайт|переводчик|сценар|журналист|kopirayter|copywriter/i],
  ["dasturlash", /программист|разработчик|developer|frontend|backend/i],
];
function detectProfessionPlus(t: string): ProfessionSlug {
  const base = detectProfession(t);
  if (base !== "boshqa") return base;
  for (const [slug, re] of EXTRA_KEYWORDS) if (re.test(t)) return slug;
  return "boshqa";
}

/** Kasb: avval lavozim nomidan, bo'lmasa matndagi kalit so'zlar SONI bo'yicha (birinchi uchragan emas — «montaj sifati» SMM'ni video qilib qo'ymasin) */
export function detectImportProfession(text: string, title: string | null): ProfessionSlug {
  if (title) {
    const t = detectProfessionPlus(title);
    if (t !== "boshqa") return t;
  }
  let best: ProfessionSlug = "boshqa";
  let bestN = 0;
  for (const [slug, re] of [...KEYWORDS, ...EXTRA_KEYWORDS]) {
    const n = (text.match(new RegExp(re.source, "gi")) ?? []).length;
    if (n > bestN) (best = slug), (bestN = n);
  }
  return best;
}

/** Toshkent tumanlari va mashhur joylari — viloyat nomi yozilmagan e'lonlar uchun */
const TASHKENT_RE = /toshkent|ташкент|shayxontohur|yunusobod|chilonzor|mirzo\s*ulug'?bek|yakkasaroy|mirobod|olmazor|sergeli|uchtepa|bektemir|yashnobod|yangihayot|matbuotchilar|amir\s*temur\s*xiyoboni|labzak|chorsu|beruniy|maksim\s*gorkiy|buyuk\s*ipak\s*yo'li/i;

export function detectImportFormat(text: string): { format: Classified["format"]; regionSlug: string | null } {
  const low = text.toLowerCase().replace(/[ʻʼ`’‘]/g, "'");
  let region = detectRegion(text);
  if (!region && TASHKENT_RE.test(low)) region = "toshkent-shahri";
  const hybrid = /gibrid|hybrid|гибрид/.test(low);
  const office = /\boffline\b|oflayn|\bofis|\boffice|офис|manzil\s*[:\-]|адрес|joyida|ish\s+joyi\s*[:\-]|mo'ljal\s*[:\-]|filial|studiya(?:ga|mizga|da)/.test(low);
  const remote = /masofa|remote|\bonlayn\b|\bonline\b|uydan|удал[её]н|дистанц/.test(low);
  const format = hybrid ? "hybrid" : office ? "office" : remote ? "remote" : region ? "office" : detectFormat(text);
  return { format, regionSlug: format === "remote" ? null : region };
}

export function classifyByKeywords(text: string): Classified {
  const jobTitle = extractJobTitle(text);
  const profession = detectImportProfession(text, jobTitle);
  const { format, regionSlug } = detectImportFormat(text);
  const isResume = RESUME_RE.test(text);
  const isVacancy = !isResume && VACANCY_RE.test(text) && profession !== "boshqa";
  return {
    isVacancy,
    reason: isResume ? "Rezyume yoki xizmat e'loni" : !VACANCY_RE.test(text) ? "Vakansiya belgisi yo'q" : profession === "boshqa" ? "Kasb aniqlanmadi" : "Kalit so'zlar bo'yicha",
    title: (jobTitle ?? TITLES[profession]).slice(0, VACANCY_TITLE_MAX),
    profession,
    format,
    employment: detectEmployment(text),
    experience: detectExperience(text),
    regionSlug,
    ...detectSalary(text),
    company: "",
    source: "keywords",
  };
}

const aiSchema = z.object({
  is_vacancy: z.boolean(),
  reason: z.string().max(200).default(""),
  title: z.string().trim().max(VACANCY_TITLE_MAX).default(""),
  profession: z.enum(PROFESSION_SLUGS).default("boshqa"),
  format: z.enum(["remote", "hybrid", "office"]).default("remote"),
  employment: z.enum(["full", "part", "project", "internship"]).default("full"),
  experience: z.enum(["none", "junior", "middle", "senior"]).default("junior"),
  company: z.string().trim().max(80).default(""),
});

const SYSTEM = `Sen O'zbekistondagi «Kasb Egalari» ish platformasi uchun Telegram kanal postlarini saralovchisan.
Post — ISH BERUVCHI xodim izlayotgan VAKANSIYA e'lonimi? Rezyume (odam o'zi ish qidirmoqda), xizmat/kurs/mahsulot reklamasi, yangilik, so'rovnoma — vakansiya EMAS.
Vakansiya bo'lsa, maydonlarni ajrat. Matnni QAYTA YOZMA. title — postda yozilgan LAVOZIMNING O'ZI, qisqa, o'zbekcha lotin yozuvida (masalan «SMM menejer», «Video montajchi», «Grafik dizayner»); matnda boshqa kasblar tilga olinsa ham (masalan SMM vazifalari ichida «montaj») — asosiy lavozimni ol.
profession: ${PROFESSION_SLUGS.join(", ")} (video — montaj/videograf/motion/animatsiya; dizayn — grafik/UI/UX; marketing — SMM/target/reklama; kontent — kopirayter/tarjimon/ssenariy).
format: remote (faqat aniq «masofaviy/onlayn/uydan» deyilsa) | hybrid | office (manzil, «offline», ofis yoki joyida ishlash ko'rsatilsa). employment: full | part | project (frilans/loyiha) | internship. experience: none | junior (≤1 yil) | middle (1–3) | senior (3+).
company — postda ANIQ yozilgan kompaniya/studiya nomi, bo'lmasa "". O'ylab topma.
Javob — FAQAT JSON: {"is_vacancy":bool,"reason":"qisqa sabab","title","profession","format","employment","experience","company"}.`;

export async function classifyPost(text: string): Promise<Classified> {
  const base = classifyByKeywords(text);
  const raw = await geminiJson(SYSTEM, text.slice(0, 4000), { temperature: 0.1, timeoutMs: 15_000 });
  const p = raw ? aiSchema.safeParse(raw) : null;
  if (!p?.success) return base;
  const d = p.data;
  const place = detectImportFormat(text);
  const region = d.format === "remote" ? null : place.regionSlug;
  return {
    isVacancy: d.is_vacancy,
    reason: d.reason || (d.is_vacancy ? "AI: vakansiya" : "AI: vakansiya emas"),
    title: (d.title || base.title).slice(0, VACANCY_TITLE_MAX),
    profession: d.profession,
    format: d.format,
    employment: d.employment,
    experience: d.experience,
    regionSlug: region,
    salaryMin: base.salaryMin,
    salaryMax: base.salaryMax,
    company: d.company,
    source: "ai",
  };
}

