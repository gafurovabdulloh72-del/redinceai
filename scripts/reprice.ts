/**
 * Bir martalik (idempotent) narx tuzatish: «dan» narxi PRICE_MIN (200 000 so'm) dan past yoki bo'sh bo'lgan mutaxassislarga
 * bozor tahlili asosida (kasb × tajriba × hudud × sharh/buyurtma ko'rsatkichlari) alohida narx belgilanadi.
 * PRICE_MIN va undan yuqori narxlar TEGILMAYDI. Har deployda db-prepare chaqiradi; ikkinchi marta hech narsa o'zgartirmaydi.
 */
import { createClient } from "@libsql/client";
import { PRICE_MIN, suggestPrice } from "../src/lib/pricing";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
const client = createClient({ url, authToken });

async function main() {
const res = await client.execute({
  sql: `select id, slug, category, experience, region_slug, rating, review_count, completed_count, top_rated, is_verified, price_from, price_to
        from specialists where coalesce(price_from, 0) < ? and coalesce(price_currency, 'UZS') = 'UZS'`,
  args: [PRICE_MIN],
});

let n = 0;
for (const r of res.rows) {
  const { from, to } = suggestPrice({
    category: String(r.category),
    experience: String(r.experience ?? "middle"),
    regionSlug: String(r.region_slug ?? ""),
    rating: Number(r.rating ?? 0),
    reviewCount: Number(r.review_count ?? 0),
    completedCount: Number(r.completed_count ?? 0),
    topRated: Boolean(r.top_rated),
    isVerified: Boolean(r.is_verified),
  });
  await client.execute({ sql: "update specialists set price_from = ?, price_to = ?, updated_at = ? where id = ?", args: [from, to, Date.now(), String(r.id)] });
  n++;
  console.log(`  · ${String(r.slug).padEnd(28)} ${String(r.category).padEnd(18)} ${String(r.experience).padEnd(7)} ${Number(r.price_from ?? 0)} → ${from} – ${to}`);
}
console.log(n ? `✓ ${n} ta mutaxassisga minimal narx (${PRICE_MIN}) asosida alohida narx belgilandi` : `✓ Narxlar joyida (barchasi ${PRICE_MIN} so'mdan yuqori)`);
}

main().catch((e) => {
  console.error("reprice xatosi:", e);
  process.exit(1);
});
