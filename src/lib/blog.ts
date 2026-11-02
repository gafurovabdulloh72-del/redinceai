import "server-only";
import { z } from "zod";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, users, type Article } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { assertNotSpam } from "@/lib/security/spam-filter";
import { uid } from "@/lib/utils";

/**
 * Blog (kamchilik #48): SEO maqolalari. Yozish — faqat sayt adminlari (/admin/blog),
 * o'qish — hamma (/blog). Matn markdown-lite (ArticleBody komponenti chizadi), xom HTML yo'q.
 */

export const ARTICLE_TITLE_MAX = 160;
export const ARTICLE_EXCERPT_MAX = 300;
export const ARTICLE_BODY_MAX = 40_000;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Admin API kiritmasi (route'larda ishlatiladi — route faylidan eksport qilib bo'lmaydi) */
export const articleInputSchema = z.object({
  slug: z.string().trim().min(3).max(80),
  title: z.string().trim().min(5).max(ARTICLE_TITLE_MAX),
  excerpt: z.string().trim().max(ARTICLE_EXCERPT_MAX).optional().default(""),
  body: z.string().trim().min(50).max(ARTICLE_BODY_MAX),
  coverUrl: z.string().trim().max(500).optional().default(""),
  isPublished: z.boolean().optional().default(false),
});

export interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  authorName: string | null;
  publishedAt: number | null;
  isPublished: boolean;
}

function toCard(a: Article & { authorName?: string | null }): ArticleCard {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    coverUrl: a.coverUrl,
    authorName: a.authorName ?? null,
    publishedAt: a.publishedAt?.getTime() ?? null,
    isPublished: a.isPublished,
  };
}

/** Ommaviy ro'yxat — faqat e'lon qilinganlar, yangisi birinchi */
export async function listArticles(limit = 50): Promise<ArticleCard[]> {
  const rows = await db
    .select({ a: articles, authorName: users.name })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(eq(articles.isPublished, true))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
  return rows.map((r) => toCard({ ...r.a, authorName: r.authorName }));
}

/** Admin ro'yxati — qoralamalar bilan */
export async function listAllArticles(): Promise<ArticleCard[]> {
  const rows = await db
    .select({ a: articles, authorName: users.name })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .orderBy(desc(articles.createdAt))
    .limit(200);
  return rows.map((r) => toCard({ ...r.a, authorName: r.authorName }));
}

export interface ArticleView extends ArticleCard {
  body: string;
  updatedAt: number;
}

/** Maqola sahifasi: e'lon qilingan (yoki admin ko'rayotgan qoralama) */
export async function getArticle(slug: string, includeDraft = false): Promise<ArticleView | null> {
  const row = await db
    .select({ a: articles, authorName: users.name })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(eq(articles.slug, slug))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return null;
  if (!row.a.isPublished && !includeDraft) return null;
  return { ...toCard({ ...row.a, authorName: row.authorName }), body: row.a.body, updatedAt: row.a.updatedAt.getTime() };
}

export interface ArticleInput {
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  coverUrl?: string | null;
  isPublished?: boolean;
}

function validate(input: ArticleInput): Required<Pick<ArticleInput, "slug" | "title" | "body">> & { excerpt: string; coverUrl: string | null; isPublished: boolean } {
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 80) throw new ApiError(422, "Manzil (slug) noto'g'ri", { slug: "3–80 belgi: kichik lotin harf, raqam, defis" });
  if (title.length < 5 || title.length > ARTICLE_TITLE_MAX) throw new ApiError(422, "Sarlavha 5–160 belgi", { title: "Sarlavha 5–160 belgi" });
  if (body.length < 50 || body.length > ARTICLE_BODY_MAX) throw new ApiError(422, "Matn kamida 50 belgi", { body: `Matn 50–${ARTICLE_BODY_MAX} belgi` });
  assertNotSpam(`${title}\n${body}`);
  return { slug, title, body, excerpt: (input.excerpt ?? "").trim().slice(0, ARTICLE_EXCERPT_MAX), coverUrl: input.coverUrl?.trim() || null, isPublished: Boolean(input.isPublished) };
}

export async function createArticle(authorId: string, input: ArticleInput): Promise<{ id: string; slug: string }> {
  const v = validate(input);
  const taken = await db.query.articles.findFirst({ where: eq(articles.slug, v.slug), columns: { id: true } });
  if (taken) throw new ApiError(409, "Bu manzil band", { slug: "Boshqa slug tanlang" });
  const id = uid();
  await db.insert(articles).values({ id, ...v, authorId, publishedAt: v.isPublished ? new Date() : null });
  return { id, slug: v.slug };
}

export async function updateArticle(id: string, input: ArticleInput): Promise<void> {
  const cur = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!cur) throw new ApiError(404, "Maqola topilmadi");
  const v = validate(input);
  const taken = await db.query.articles.findFirst({ where: and(eq(articles.slug, v.slug), ne(articles.id, id)), columns: { id: true } });
  if (taken) throw new ApiError(409, "Bu manzil band", { slug: "Boshqa slug tanlang" });
  await db
    .update(articles)
    .set({ ...v, updatedAt: new Date(), publishedAt: v.isPublished ? (cur.publishedAt ?? new Date()) : cur.publishedAt })
    .where(eq(articles.id, id));
}

/** Admin tahriri uchun: id bo'yicha to'liq maqola (body bilan) */
export async function getArticleById(id: string): Promise<ArticleView | null> {
  const row = await db.query.articles.findFirst({ where: eq(articles.id, id) });
  if (!row) return null;
  return { ...toCard(row), body: row.body, updatedAt: row.updatedAt.getTime() };
}

export async function deleteArticle(id: string): Promise<void> {
  await db.delete(articles).where(eq(articles.id, id));
}

/** Sitemap va RSS uchun e'lon qilinganlar */
export async function getSitemapArticles(): Promise<Array<{ slug: string; title: string; excerpt: string; publishedAt: Date; updatedAt: Date }>> {
  const rows = await db
    .select({ slug: articles.slug, title: articles.title, excerpt: articles.excerpt, publishedAt: articles.publishedAt, updatedAt: articles.updatedAt })
    .from(articles)
    .where(and(eq(articles.isPublished, true), sql`${articles.publishedAt} is not null`))
    .orderBy(desc(articles.publishedAt))
    .limit(500);
  return rows.map((r) => ({ ...r, publishedAt: r.publishedAt ?? r.updatedAt }));
}
