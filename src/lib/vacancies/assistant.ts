import "server-only";
import { z } from "zod";
import { geminiJson } from "@/lib/i18n/gemini";
import { REGIONS } from "@/lib/constants";
import { PROFESSION_SLUGS, VACANCY_DESC_MAX, VACANCY_REQ_MAX, VACANCY_SKILLS_MAX, VACANCY_TITLE_MAX, type ProfessionSlug } from "./format";
import { SCREEN_Q_MAX, SCREEN_QUIZ_MAX, newScreenId, type Screening } from "./screening";

/**
 * «MENGA VAKANSIYA YARAT» (2026-11-09, ISH ON g'oyasi): ish beruvchi talabni erkin yozadi → loyiha: sarlavha, tavsif,
 * talablar, ko'nikmalar, format/bandlik/tajriba + anketa savollari va test. Ish beruvchi TAHRIRLAYDI va o'zi e'lon qiladi.
 * GEMINI_API_KEY bo'lsa — AI; bo'lmasa (yoki AI xato qilsa) — kalit so'zlarga asoslangan shablon (hech qachon bo'sh qaytmaydi).
 */
export interface VacancyDraft {
  title: string;
  profession: ProfessionSlug;
  description: string;
  requirements: string;
  skills: string[];
  experience: "none" | "junior" | "middle" | "senior";
  format: "remote" | "hybrid" | "office";
  employment: "full" | "part" | "project" | "internship";
  /** Talabda shahar/viloyat aytilgan bo'lsa (ofis/gibrid uchun) */
  regionSlug: string | null;
  screening: Screening;
  source: "ai" | "template";
}

export const draftInputSchema = z.object({
  brief: z.string().trim().min(10, "Talabni kamida 10 ta belgida yozing").max(1500, "Talab 1500 belgidan oshmasin"),
  profession: z.enum(PROFESSION_SLUGS).optional().or(z.literal("")).default(""),
});

/* ------------------------------------------------------------------ */
/* Shablon (AI'siz)                                                    */
/* ------------------------------------------------------------------ */
const KEYWORDS: Array<[ProfessionSlug, RegExp]> = [
  ["video", /montaj|video|operator|reels|motion|animats|kliper|premiere|after effects|davinci/i],
  ["dizayn", /dizayn|figma|logo|brending|\bui\b|\bux\b|ui\/ux|illustrator|photoshop|grafik/i],
  ["dasturlash", /dastur|frontend|backend|developer|react|python|javascript|php|flutter|mobil ilova|full ?stack|1c/i],
  ["marketing", /smm|marketing|target|reklama|instagram|telegram kanal|\bseo\b|brend menejer/i],
  ["kontent", /kopirayt|copywrit|tarjim|kontent|maqola|matn yoz|ssenariy/i],
  ["sotuv", /sotuv|savdo|operator call|call ?center|mijozlar bilan|menejer.*sotuv/i],
  ["moliya", /buxgalter|moliya|hisobchi|audit|1c buxgalter/i],
  ["talim", /o'qituvchi|oqituvchi|repetitor|ustoz|mentor|kurs olib/i],
  ["data", /analitik|data|ma'lumotlar|excel|power bi|sql|sun'iy intellekt|\bai\b|machine learning/i],
  ["boshqaruv", /assistent|loyiha menejer|project manager|\bhr\b|ofis menejer|boshqaruv|rahbar/i],
];

const SKILLS: Record<ProfessionSlug, string[]> = {
  video: ["Adobe Premiere Pro", "DaVinci Resolve", "After Effects", "Rang korreksiyasi", "Ovoz bilan ishlash", "Reels montaj"],
  dizayn: ["Figma", "Adobe Photoshop", "Adobe Illustrator", "Brending", "Tipografika", "UI/UX"],
  dasturlash: ["JavaScript", "TypeScript", "React", "Git", "REST API", "SQL"],
  marketing: ["SMM", "Target reklama", "Kontent reja", "Analitika", "Copywriting", "Telegram"],
  kontent: ["Copywriting", "Tahrir", "SEO matn", "Ssenariy", "Tarjima"],
  sotuv: ["Muzokaralar", "CRM", "Telefon orqali sotuv", "Mijozlar bilan ishlash", "Rejaga ishlash"],
  moliya: ["1C", "Excel", "Soliq hisoboti", "Buxgalteriya hisobi", "Moliyaviy tahlil"],
  talim: ["Dars rejasi", "Metodika", "Onlayn dars", "Kommunikatsiya"],
  boshqaruv: ["Rejalashtirish", "Excel / Google Sheets", "Kommunikatsiya", "Hujjatlar bilan ishlash", "Trello / Notion"],
  data: ["Excel", "SQL", "Power BI", "Python", "Statistika"],
  boshqa: ["Kommunikatsiya", "Mas'uliyat", "Kompyuter savodxonligi"],
};

const TITLES: Record<ProfessionSlug, string> = {
  video: "Video montajchi",
  dizayn: "Grafik dizayner",
  dasturlash: "Dasturchi",
  marketing: "SMM mutaxassisi",
  kontent: "Kopirayter",
  sotuv: "Sotuv menejeri",
  moliya: "Buxgalter",
  talim: "O'qituvchi",
  boshqaruv: "Loyiha menejeri / assistent",
  data: "Ma'lumotlar tahlilchisi",
  boshqa: "Mutaxassis",
};

/** Kasbga xos test (ish beruvchi tahrirlaydi) — juda oddiy, faqat boshlang'ich filtr */
const QUIZ: Partial<Record<ProfessionSlug, Array<{ text: string; options: string[]; correct: number }>>> = {
  video: [
    { text: "Instagram Reels uchun standart kadr nisbati qaysi?", options: ["16:9", "9:16", "4:3", "1:1"], correct: 1 },
    { text: "Rang korreksiyasi uchun eng mashhur dastur qaysi?", options: ["DaVinci Resolve", "MS Word", "Figma", "Excel"], correct: 0 },
  ],
  dizayn: [
    { text: "Logotip uchun qaysi format sifatni yo'qotmasdan kattalashadi?", options: ["JPG", "PNG", "SVG (vektor)", "GIF"], correct: 2 },
    { text: "Bosma mahsulot uchun qaysi rang modeli ishlatiladi?", options: ["RGB", "CMYK", "HEX", "HSL"], correct: 1 },
  ],
  dasturlash: [
    { text: "Git'da o'zgarishlarni masofaviy omborga yuborish buyrug'i?", options: ["git pull", "git push", "git clone", "git init"], correct: 1 },
    { text: "HTTP 404 holat kodi nimani bildiradi?", options: ["Server xatosi", "Ruxsat yo'q", "Sahifa topilmadi", "Muvaffaqiyat"], correct: 2 },
  ],
  marketing: [
    { text: "CTR nimani o'lchaydi?", options: ["Reklama ko'rilganlar soni", "Bosishlar ulushi (bosish / ko'rish)", "Sotuvlar summasi", "Obunachilar o'sishi"], correct: 1 },
    { text: "Target reklamada auditoriyani nima bo'yicha tanlash mumkin?", options: ["Faqat yosh", "Qiziqish, yosh, hudud va boshqalar", "Faqat jins", "Tanlab bo'lmaydi"], correct: 1 },
  ],
  moliya: [{ text: "O'zbekistonda QQS stavkasi (2026) odatda necha foiz?", options: ["10%", "12%", "15%", "20%"], correct: 1 }],
  data: [{ text: "SQL'da natijani saralash uchun qaysi ifoda ishlatiladi?", options: ["GROUP BY", "ORDER BY", "WHERE", "JOIN"], correct: 1 }],
};

function detectProfession(brief: string): ProfessionSlug {
  for (const [slug, re] of KEYWORDS) if (re.test(brief)) return slug;
  return "boshqa";
}
function detectExperience(b: string): VacancyDraft["experience"] {
  const m = /(\d+)\s*\+?\s*yil/i.exec(b);
  if (m) {
    const n = Number(m[1]);
    return n >= 3 ? "senior" : n >= 1 ? "middle" : "junior";
  }
  if (/tajribasiz|tajriba shart emas|talaba|boshlovchi|amaliyot/i.test(b)) return "none";
  if (/senior|katta tajriba/i.test(b)) return "senior";
  return "junior";
}
function detectFormat(b: string): VacancyDraft["format"] {
  if (/gibrid|hybrid/i.test(b)) return "hybrid";
  if (/ofis|office|joyida|filial/i.test(b)) return "office";
  return "remote";
}
function detectEmployment(b: string): VacancyDraft["employment"] {
  if (/amaliyot|stajyor|internship/i.test(b)) return "internship";
  if (/yarim stavka|part[- ]?time|kuniga \d soat/i.test(b)) return "part";
  if (/loyiha|freelance|frilans|bir martalik|proyekt/i.test(b)) return "project";
  return "full";
}

/** Matndan hudud: viloyat nomi, poytaxti yoki shahri («Toshkentdagi», «Samarqandda» — so'z boshi bo'yicha) */
export function detectRegion(b: string): string | null {
  const low = b.toLowerCase().replace(/[ʻʼ`’‘]/g, "'");
  // Toshkent shahri vs viloyati: «viloyat» so'zi yonida bo'lsa — viloyat
  if (/toshkent\s+viloyat/.test(low)) return "toshkent-viloyati";
  for (const r of REGIONS) {
    const names = [r.short.replace(/\s+(sh|vil)\.$/, ""), r.capital, ...r.cities].map((n) => n.toLowerCase());
    if (names.some((n) => n.length >= 4 && new RegExp(`(^|[^a-z'])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(low))) return r.slug;
  }
  return null;
}

function templateDraft(brief: string, prof?: ProfessionSlug): VacancyDraft {
  const profession = prof || detectProfession(brief);
  const experience = detectExperience(brief);
  const format = detectFormat(brief);
  const employment = detectEmployment(brief);
  // Sarlavha: talabning birinchi qisqa jumlasi «kerak/izlayapmiz» so'zlarisiz, bo'lmasa kasb nomi
  const first = brief.split(/[.\n!?]/)[0]?.replace(/\b(bizga|kerak|izlayapmiz|qidiryapmiz|qidirilmoqda|talab qilinadi)\b/gi, "").replace(/\s+/g, " ").trim() ?? "";
  const title = (first.length >= 5 && first.length <= 70 ? first[0].toUpperCase() + first.slice(1) : TITLES[profession]).slice(0, VACANCY_TITLE_MAX);
  const lower = brief.toLowerCase();
  const skills = SKILLS[profession].filter((s) => lower.includes(s.toLowerCase().split(" ").pop() ?? "")).concat(SKILLS[profession]).filter((s, i, a) => a.indexOf(s) === i).slice(0, 6);
  const description = [
    `Biz jamoamizga ${TITLES[profession].toLowerCase()} izlayapmiz.`,
    "",
    "Vazifalar va shartlar:",
    brief.trim(),
    "",
    "Biz taklif qilamiz:",
    "- o'z vaqtida to'lanadigan maosh;",
    "- qulay ish jadvali va do'stona jamoa;",
    "- o'sish va yangi loyihalarda qatnashish imkoniyati.",
  ]
    .join("\n")
    .slice(0, VACANCY_DESC_MAX);
  const requirements = [
    `- ${experience === "none" ? "Tajriba shart emas — o'rganishga tayyorlik muhim" : experience === "senior" ? "Kamida 3 yil amaliy tajriba" : experience === "middle" ? "1–3 yil amaliy tajriba" : "Kichik bo'lsa ham amaliy tajriba"};`,
    `- ${skills.slice(0, 3).join(", ")} bilan ishlay olish;`,
    "- portfolio yoki oldingi ishlardan namunalar;",
    "- mas'uliyat va muddatlarga rioya qilish.",
  ]
    .join("\n")
    .slice(0, VACANCY_REQ_MAX);
  const screening: Screening = {
    questions: [
      { id: newScreenId("q"), text: "Oxirgi bajargan loyihangiz haqida qisqacha yozing (havola bo'lsa qo'shing).", required: true },
      { id: newScreenId("q"), text: "Nega aynan shu vakansiya sizni qiziqtirdi?", required: false },
      { id: newScreenId("q"), text: "Qachondan ish boshlay olasiz va kutayotgan maoshingiz qancha?", required: true },
    ],
    quiz: (QUIZ[profession] ?? []).map((q) => ({ id: newScreenId("t"), ...q })),
  };
  return { title, profession, description, requirements, skills, experience, format, employment, regionSlug: format === "remote" ? null : detectRegion(brief), screening, source: "template" };
}

/* ------------------------------------------------------------------ */
/* AI (Gemini)                                                         */
/* ------------------------------------------------------------------ */
const aiSchema = z.object({
  title: z.string().trim().min(5).max(VACANCY_TITLE_MAX),
  profession: z.enum(PROFESSION_SLUGS),
  description: z.string().trim().min(30).max(VACANCY_DESC_MAX),
  requirements: z.string().trim().max(VACANCY_REQ_MAX).default(""),
  skills: z.array(z.string().trim().min(1).max(40)).max(VACANCY_SKILLS_MAX).default([]),
  experience: z.enum(["none", "junior", "middle", "senior"]).default("junior"),
  format: z.enum(["remote", "hybrid", "office"]).default("remote"),
  employment: z.enum(["full", "part", "project", "internship"]).default("full"),
  questions: z.array(z.string().trim().min(3).max(200)).max(SCREEN_Q_MAX).default([]),
  quiz: z
    .array(z.object({ text: z.string().trim().min(3).max(200), options: z.array(z.string().trim().min(1).max(120)).min(2).max(4), correct: z.number().int().min(0).max(3) }))
    .max(SCREEN_QUIZ_MAX)
    .default([]),
});

const SYSTEM = `Sen «Kasb Egalari» (O'zbekiston) platformasida ish beruvchiga vakansiya e'lonini tayyorlab beruvchi HR yordamchisisan.
Ish beruvchi talabni erkin yozadi. Sen O'ZBEK tilida (lotin yozuvi, apostrof ' bilan) professional, qisqa va aniq e'lon loyihasini tuzasan.
Qoidalar: faqat talabda aytilgan yoki kasbga odatiy narsalarni yoz, maosh/kompaniya nomini o'ylab TOPMA; tavsif 600–1500 belgi (vazifalar, shartlar, taklif qilinadigan narsalar, ro'yxatlar "- " bilan); talablar 3–6 band "- " bilan; ko'nikmalar 4–8 ta qisqa (vosita/texnologiya nomlari);
anketa savollari 3 ta ochiq savol (nomzodning amaliy tajribasini tekshiradigan); test 3–5 ta bir to'g'ri javobli savol (2–4 variant, correct — to'g'ri variant indeksi 0 dan), savollar kasbga xos va bir ma'noli bo'lsin.
profession quyidagilardan biri: ${PROFESSION_SLUGS.join(", ")}. experience: none|junior|middle|senior. format: remote|hybrid|office. employment: full|part|project|internship.
Javob — FAQAT JSON obyekt: {"title","profession","description","requirements","skills":[],"experience","format","employment","questions":[],"quiz":[{"text","options":[],"correct"}]}.`;

export async function draftVacancy(brief: string, profession?: ProfessionSlug | ""): Promise<VacancyDraft> {
  const raw = await geminiJson(SYSTEM, `Talab:\n${brief}${profession ? `\nKasb yo'nalishi: ${profession}` : ""}`);
  const parsed = raw ? aiSchema.safeParse(raw) : null;
  if (parsed?.success) {
    const d = parsed.data;
    const quiz = d.quiz.filter((q) => q.correct < q.options.length).map((q) => ({ id: newScreenId("t"), ...q }));
    return {
      title: d.title,
      profession: profession || d.profession,
      description: d.description,
      requirements: d.requirements,
      skills: d.skills.filter((s, i, a) => a.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i),
      experience: d.experience,
      format: d.format,
      employment: d.employment,
      regionSlug: d.format === "remote" ? null : detectRegion(brief),
      screening: { questions: d.questions.map((text) => ({ id: newScreenId("q"), text, required: true })), quiz },
      source: "ai",
    };
  }
  return templateDraft(brief, profession || undefined);
}
