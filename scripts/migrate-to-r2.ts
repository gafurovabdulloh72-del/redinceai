/**
 * Mavjud fayllarni Cloudflare R2'ga ko'chirish — bir martalik migratsiya skripti.
 *
 * Manbalar:
 *  1) Vercel Blob (BLOB_READ_WRITE_TOKEN bo'lsa — list API orqali uploads/ prefiksi)
 *  2) Lokal disk: UPLOAD_DIR yoki public/uploads
 * Har fayl R2'da uploads/<nom> kaliti bilan saqlanadi, so'ng bazadagi eski URL'lar
 * (/uploads/<nom> va https://<store>.public.blob.vercel-storage.com/uploads/<nom>)
 * R2_PUBLIC_BASE/uploads/<nom> ko'rinishiga yangilanadi:
 *   users.avatar_url, specialists.cover_url,
 *   portfolio_items.url / thumbnail_url / before_url,
 *   reviews.media (string[]), orders/dm_messages/messages.attachments (FileAttachment[]).
 *
 * IDEMPOTENT: R2'da allaqachon bor fayl o'tkazib yuboriladi; yangilangan URL'lar eski
 * naqshga mos kelmagani uchun qayta ishga tushirilsa hech narsa o'zgarmaydi.
 *
 * Ishga tushirish (R2_* env'lar va DATABASE_URL to'ldirilgan bo'lishi kerak; .env/.env.local o'zi o'qiladi):
 *   npx tsx scripts/migrate-to-r2.ts --dry-run   # faqat reja: nima ko'chiriladi, nechta URL yangilanadi
 *   npx tsx scripts/migrate-to-r2.ts             # haqiqiy ko'chirish + bazani yangilash
 * VPS konteynerida: docker compose exec app npx tsx scripts/migrate-to-r2.ts --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, isNotNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { r2Config, r2Has, r2Put } from "../src/lib/storage/r2";

/* ---------- .env / .env.local (bor bo'lsa, mavjud env ustidan YOZMAYDI) ---------- */
function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const key = m[1];
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const NAME_RE = /^[\w-]+\.(?:jpe?g|png|webp|gif|pdf|docx?|mp4|webm|mov)$/i;
/** Eski URL → fayl nomi (faqat o'zimizning yuklamalar: lokal yo'l yoki Vercel Blob) */
const OLD_URL_RE = /^(?:\/uploads\/|https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/)([\w-]+\.(?:jpe?g|png|webp|gif|pdf|docx?|mp4|webm|mov))$/i;

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
const mimeOf = (name: string) => EXT_MIME[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

type Source = { kind: "disk"; filePath: string } | { kind: "blob"; url: string };

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  const dryRun = process.argv.includes("--dry-run");

  const cfg = r2Config();
  if (!cfg) {
    console.error("✗ R2 sozlanmagan: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE env'larini to'ldiring");
    process.exit(1);
  }
  console.log(`${dryRun ? "⊙ DRY-RUN (hech narsa yozilmaydi)" : "→ Migratsiya boshlandi"} — bucket: ${cfg.bucket}, ommaviy baza: ${cfg.publicBase}`);

  /* ---------- 1. Fayl manbalarini yig'ish ---------- */
  const sources = new Map<string, Source>(); // nom → manba (disk ustun: tarmoqsiz o'qiladi)

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list } = await import("@vercel/blob");
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "uploads/", cursor, limit: 1000 });
      for (const b of page.blobs) {
        const name = b.pathname.slice("uploads/".length);
        if (NAME_RE.test(name)) sources.set(name, { kind: "blob", url: b.url });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    console.log(`  · Vercel Blob'da topildi: ${sources.size} ta fayl`);
  } else {
    console.log("  · BLOB_READ_WRITE_TOKEN yo'q — Vercel Blob o'tkazib yuborildi (faqat lokal disk)");
  }

  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  if (existsSync(dir)) {
    let diskCount = 0;
    for (const name of await readdir(dir)) {
      if (!NAME_RE.test(name)) continue;
      sources.set(name, { kind: "disk", filePath: path.join(dir, name) }); // disk blob'dan ustun
      diskCount++;
    }
    console.log(`  · Lokal diskda (${dir}): ${diskCount} ta fayl`);
  }

  /* ---------- 2. R2'ga yuklash (idempotent: mavjudlari o'tkazib yuboriladi) ---------- */
  const available = new Set<string>(); // R2'da (yoki dry-run rejasida) mavjud nomlar
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const [name, src] of sources) {
    const key = `uploads/${name}`;
    if (await r2Has(key)) {
      available.add(name);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  ⊙ yuklanadi: ${key} (${src.kind})`);
      available.add(name);
      uploaded++;
      continue;
    }
    try {
      const bytes = src.kind === "disk" ? await readFile(src.filePath) : Buffer.from(await (await fetch(src.url)).arrayBuffer());
      await r2Put(key, bytes, mimeOf(name));
      available.add(name);
      uploaded++;
      console.log(`  ✓ yuklandi: ${key} (${src.kind}, ${bytes.length} bayt)`);
    } catch (e) {
      failed++;
      console.error(`  ✗ yuklanmadi: ${key} — ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`→ Fayllar: ${uploaded} ta ${dryRun ? "yuklanadi" : "yuklandi"}, ${skipped} ta allaqachon R2'da, ${failed} ta xato`);

  /* ---------- 3. Bazadagi URL'larni yangilash (faqat R2'da tasdiqlangan fayllar) ---------- */
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
  const db = drizzle(client, { schema });

  /** Eski URL'ni R2 URL'iga aylantiradi; mos kelmasa yoki fayl R2'da bo'lmasa null (URL o'zgarmaydi) */
  const toNew = (u: string | null | undefined): string | null => {
    if (!u) return null;
    const m = OLD_URL_RE.exec(u);
    if (!m || !available.has(m[1])) return null;
    return `${cfg.publicBase}/uploads/${m[1]}`;
  };

  let dbUpdates = 0;
  const log = (what: string, oldUrl: string, newUrl: string) => {
    dbUpdates++;
    if (dbUpdates <= 20) console.log(`  ${dryRun ? "⊙" : "✓"} ${what}: ${oldUrl} → ${newUrl}`);
  };

  // users.avatar_url
  for (const row of await db.select({ id: schema.users.id, avatarUrl: schema.users.avatarUrl }).from(schema.users).where(isNotNull(schema.users.avatarUrl))) {
    const next = toNew(row.avatarUrl);
    if (!next) continue;
    log("users.avatar_url", row.avatarUrl!, next);
    if (!dryRun) await db.update(schema.users).set({ avatarUrl: next }).where(eq(schema.users.id, row.id));
  }

  // specialists.cover_url
  for (const row of await db.select({ id: schema.specialists.id, coverUrl: schema.specialists.coverUrl }).from(schema.specialists).where(isNotNull(schema.specialists.coverUrl))) {
    const next = toNew(row.coverUrl);
    if (!next) continue;
    log("specialists.cover_url", row.coverUrl!, next);
    if (!dryRun) await db.update(schema.specialists).set({ coverUrl: next }).where(eq(schema.specialists.id, row.id));
  }

  // portfolio_items.url / thumbnail_url / before_url
  for (const row of await db
    .select({ id: schema.portfolioItems.id, url: schema.portfolioItems.url, thumbnailUrl: schema.portfolioItems.thumbnailUrl, beforeUrl: schema.portfolioItems.beforeUrl })
    .from(schema.portfolioItems)) {
    const patch: Partial<{ url: string; thumbnailUrl: string; beforeUrl: string }> = {};
    const nextUrl = toNew(row.url);
    const nextThumb = toNew(row.thumbnailUrl);
    const nextBefore = toNew(row.beforeUrl);
    if (nextUrl) (patch.url = nextUrl), log("portfolio.url", row.url, nextUrl);
    if (nextThumb) (patch.thumbnailUrl = nextThumb), log("portfolio.thumbnail_url", row.thumbnailUrl!, nextThumb);
    if (nextBefore) (patch.beforeUrl = nextBefore), log("portfolio.before_url", row.beforeUrl!, nextBefore);
    if (Object.keys(patch).length && !dryRun) await db.update(schema.portfolioItems).set(patch).where(eq(schema.portfolioItems.id, row.id));
  }

  // reviews.media (string[])
  for (const row of await db.select({ id: schema.reviews.id, media: schema.reviews.media }).from(schema.reviews)) {
    if (!row.media.length) continue;
    let changed = false;
    const media = row.media.map((u) => {
      const next = toNew(u);
      if (next) (changed = true), log("reviews.media", u, next);
      return next ?? u;
    });
    if (changed && !dryRun) await db.update(schema.reviews).set({ media }).where(eq(schema.reviews.id, row.id));
  }

  // attachments (FileAttachment[]) — orders, dm_messages, messages
  const attachmentTables = [
    { table: schema.orders, name: "orders" },
    { table: schema.dmMessages, name: "dm_messages" },
    { table: schema.messages, name: "messages" },
  ] as const;
  for (const { table, name } of attachmentTables) {
    for (const row of await db.select({ id: table.id, attachments: table.attachments }).from(table)) {
      if (!row.attachments.length) continue;
      let changed = false;
      const attachments = row.attachments.map((a) => {
        const next = toNew(a.url);
        if (!next) return a;
        changed = true;
        log(`${name}.attachments`, a.url, next);
        return { ...a, url: next };
      });
      if (changed && !dryRun) await db.update(table).set({ attachments }).where(eq(table.id, row.id));
    }
  }

  if (dbUpdates > 20) console.log(`  … va yana ${dbUpdates - 20} ta URL`);
  console.log(`→ Bazada ${dbUpdates} ta URL ${dryRun ? "yangilanadi (dry-run)" : "yangilandi"}`);
  if (failed) {
    console.error(`✗ ${failed} ta fayl yuklanmadi — skriptni qayta ishga tushiring (muvaffaqiyatlilari o'tkazib yuboriladi)`);
    process.exit(1);
  }
  console.log(dryRun ? "⊙ Dry-run tugadi — haqiqiy ko'chirish uchun --dry-run'siz ishga tushiring" : "✓ Migratsiya tugadi");
}

main().catch((e) => {
  console.error("✗ Migratsiya xatosi:", e instanceof Error ? e.message : e);
  process.exit(1);
});
