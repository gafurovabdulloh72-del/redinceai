#!/usr/bin/env node
/**
 * Deploy oldidan bazani tayyorlash (Vercel build / Railway start):
 *  1) file: URL bo'lsa papkani yaratadi
 *  2) drizzle-kit push — sxemani sinxronlaydi
 *  3) jadval haqiqatan yaratilganini tekshiradi (drizzle-kit ba'zan xatoda ham 0 qaytaradi)
 *  4) baza bo'sh bo'lsa seed (SEED_ON_START=0 bo'lsa o'tkazib yuboradi)
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

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
execSync("npx drizzle-kit push --force", { stdio: "inherit", env: process.env });

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
