import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, lt, or, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, vacancies, vacancyImports, vacancySources } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { geminiJson } from "@/lib/i18n/gemini";
import { REGIONS, TERMS_VERSION } from "@/lib/constants";
import { uid } from "@/lib/utils";
import { PROFESSION_SLUGS, VACANCY_TTL_DAYS, VACANCY_TITLE_MAX, type ProfessionSlug } from "./format";
import { TITLES, detectEmployment, detectExperience, detectFormat, detectProfession, detectRegion, detectSalary } from "./assistant";
import { normalizeChannel, parseChannelPage, type ChannelPost } from "./telegram-channel";

/**
 * VAKANSIYA IMPORTI (2026-11-19): ochiq Telegram kanallaridan avtomatik vakansiya.
 *  1) `t.me/s/<kanal>` sahifasi o'qiladi (oxirgi ~20 post), faqat `lastPostId` dan keyingilari ko'riladi;
 *  2) AI (Gemini; kalit bo'lmasa — kalit so'zlar) postni tasniflaydi: vakansiyami, qaysi kasb, format/hudud/maosh;
 *  3) mos bo'lsa — MATN O'ZGARISHSIZ vakansiya bo'lib chiqadi: «Manba: Kanal nomi», asl postga havola, ariza = asl post;
 *     manba rejimi `review` bo'lsa — admin tasdig'ini kutadi.
 * Bir post bir marta ko'riladi (`vacancy_imports` noyob juftlik), bir xil matn boshqa kanaldan kelsa — takror deb tashlanadi.
 * Muallif — tizim hisobi `vakansiyalar@kasbegalari.internal` (`.internal` ro'yxatdan o'tib bo'lmaydigan domen).
 */

export const IMPORT_AUTHOR_EMAIL = "vakansiyalar@kasbegalari.internal";
/** Yangi manbaning standart kasblari — platformaning asosiy yo'nalishlari (admin har manbada o'zgartiradi) */
export const DEFAULT_IMPORT_PROFESSIONS: ProfessionSlug[] = ["video", "dizayn", "marketing", "kontent"];
/** Bir yugurishda kanal sahifasi kamida shuncha vaqtda bir marta o'qiladi */
const CHECK_INTERVAL_MS = 12 * 60_000;
/** Birinchi o'qishda faqat shuncha kunlik postlar (eski arxiv bir zumda saytni to'ldirmasin) */
const FIRST_RUN_DAYS = 3;
const MAX_POSTS_PER_SOURCE = 15;

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */
export function textHash(text: string): string {
  const norm = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return createHash("sha256").update(norm).digest("hex").slice(0, 40);
}

let authorCache: string | null = null;
async function importAuthorId(): Promise<string> {
  if (authorCache) return authorCache;
  const found = await db.query.users.findFirst({ where: eq(users.email, IMPORT_AUTHOR_EMAIL), columns: { id: true } });
  if (found) return (authorCache = found.id);
  const id = uid();
  const { hashPassword } = await import("@/lib/security/password");
  await db
    .insert(users)
    .values({
      id,
      name: "Kasb Egalari · Vakansiyalar",
      email: IMPORT_AUTHOR_EMAIL,
      emailVerified: false,
      role: "client",
      digestFreq: "off",
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
    })
    .onConflictDoNothing();
  const row = await db.query.users.findFirst({ where: eq(users.email, IMPORT_AUTHOR_EMAIL), columns: { id: true } });
  if (!row) throw new Error("import muallifi yaratilmadi");
  return (authorCache = row.id);
}

/* ------------------------------------------------------------------ */
/* Tasniflash (AI yoki kalit so'zlar)                                  */
/* ------------------------------------------------------------------ */
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

const VACANCY_RE = /vakans|вакан|ishga\s+(?:taklif|olamiz|olinadi|qabul)|xodim\s+(?:kerak|izla|qidir)|kerak\b|talab\s+qilinadi|izlayapmiz|qidiryapmiz|izlaymiz|требует|ищем|ищу\s+(?:монтаж|дизайн|smm)|в\s+команду|hiring|we\s+are\s+looking|#ish\b|#job/i;
const RESUME_RE = /#?rezyume|#?резюме|ish\s+(?:qidiryapman|izlayapman|kerak\s+edi)|ищу\s+работу|portfolio(?:m|im)\s|xizmat(?:imni|lar)\s+taklif|buyurtma\s+qabul\s+qilaman|kurs(?:ga)?\s+(?:yozil|qabul)|reklama\s+uchun/i;

export function classifyByKeywords(text: string): Classified {
  const profession = detectProfession(text);
  const format = detectFormat(text);
  const isResume = RESUME_RE.test(text);
  const isVacancy = !isResume && VACANCY_RE.test(text) && profession !== "boshqa";
  const region = format === "remote" ? null : detectRegion(text);
  const where = format === "remote" ? "masofaviy" : region ? (REGIONS.find((r) => r.slug === region)?.short ?? "") : "";
  return {
    isVacancy,
    reason: isResume ? "Rezyume yoki xizmat e'loni" : !VACANCY_RE.test(text) ? "Vakansiya belgisi yo'q" : profession === "boshqa" ? "Kasb aniqlanmadi" : "Kalit so'zlar bo'yicha",
    title: `${TITLES[profession]}${where ? ` (${where})` : ""}`.slice(0, VACANCY_TITLE_MAX),
    profession,
    format,
    employment: detectEmployment(text),
    experience: detectExperience(text),
    regionSlug: region,
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
Vakansiya bo'lsa, maydonlarni ajrat. Matnni QAYTA YOZMA. title — qisqa lavozim nomi o'zbekcha lotin yozuvida (masalan «Video montajchi», «Grafik dizayner», «SMM menejer»), postdagi lavozimga mos.
profession: ${PROFESSION_SLUGS.join(", ")} (video — montaj/videograf/motion/animatsiya; dizayn — grafik/UI/UX; marketing — SMM/target/reklama; kontent — kopirayter/tarjimon/ssenariy).
format: remote (masofaviy/onlayn) | hybrid | office (joyida). employment: full | part | project (frilans/loyiha) | internship. experience: none | junior (≤1 yil) | middle (1–3) | senior (3+).
company — postda ANIQ yozilgan kompaniya/studiya nomi, bo'lmasa "". O'ylab topma.
Javob — FAQAT JSON: {"is_vacancy":bool,"reason":"qisqa sabab","title","profession","format","employment","experience","company"}.`;

export async function classifyPost(text: string): Promise<Classified> {
  const base = classifyByKeywords(text);
  const raw = await geminiJson(SYSTEM, text.slice(0, 4000), { temperature: 0.1, timeoutMs: 15_000 });
  const p = raw ? aiSchema.safeParse(raw) : null;
  if (!p?.success) return base;
  const d = p.data;
  const region = d.format === "remote" ? null : detectRegion(text);
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

/* ------------------------------------------------------------------ */
/* Kanal sahifasini o'qish                                             */
/* ------------------------------------------------------------------ */
/** Sinov uchun soxta server: faqat loopback manzil qabul qilinadi (aks holda doim t.me) */
function channelBase(): string {
  const b = process.env.VACANCY_IMPORT_BASE?.trim();
  if (b && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(b)) return b;
  return "https://t.me";
}

export async function fetchChannel(username: string) {
  const r = await fetch(`${channelBase()}/s/${encodeURIComponent(username)}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; KasbEgalariBot/1.0; +https://kasbegalari.vercel.app)", "accept-language": "uz,ru;q=0.8,en;q=0.5" },
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  // Ochiq bo'lmagan / mavjud bo'lmagan kanal — t.me bosh sahifaga (302) yo'naltiradi
  if (r.status >= 300 && r.status < 400) throw new Error("Kanal ochiq emas yoki topilmadi");
  if (!r.ok) throw new Error(`t.me javobi ${r.status}`);
  const html = await r.text();
  if (!/tgme_channel_info|tgme_widget_message/.test(html)) throw new Error("Kanal ochiq emas yoki topilmadi");
  return parseChannelPage(html, username);
}

/* ------------------------------------------------------------------ */
/* Joylash                                                             */
/* ------------------------------------------------------------------ */
type SourceRow = typeof vacancySources.$inferSelect;

async function createImportedVacancy(src: Pick<SourceRow, "id" | "title" | "username">, post: { text: string; url: string }, c: Classified): Promise<string> {
  const now = new Date();
  const id = uid();
  await db.insert(vacancies).values({
    id,
    authorId: await importAuthorId(),
    title: c.title || TITLES[c.profession],
    company: c.company,
    profession: c.profession,
    description: post.text,
    requirements: "",
    format: c.format,
    employment: c.employment,
    experience: c.experience,
    salaryMin: c.salaryMin,
    salaryMax: c.salaryMax,
    regionSlug: c.regionSlug,
    skills: [],
    applyUrl: post.url,
    status: "open",
    expiresAt: new Date(now.getTime() + VACANCY_TTL_DAYS * 86_400_000),
    sourceId: src.id,
    sourceName: src.title || `@${src.username}`,
    sourceChannel: src.username,
    sourceUrl: post.url,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function processPost(src: SourceRow, post: ChannelPost): Promise<"published" | "pending" | "skipped" | "duplicate"> {
  const hash = textHash(post.text);
  const base = { id: uid(), sourceId: src.id, postId: post.id, textHash: hash, text: post.text.slice(0, 8000), postedAt: post.date ? new Date(post.date) : null };
  // Juda qisqa post — vakansiya bo'lishi dargumon (reklama/sticker izohi)
  if (post.text.replace(/\s+/g, "").length < 40) {
    await db.insert(vacancyImports).values({ ...base, status: "skipped", reason: "Juda qisqa matn" }).onConflictDoNothing();
    return "skipped";
  }
  const dup = await db.query.vacancyImports.findFirst({ where: and(eq(vacancyImports.textHash, hash), inArray(vacancyImports.status, ["published", "pending"])), columns: { id: true } });
  if (dup) {
    await db.insert(vacancyImports).values({ ...base, status: "duplicate", reason: "Bir xil e'lon avval olingan" }).onConflictDoNothing();
    return "duplicate";
  }
  const c = await classifyPost(post.text);
  const allowed = src.professions.length ? src.professions : PROFESSION_SLUGS.filter((p) => p !== "boshqa");
  const fits = c.isVacancy && allowed.includes(c.profession);
  const status = !fits ? "skipped" : src.mode === "auto" ? "published" : "pending";
  const reason = !c.isVacancy ? c.reason : !fits ? `Kasb mos emas (${c.profession})` : c.reason;
  // Avval qator band qilinadi (parallel yugurishda ikki marta joylanmasin), keyin vakansiya
  const ins = await db.insert(vacancyImports).values({ ...base, status, reason, parsed: c as unknown as Record<string, unknown> }).onConflictDoNothing();
  if (ins.rowsAffected === 0) return "skipped";
  if (status === "published") {
    const vid = await createImportedVacancy(src, post, c);
    await db.update(vacancyImports).set({ vacancyId: vid }).where(eq(vacancyImports.id, base.id));
  }
  return status;
}

export interface ImportRunResult {
  sources: number;
  checked: number;
  published: number;
  pending: number;
  skipped: number;
  errors: Array<{ channel: string; error: string }>;
}

/** Barcha yoqilgan manbalar (yoki bittasi). `force` — oraliqni kutmasdan */
export async function runVacancyImport(opts: { force?: boolean; sourceId?: string; budgetMs?: number } = {}): Promise<ImportRunResult> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 45_000;
  const res: ImportRunResult = { sources: 0, checked: 0, published: 0, pending: 0, skipped: 0, errors: [] };
  const due = new Date(Date.now() - CHECK_INTERVAL_MS);
  const rows = await db
    .select()
    .from(vacancySources)
    .where(
      and(
        eq(vacancySources.enabled, true),
        opts.sourceId ? eq(vacancySources.id, opts.sourceId) : undefined,
        opts.force ? undefined : or(isNull(vacancySources.lastCheckedAt), lt(vacancySources.lastCheckedAt, due)),
      ),
    )
    .orderBy(sql`coalesce(${vacancySources.lastCheckedAt}, 0)`);
  for (const src of rows) {
    if (Date.now() - started > budget) break;
    res.sources += 1;
    // Band qilish: boshqa parallel yugurish shu kanalni bir vaqtda o'qimasin
    const claim = await db
      .update(vacancySources)
      .set({ lastCheckedAt: new Date() })
      .where(and(eq(vacancySources.id, src.id), opts.force ? undefined : or(isNull(vacancySources.lastCheckedAt), lt(vacancySources.lastCheckedAt, due))));
    if (claim.rowsAffected === 0) continue;
    try {
      const page = await fetchChannel(src.username);
      // Kanal nomi birinchi o'qishdayoq vakansiyalarga «Manba» bo'lib yozilsin (@username emas)
      if (page.title && page.title !== src.username) src.title = page.title.slice(0, 120);
      const firstRunFrom = Date.now() - FIRST_RUN_DAYS * 86_400_000;
      const fresh = page.posts
        .filter((p) => (src.lastPostId == null ? !p.date || new Date(p.date).getTime() >= firstRunFrom : p.id > src.lastPostId))
        .slice(-MAX_POSTS_PER_SOURCE);
      let maxId = src.lastPostId ?? 0;
      let imported = 0;
      let skipped = 0;
      for (const post of fresh) {
        if (Date.now() - started > budget) break;
        const seen = await db.query.vacancyImports.findFirst({ where: and(eq(vacancyImports.sourceId, src.id), eq(vacancyImports.postId, post.id)), columns: { id: true } });
        if (!seen) {
          const st = await processPost(src, post);
          res.checked += 1;
          if (st === "published") (res.published += 1), (imported += 1);
          else if (st === "pending") (res.pending += 1), (imported += 1);
          else (res.skipped += 1), (skipped += 1);
        }
        maxId = Math.max(maxId, post.id);
      }
      // Birinchi o'qishda eski postlar ham «ko'rilgan» deb belgilanadi
      if (src.lastPostId == null) maxId = Math.max(maxId, ...page.posts.map((p) => p.id), 0);
      await db
        .update(vacancySources)
        .set({
          title: page.title.slice(0, 120) || src.title,
          lastPostId: maxId || src.lastPostId,
          lastError: null,
          importedCount: sql`${vacancySources.importedCount} + ${imported}`,
          skippedCount: sql`${vacancySources.skippedCount} + ${skipped}`,
        })
        .where(eq(vacancySources.id, src.id));
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      res.errors.push({ channel: src.username, error: msg });
      await db.update(vacancySources).set({ lastError: msg }).where(eq(vacancySources.id, src.id));
    }
  }
  return res;
}

/** Sahifalardan «yo'l-yo'lakay» ishga tushirish: oxirgi yugurishdan 15 daqiqa o'tgan bo'lsa (javobni kechiktirmaydi) */
export async function maybeRunVacancyImport(): Promise<void> {
  const { tryConsume } = await import("@/lib/security/rate-limit");
  if (!(await tryConsume("vacImportLazy", 15 * 60_000))) return;
  await runVacancyImport({ budgetMs: 8_000 }).catch((e) => console.error("[vac-import]", e));
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
export async function listSources() {
  const rows = await db.select().from(vacancySources).orderBy(desc(vacancySources.createdAt));
  const pending = await db
    .select({ sourceId: vacancyImports.sourceId, n: sql<number>`count(*)` })
    .from(vacancyImports)
    .where(eq(vacancyImports.status, "pending"))
    .groupBy(vacancyImports.sourceId);
  const pmap = new Map(pending.map((p) => [p.sourceId, Number(p.n)]));
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    title: r.title,
    enabled: r.enabled,
    mode: r.mode,
    professions: r.professions,
    lastCheckedAt: r.lastCheckedAt?.getTime() ?? null,
    lastError: r.lastError,
    importedCount: r.importedCount,
    skippedCount: r.skippedCount,
    pending: pmap.get(r.id) ?? 0,
  }));
}

export async function listImports(status: "pending" | "published" | "skipped" | "all", limit = 40) {
  const rows = await db
    .select({
      id: vacancyImports.id,
      status: vacancyImports.status,
      reason: vacancyImports.reason,
      text: vacancyImports.text,
      postId: vacancyImports.postId,
      postedAt: vacancyImports.postedAt,
      createdAt: vacancyImports.createdAt,
      vacancyId: vacancyImports.vacancyId,
      parsed: vacancyImports.parsed,
      username: vacancySources.username,
      title: vacancySources.title,
    })
    .from(vacancyImports)
    .innerJoin(vacancySources, eq(vacancySources.id, vacancyImports.sourceId))
    .where(status === "all" ? undefined : status === "skipped" ? inArray(vacancyImports.status, ["skipped", "duplicate", "rejected"]) : eq(vacancyImports.status, status))
    .orderBy(desc(vacancyImports.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    postedAt: r.postedAt?.getTime() ?? null,
    createdAt: r.createdAt.getTime(),
    url: `https://t.me/${r.username}/${r.postId}`,
    profession: (r.parsed as { profession?: string } | null)?.profession ?? null,
    jobTitle: (r.parsed as { title?: string } | null)?.title ?? null,
  }));
}

/** Matndan kanal(lar) qo'shish: har qator / vergul / probel — bitta kanal. Mavjudlari o'tkaziladi */
export async function addSources(raw: string, mode: "auto" | "review" = "review"): Promise<{ added: string[]; invalid: string[]; existing: string[] }> {
  const tokens = raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const added: string[] = [];
  const invalid: string[] = [];
  const existing: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens.slice(0, 100)) {
    const u = normalizeChannel(t);
    if (!u) {
      invalid.push(t.slice(0, 60));
      continue;
    }
    if (seen.has(u)) continue;
    seen.add(u);
    const ins = await db.insert(vacancySources).values({ id: uid(), username: u, mode, professions: DEFAULT_IMPORT_PROFESSIONS }).onConflictDoNothing();
    (ins.rowsAffected ? added : existing).push(u);
  }
  return { added, invalid, existing };
}

export async function updateSource(id: string, patch: { enabled?: boolean; mode?: "auto" | "review"; professions?: string[] }): Promise<void> {
  const set: Partial<typeof vacancySources.$inferInsert> = {};
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  if (patch.mode) set.mode = patch.mode;
  if (patch.professions) set.professions = patch.professions.filter((p) => (PROFESSION_SLUGS as readonly string[]).includes(p));
  if (!Object.keys(set).length) throw new ApiError(400, "Hech narsa o'zgarmadi");
  const r = await db.update(vacancySources).set(set).where(eq(vacancySources.id, id));
  if (r.rowsAffected === 0) throw new ApiError(404, "Manba topilmadi");
}

/** Manbani o'chirish; `removeVacancies` — undan olingan ochiq vakansiyalar ham yopiladi (kanal egasi so'raganda) */
export async function deleteSource(id: string, removeVacancies: boolean): Promise<{ closed: number }> {
  const src = await db.query.vacancySources.findFirst({ where: eq(vacancySources.id, id), columns: { id: true } });
  if (!src) throw new ApiError(404, "Manba topilmadi");
  let closed = 0;
  if (removeVacancies) {
    const r = await db.delete(vacancies).where(eq(vacancies.sourceId, id));
    closed = r.rowsAffected;
  }
  await db.delete(vacancySources).where(eq(vacancySources.id, id));
  return { closed };
}

/** Tasdiq kutayotgan importni joylash yoki rad etish */
export async function decideImport(id: string, action: "publish" | "reject"): Promise<{ vacancyId: string | null }> {
  const row = await db.query.vacancyImports.findFirst({ where: eq(vacancyImports.id, id) });
  if (!row) throw new ApiError(404, "Topilmadi");
  if (action === "reject") {
    const r = await db.update(vacancyImports).set({ status: "rejected", reason: "Admin rad etdi" }).where(and(eq(vacancyImports.id, id), inArray(vacancyImports.status, ["pending", "skipped"])));
    if (r.rowsAffected === 0) throw new ApiError(409, "Holat o'zgargan");
    return { vacancyId: null };
  }
  // Joylash: kutilayotgan yoki (AI xato rad etgan) o'tkazib yuborilgan postni ham qo'lda chiqarish mumkin
  const claim = await db.update(vacancyImports).set({ status: "published" }).where(and(eq(vacancyImports.id, id), inArray(vacancyImports.status, ["pending", "skipped", "rejected"])));
  if (claim.rowsAffected === 0) throw new ApiError(409, "Allaqachon joylangan");
  const src = await db.query.vacancySources.findFirst({ where: eq(vacancySources.id, row.sourceId) });
  if (!src) throw new ApiError(404, "Manba topilmadi");
  const parsed = (row.parsed as unknown as Classified | null) ?? classifyByKeywords(row.text);
  const fixed: Classified = { ...parsed, profession: parsed.profession === "boshqa" ? detectProfession(row.text) : parsed.profession };
  const vid = await createImportedVacancy(src, { text: row.text, url: `https://t.me/${src.username}/${row.postId}` }, fixed);
  await db.update(vacancyImports).set({ vacancyId: vid, reason: "Admin joyladi" }).where(eq(vacancyImports.id, id));
  await db.update(vacancySources).set({ importedCount: sql`${vacancySources.importedCount} + 1` }).where(eq(vacancySources.id, src.id));
  return { vacancyId: vid };
}

/** Eski import jurnalini tozalash (kunlik cron): 60 kundan eski o'tkazib yuborilganlar */
export async function purgeVacancyImports(now = Date.now()): Promise<number> {
  const r = await db
    .delete(vacancyImports)
    .where(and(inArray(vacancyImports.status, ["skipped", "duplicate", "rejected"]), lt(vacancyImports.createdAt, new Date(now - 60 * 86_400_000))));
  return r.rowsAffected;
}
