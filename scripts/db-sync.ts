/**
 * Xavfsiz sxema sinxronizatsiyasi (deploy paytida `drizzle-kit push --force` o'rniga).
 *
 * Nega: drizzle-kit 0.31 SQLite/Turso'da `DEFAULT 0` yoki `DEFAULT false` bilan NOT NULL ustun qo'shilganda
 * standart qiymatni "yo'q" deb hisoblab, oldidan `delete from <jadval>` qo'yadi va `--force` bilan uni so'roqsiz
 * bajaradi. 4-raund deployida production'da `users` va `specialists` shu tarzda tozalanib ketgan.
 *
 * Bu skript drizzle-kit'ning dasturiy API'si (pushSQLiteSchema) orqali kerakli SQL'ni oladi va:
 *  - `delete from …` (jadvalni tozalash) buyruqlarini HAR DOIM o'tkazib yuboradi;
 *  - `DROP TABLE x` ni faqat drizzle'ning jadvalni qayta qurish naqshi ichida (oldin `INSERT INTO __new_x … SELECT`)
 *    ruxsat beradi — aks holda to'xtaydi (ALLOW_DATA_LOSS=1 bilan majburlash mumkin);
 *  - `DROP INDEX` / ustun o'chirish kabi boshqa yo'qotishli buyruqlarni ham ALLOW_DATA_LOSS=1 siz bajarmaydi.
 * Natija: sxemaga faqat qo'shimcha (additive) o'zgarishlar kiritiladi, mavjud ma'lumotlar saqlanadi.
 *
 * Ishga tushirish: npx tsx scripts/db-sync.ts   (DATABASE_URL / TURSO_DATABASE_URL + token env'dan)
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pushSQLiteSchema } from "drizzle-kit/api";
import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
const allowDataLoss = process.env.ALLOW_DATA_LOSS === "1";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const tableOf = (s: string, re: RegExp) => re.exec(s)?.[1]?.replace(/[`"']/g, "") ?? null;

async function main() {
  const client = createClient({ url, authToken });
  const db = drizzle(client);
  const { statementsToExecute, warnings } = await pushSQLiteSchema(schema as Record<string, unknown>, db);

  if (statementsToExecute.length === 0) {
    console.log("✓ Sxema allaqachon mos — o'zgarish yo'q");
    return;
  }
  for (const w of warnings) console.log(`  ! drizzle ogohlantirishi: ${norm(w)}`);

  // MASOFAVIY (Turso) baza uchun qo'shimcha himoya: jadvalni qayta qurish naqshlari (DROP TABLE,
  // __old_push, PRAGMA foreign_keys) tarmoq uzilsa jadvalni yarim holatda qoldirishi mumkin.
  // Lokal file: bazada xavfsiz (bitta jarayon), shuning uchun faqat masofaviyda to'xtatiladi.
  const isRemote = !url.startsWith("file:");
  if (isRemote && process.env.DB_SYNC_ALLOW_REBUILD !== "1") {
    const risky = statementsToExecute.filter((s) => /DROP TABLE|__old_push|PRAGMA foreign_keys/i.test(s));
    if (risky.length) {
      console.error("✗ Masofaviy bazada jadvalni qayta qurish buyruqlari aniqlandi — sinxronizatsiya to'xtatildi:");
      for (const s of risky) console.error(`    ${norm(s)}`);
      console.error("  Bunday o'zgarish masofaviy (Turso) bazada ma'lumot yo'qotishi yoki jadvalni yarim holatda qoldirishi mumkin.");
      console.error("  Agar bu ataylab bo'lsa, DB_SYNC_ALLOW_REBUILD=1 bilan qayta ishga tushiring yoki migratsiyani qo'lda bajaring.");
      process.exit(1);
    }
  }

  const rebuilt = new Set<string>();
  const plan: string[] = [];
  const blocked: string[] = [];

  for (const raw of statementsToExecute) {
    const s = norm(raw);
    const insertNew = tableOf(s, /^insert into [`"']?__new_([\w]+)[`"']?/i);
    if (insertNew) rebuilt.add(insertNew);

    if (/^delete from /i.test(s)) {
      console.log(`  ↷ o'tkazib yuborildi (ma'lumotni o'chiradi): ${s}`);
      continue;
    }
    const dropped = tableOf(s, /^drop table (?:if exists )?[`"']?([\w]+)[`"']?/i);
    if (dropped && !dropped.startsWith("__new_") && !rebuilt.has(dropped)) {
      blocked.push(s);
      continue;
    }
    if (/^alter table .+ drop column /i.test(s) || /^drop index /i.test(s)) {
      // indeks/ustun o'chirish — faqat aniq ruxsat bilan
      if (!allowDataLoss) {
        blocked.push(s);
        continue;
      }
    }
    plan.push(raw);
  }

  if (blocked.length && !allowDataLoss) {
    console.error("✗ Quyidagi buyruqlar ma'lumot yo'qotishi mumkin, shuning uchun deploy to'xtatildi:");
    for (const b of blocked) console.error(`    ${b}`);
    console.error("  Agar bu ataylab bo'lsa (masalan, ustun nomi o'zgargan), ALLOW_DATA_LOSS=1 bilan qayta ishga tushiring yoki migratsiyani qo'lda bajaring.");
    process.exit(1);
  }
  if (blocked.length) plan.push(...blocked);

  console.log(`→ ${plan.length} ta sxema o'zgarishi qo'llanmoqda`);
  for (const stmt of plan) {
    console.log(`  · ${norm(stmt).slice(0, 160)}`);
    await client.execute(stmt);
  }
  console.log("✓ Sxema sinxronlandi (mavjud ma'lumotlar saqlandi)");
}

main().catch((e) => {
  console.error("✗ Sxema sinxronizatsiyasi xatosi:", e instanceof Error ? e.message : e);
  process.exit(1);
});
