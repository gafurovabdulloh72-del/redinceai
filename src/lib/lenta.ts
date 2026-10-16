import "server-only";
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { portfolioItems, specialists, users } from "./db/schema";
import { getSettings } from "./payments/settings";
import { listableCondition } from "./subscriptions/access";
import { effectivePriceFrom } from "./privacy";

/**
 * Ishlar lentasi (/lenta): mutaxassislarning video-ishlaridan Reels-uslubidagi tasma.
 *
 * queries.ts'dagi "listable" qoidasi shu yerda ham amal qiladi (bloklanmagan + admin
 * yashirmagan + obunasi faol — subscriptions/access.listableCondition), lekin queries.ts'ga
 * tegilmagan: users jadvali baribir join qilinadi, shuning uchun isBanned to'g'ridan-to'g'ri
 * shart sifatida yoziladi.
 *
 * DTO ataylab minimal: kontaktlar (telefon/email/telegram...), visibility, ish vaqti va
 * boshqa shaxsiy maydonlar bu yerga umuman chiqmaydi (privacy.ts toListItem bilan hamohang).
 */

/** <video> tegida to'g'ridan-to'g'ri o'ynaydigan fayllar — YouTube/Vimeo havolalari lentaga kirmaydi */
const PLAYABLE_EXT = [".mp4", ".webm", ".m4v", ".mov"] as const;

export interface LentaItem {
  id: string;
  videoUrl: string;
  posterUrl: string | null;
  title: string | null;
  specialist: {
    /** Buyurtma havolasi uchun (/buyurtma/{id}) — profil sahifadagi CTA bilan bir xil manzil */
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    category: string;
    regionSlug: string;
    rating: number;
    reviewCount: number;
    /** "… so'mdan" — priceFrom bo'sh bo'lsa eng arzon paket narxi (privacy.effectivePriceFrom) */
    priceFrom: number;
    isVerified: boolean;
  };
}

export interface LentaPage {
  items: LentaItem[];
  /** Keyingi sahifa kursori; null — lenta tugadi */
  nextCursor: string | null;
}

/** Kursor: (verified desc, createdAt desc, id desc) tartibidagi oxirgi element */
interface LentaCursor {
  v: 0 | 1;
  t: number;
  id: string;
}

function encodeCursor(c: LentaCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeCursor(raw: string | null | undefined): LentaCursor | null {
  if (!raw || raw.length > 200) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const { v, t, id } = parsed as Record<string, unknown>;
    if ((v !== 0 && v !== 1) || typeof t !== "number" || !Number.isFinite(t) || typeof id !== "string" || !id) return null;
    return { v, t, id };
  } catch {
    return null;
  }
}

/**
 * Lentadagi video ishlar: eng yangi birinchi, tasdiqlangan (verified) profillar ustun.
 * Oddiy kursor sahifalash — noto'g'ri kursor e'tiborsiz (birinchi sahifa qaytadi).
 */
export async function getLentaItems(limit = 8, cursor?: string | null): Promise<LentaPage> {
  const n = Math.min(24, Math.max(1, Math.floor(limit)));
  const c = decodeCursor(cursor);

  // SQLite'da boolean — integer; tartib va kursor taqqoslash uchun aniq 0/1 ifoda
  const vInt = sql<number>`case when ${specialists.isVerified} then 1 else 0 end`;

  const conds: SQL[] = [
    eq(portfolioItems.type, "video"),
    // Faqat bevosita o'ynaydigan fayllar (o'z origin / Vercel Blob) — sahifa YouTube'ni emas, <video>ni ishlatadi
    or(...PLAYABLE_EXT.map((ext) => sql`lower(${portfolioItems.url}) like ${`%${ext}%`}`))!,
    eq(users.isBanned, false),
    eq(specialists.isHidden, false),
    listableCondition(await getSettings()),
  ];
  if (c) {
    conds.push(
      or(
        sql`${vInt} < ${c.v}`,
        and(
          sql`${vInt} = ${c.v}`,
          or(sql`${portfolioItems.createdAt} < ${c.t}`, and(sql`${portfolioItems.createdAt} = ${c.t}`, sql`${portfolioItems.id} < ${c.id}`))!,
        )!,
      )!,
    );
  }

  const rows = await db
    .select({
      id: portfolioItems.id,
      url: portfolioItems.url,
      thumbnailUrl: portfolioItems.thumbnailUrl,
      title: portfolioItems.title,
      createdAt: portfolioItems.createdAt,
      spId: specialists.id,
      slug: specialists.slug,
      category: specialists.category,
      regionSlug: specialists.regionSlug,
      rating: specialists.rating,
      reviewCount: specialists.reviewCount,
      priceFrom: specialists.priceFrom,
      packages: specialists.packages,
      isVerified: specialists.isVerified,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(portfolioItems)
    .innerJoin(specialists, eq(portfolioItems.specialistId, specialists.id))
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(and(...conds))
    .orderBy(desc(vInt), desc(portfolioItems.createdAt), desc(portfolioItems.id))
    .limit(n + 1);

  const hasMore = rows.length > n;
  const page = hasMore ? rows.slice(0, n) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map((r) => ({
      id: r.id,
      videoUrl: r.url,
      posterUrl: r.thumbnailUrl,
      title: r.title || null,
      specialist: {
        id: r.spId,
        slug: r.slug,
        name: r.name,
        avatarUrl: r.avatarUrl,
        category: r.category,
        regionSlug: r.regionSlug,
        rating: r.rating,
        reviewCount: r.reviewCount,
        priceFrom: effectivePriceFrom({ priceFrom: r.priceFrom, packages: r.packages }),
        isVerified: r.isVerified,
      },
    })),
    nextCursor: hasMore && last ? encodeCursor({ v: last.isVerified ? 1 : 0, t: last.createdAt.getTime(), id: last.id }) : null,
  };
}
