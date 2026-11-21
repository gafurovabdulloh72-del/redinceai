import "server-only";
import { VACANCY_TITLE_MAX, type ProfessionSlug } from "./format";
import { TITLES, detectEmployment, detectExperience, detectFormat, detectRegion, detectSalary } from "./assistant";

/**
 * Kanal postini saralash (vakansiyami, lavozim, kasb, joy) — lib/vacancies/import.ts ishlatadi.
 * AI'siz: lavozim nomi postning o'zidan olinadi, kasb — avval lavozimdan, keyin matndagi rol so'zlaridan.
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

/**
 * KASB — AI'siz, faqat matndan. Har kasbning LAVOZIM so'zlari (rol nomlari) bor.
 * 1) Lavozim nomida (qavs ichidagisiz) eng OLDIN uchragan rol — asosiy kasb: «Marketolog (SMM + video kreativ)» → marketing.
 * 2) Lavozimdan topilmasa — butun matnda rol so'zlari SONI bo'yicha (sarlavha qatorlari og'irroq).
 * «Operator» yolg'iz — sotuv/call-markaz operatori; video faqat «video/kamera/mobil operator» bo'lsa.
 */
const ROLE_RULES: Array<[ProfessionSlug, RegExp]> = [
  ["sotuv", /sotuv|savdo|sotuvchi|kassir|konsultant|maslahatchi|call[\s-]*cent|kol[\s-]*sent|колл[\s-]*центр|operator|оператор|продаж|продавец|кассир|telemarket|qo'ng'iroq\s+qil|mijozlar\s+bilan\s+ishlash|менеджер\s+по\s+работе\s+с\s+клиент/],
  ["video", /\bvideo|видео|montaj|монтаж|videograf|mobilograf|мобилограф|kameraman|kamera\s*man|reels|motion|моушн|animat|анимац|kliper|premiere|after\s*effects|davinci|youtube\s+kanal/],
  ["dizayn", /dizayn|дизайн|figma|logo|brending|\bui\b|\bux\b|illustrat|иллюстрат|photoshop|grafik|верстальщик/],
  ["marketing", /marketolog|marketing|маркетолог|маркетинг|\bsmm|smm\b|target|таргет|reklama|реклам|\bseo\b|brend\s+menejer/],
  ["kontent", /kopirayt|copywrit|копирайт|tarjim|переводчик|kontent|контент|maqola|ssenariy|сценар|jurnalist|журналист|matn\s+yoz/],
  ["dasturlash", /dasturchi|dastur|программист|разработчик|developer|frontend|backend|full\s*stack|react|python|javascript|php|flutter|mobil\s+ilova/],
  ["moliya", /buxgalter|бухгалтер|moliya|финанс|hisobchi|auditor|аудитор|ekonomist|экономист/],
  ["talim", /o'qituvchi|oqituvchi|учитель|преподават|repetitor|репетитор|ustoz|trener|тренер/],
  ["data", /analitik|аналитик|data|ma'lumotlar|power\s*bi|\bsql\b|machine\s+learning|sun'iy\s+intellekt/],
  ["boshqaruv", /assistent|ассистент|loyiha\s+menejer|project\s+manager|\bhr\b|kadrlar|рекрутер|ofis\s+menejer|administrator|администратор|rahbar|руководител|direktor|директор|sekretar|секретар|kurer|курьер|haydovchi|водител|omborchi|кладовщик/],
];

/** Kichik harf, o'zbekcha apostroflar bir xil, «video operator» → «videograf» (sotuv operatoridan ajratish) */
function normRoles(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ`’‘]/g, "'")
    .replace(/(?:video|kamera|mobil|dron|kino|tele)[\s-]*operator\S*/g, " videograf ")
    .replace(/(?:видео|кино|теле)?[\s-]*оператор\S*\s+(?:видео|съ[её]мк|камер)\S*/g, " videograf ")
    .replace(/видеооператор\S*/g, " videograf ");
}

/** Matnda birinchi uchragan rolning kasbi (lavozim nomi uchun) */
function firstRole(text: string): ProfessionSlug | null {
  const t = normRoles(text);
  let best: ProfessionSlug | null = null;
  let at = Infinity;
  for (const [slug, re] of ROLE_RULES) {
    const m = re.exec(t);
    if (m && m.index < at) (best = slug), (at = m.index);
  }
  return best;
}

/** Kasb: avval lavozim nomidan (qavssiz, keyin qavs bilan), bo'lmasa matndagi rol so'zlari SONI bo'yicha */
export function detectImportProfession(text: string, title: string | null): ProfessionSlug {
  if (title) {
    const main = firstRole(title.replace(/\([^)]*\)|\[[^\]]*\]/g, " ")) ?? firstRole(title);
    if (main) return main;
  }
  const lines = text.split("\n").filter((l) => l.trim());
  const head = normRoles(lines.slice(0, 3).join("\n"));
  const body = normRoles(text);
  let best: ProfessionSlug = "boshqa";
  let bestN = 0;
  for (const [slug, re] of ROLE_RULES) {
    const g = new RegExp(re.source, "g");
    // Birinchi 3 qatordagi so'z uch baravar og'ir (odatda lavozim shu yerda)
    const n = (body.match(g) ?? []).length + 2 * (head.match(g) ?? []).length;
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

/**
 * Kanal postini saralash — AI ISHLATILMAYDI (foydalanuvchi qarori): hamma narsa matndan, oldindan aytib bo'ladigan qoidalar bilan.
 * Async imzo saqlangan (chaqiruvchilar o'zgarmasin).
 */
export async function classifyPost(text: string): Promise<Classified> {
  return classifyByKeywords(text);
}
