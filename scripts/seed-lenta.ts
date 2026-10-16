/**
 * Bir martalik demo skript: lentaga (/lenta) ko'rinadigan video portfolio itemlar qo'shadi.
 * Seed'dagi video itemlar YouTube havolalari (lentada o'ynamaydi) — bu skript public/demo/dagi
 * mp4 fayllarni mavjud seed mutaxassislariga (video yo'nalishlar, tasdiqlanganlar ustun) bog'laydi.
 *
 * Ishga tushirish: npx tsx scripts/seed-lenta.ts
 * Idempotent: /demo/lenta-* itemlar allaqachon bo'lsa hech narsa qo'shilmaydi.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";
import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client, { schema });

/** public/demo/ dagi fayllar (ffmpeg bilan yaratilgan: 720x1280, 4–5 s, <100KB) */
const DEMO_VIDEOS = [
  { file: "lenta-1", title: "To'y filmi — treyler" },
  { file: "lenta-2", title: "Reels montaj — namuna" },
  { file: "lenta-3", title: "Logo animatsiya" },
  { file: "lenta-4", title: "Korporativ video — intervyu" },
] as const;

/** Lentaga mos (ishi videoda sotiladigan) yo'nalishlar */
const VIDEO_CATEGORIES = ["videograf", "montajor", "motion-dizayner"];

const uid = () => `lenta-demo-${randomBytes(6).toString("base64url")}`;

async function main() {
  const [existing] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.portfolioItems)
    .where(like(schema.portfolioItems.url, "/demo/lenta-%"));
  if (Number(existing?.n ?? 0) > 0) {
    console.log(`→ Lentadagi demo videolar allaqachon mavjud (${existing.n} ta item) — hech narsa qo'shilmadi.`);
    return;
  }

  // Tasdiqlangan va reytingi yuqori video-mutaxassislar birinchi (bloklangan/yashirinlar chiqarilmaydi)
  const specialists = await db
    .select({ id: schema.specialists.id, slug: schema.specialists.slug, isVerified: schema.specialists.isVerified })
    .from(schema.specialists)
    .innerJoin(schema.users, eq(schema.users.id, schema.specialists.userId))
    .where(and(eq(schema.users.isBanned, false), eq(schema.specialists.isHidden, false), inArray(schema.specialists.category, VIDEO_CATEGORIES)))
    .orderBy(desc(schema.specialists.isVerified), desc(schema.specialists.rating))
    .limit(6);

  if (!specialists.length) {
    console.log("! Video yo'nalishdagi mutaxassis topilmadi — avval npm run db:seed ishga tushiring.");
    return;
  }

  const now = Date.now();
  let added = 0;
  for (const [i, sp] of specialists.entries()) {
    const v = DEMO_VIDEOS[i % DEMO_VIDEOS.length];
    await db.insert(schema.portfolioItems).values({
      id: uid(),
      specialistId: sp.id,
      title: v.title,
      type: "video",
      url: `/demo/${v.file}.mp4`,
      thumbnailUrl: `/demo/${v.file}.jpg`,
      description: "Demo video ish — lenta namunasi",
      // sortOrder katta: profil muqovasi (birinchi ishning thumbnail'i) o'zgarmasin
      sortOrder: 90 + i,
      createdAt: new Date(now - i * 3_600_000),
    });
    added++;
    console.log(`  + ${sp.slug}${sp.isVerified ? " (verified)" : ""} ← /demo/${v.file}.mp4`);
  }
  console.log(`✓ ${added} ta demo video portfolio item qo'shildi.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
