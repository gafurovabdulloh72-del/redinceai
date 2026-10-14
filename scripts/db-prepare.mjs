#!/usr/bin/env node
/**
 * Deploy oldidan bazani tayyorlash (Vercel build / Railway start):
 *  1) file: URL bo'lsa papkani yaratadi
 *  2) scripts/db-sync.ts — sxemani XAVFSIZ sinxronlaydi (faqat qo'shimcha o'zgarishlar; drizzle-kit'ning
 *     "delete from" jadval tozalash xatosi bloklanadi — 4-raund deployida users/specialists shu tufayli o'chgan)
 *  3) jadval haqiqatan yaratilganini tekshiradi (drizzle-kit ba'zan xatoda ham 0 qaytaradi)
 *  4) baza bo'sh bo'lsa seed (SEED_ON_START=0 bo'lsa o'tkazib yuboradi)
 *  5) ADMIN_PASSWORD berilgan bo'lsa — admin hisobini shu parol bilan tiklaydi/yaratadi (kirish yo'qolmasin)
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
process.env.DATABASE_URL = url;

// Vercel'da fayl bazasi ishlamaydi (read-only serverless) — aniq xabar bilan to'xtaymiz
if (process.env.VERCEL && url.startsWith("file:")) {
  const seen = Object.keys(process.env).filter((k) => /TURSO|DATABASE|LIBSQL/i.test(k));
  console.error(
    "✗ Vercel'da masofaviy baza kerak. DATABASE_URL yoki TURSO_DATABASE_URL topilmadi.\n" +
      "  Vercel → Storage → Turso ni loyihaga ulang (Connect) yoki env'larni qo'lda kiriting.\n" +
      `  Topilgan env nomlari: ${seen.length ? seen.join(", ") : "(yo'q)"}`,
  );
  process.exit(1);
}
if (url.startsWith("file:")) mkdirSync(path.dirname(url.slice(5)), { recursive: true });
if (process.env.UPLOAD_DIR) mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

console.log(`→ Baza: ${url.replace(/\/\/.*@/, "//***@")}`);
// MUHIM: "drizzle-kit push --force" ISHLATMANG — u DEFAULT 0/false ustunlarda jadvalni tozalab yuboradi
execSync("npx tsx scripts/db-sync.ts", { stdio: "inherit", env: process.env });

const client = createClient({ url, authToken });
const r = await client.execute("select name from sqlite_master where type='table' and name='users'");
if (r.rows.length === 0) {
  console.error("✗ Sxema yaratilmadi: 'users' jadvali topilmadi. DATABASE_URL / token'ni tekshiring.");
  process.exit(1);
}
console.log("✓ Sxema joyida");

if (process.env.SEED_ON_START !== "0") {
  execSync("npx tsx src/lib/db/seed.ts --if-empty", { stdio: "inherit", env: process.env });
}

// Chat taxalluslari: eski foydalanuvchilarga bir martalik to'ldirish (yangi ustun — additive)
execSync("npx tsx scripts/backfill-usernames.ts", { stdio: "inherit", env: process.env });

// Admin hisobini tiklash: ADMIN_PASSWORD (kuchli) berilgan bo'lsa admin paroli har deployda shunga moslanadi.
// Seed productionda ADMIN_PASSWORD'siz admin'ni tasodifiy parol bilan yaratadi — keyin env berib qayta deploy qilish kifoya.
const adminPassword = process.env.ADMIN_PASSWORD;
const adminEmail = (process.env.ADMIN_EMAIL || "admin@redince.uz").toLowerCase();
if (adminPassword && adminPassword !== "admin12345" && adminPassword.length >= 10) {
  const hash = await bcrypt.hash(adminPassword, 12);
  const found = await client.execute({ sql: "select id, password_hash from users where lower(email) = ? limit 1", args: [adminEmail] });
  const row = found.rows[0];
  if (row) {
    const same = await bcrypt.compare(adminPassword, String(row.password_hash ?? ""));
    if (!same) {
      await client.execute({
        sql: "update users set password_hash = ?, role = 'admin', is_banned = 0, session_version = coalesce(session_version, 1) + 1, password_changed_at = ? where id = ?",
        args: [hash, Date.now(), row.id],
      });
      console.log(`✓ Admin paroli ADMIN_PASSWORD bo'yicha yangilandi (${adminEmail})`);
    } else {
      console.log(`✓ Admin hisobi joyida (${adminEmail})`);
    }
  } else {
    await client.execute({
      sql: "insert into users (id, name, email, password_hash, role, email_verified, username, created_at) values (?, ?, ?, ?, 'admin', 1, ?, ?)",
      args: [randomUUID(), "Kasb Egalari Admin", adminEmail, hash, `boshqaruvchi-${Date.now().toString(36)}`, Date.now()],
    });
    console.log(`✓ Admin hisobi yaratildi (${adminEmail})`);
  }
} else if (process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT) {
  console.warn("! ADMIN_PASSWORD (kamida 10 belgi) berilmagan — admin paneliga kirish uchun Vercel env'da ADMIN_PASSWORD qo'shib qayta deploy qiling.");
}
