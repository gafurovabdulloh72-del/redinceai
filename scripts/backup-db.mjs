#!/usr/bin/env node
/**
 * Lokal SQLite bazaning kunlik zaxira nusxasi (VPS): `VACUUM INTO` — ilova ishlab turganda ham izchil nusxa.
 * Saqlanadi: BACKUP_DIR (standart /data/backups), oxirgi KEEP (standart 14) ta fayl, eskilari o'chiriladi.
 *
 * Serverda crontab (har kuni 02:30 UTC):
 *   30 2 * * * cd /opt/kasbegalari && docker compose exec -T app node scripts/backup-db.mjs >> /var/log/kasb-backup.log 2>&1
 * Tiklash: docker compose stop app && cp data/backups/redince-YYYY-MM-DD.db data/redince.db && docker compose up -d app
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL || "file:/data/redince.db";
if (!url.startsWith("file:")) {
  console.error("✗ Faqat lokal SQLite (file:) bazasi uchun — Turso o'z zaxirasiga ega");
  process.exit(1);
}
const dir = process.env.BACKUP_DIR || "/data/backups";
const keep = Math.max(1, Number(process.env.KEEP || 14));
fs.mkdirSync(dir, { recursive: true });

const day = new Date().toISOString().slice(0, 10);
const out = path.join(dir, `redince-${day}.db`);
if (fs.existsSync(out)) fs.rmSync(out);

const db = createClient({ url });
await db.execute({ sql: "VACUUM INTO ?", args: [out] });
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);

const files = fs
  .readdirSync(dir)
  .filter((f) => /^redince-\d{4}-\d{2}-\d{2}\.db$/.test(f))
  .sort()
  .reverse();
for (const f of files.slice(keep)) fs.rmSync(path.join(dir, f));
console.log(`✓ ${out} (${mb} MB), saqlangan: ${Math.min(files.length, keep)} ta`);
