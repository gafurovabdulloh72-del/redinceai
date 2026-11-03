#!/usr/bin/env node
/**
 * Turso (prod) → lokal SQLite fayl: VPS'ga ko'chishda butun bazani bir martalik nusxalash.
 * Tashqi CLI (turso, sqlite3) SHART EMAS — faqat @libsql/client.
 *
 * Ishlatish (serverda, ilova TO'XTATILGAN holda):
 *   docker compose stop app
 *   docker compose run --rm \
 *     -e SRC_URL="libsql://<baza>.turso.io" -e SRC_TOKEN="<turso token>" \
 *     -e DEST=/data/redince.db app node scripts/turso-to-sqlite.mjs
 *   docker compose up -d app
 *
 * Qoidalar: DEST fayli mavjud bo'lsa — xavfsizlik uchun to'xtaydi (avval .bak qiling yoki FORCE=1).
 * Tartib: jadvallar (CREATE TABLE) → ma'lumot (200 tadan batch) → indekslar/triggerlar → yaxlitlik tekshiruvi.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const SRC_URL = process.env.SRC_URL || process.env.TURSO_DATABASE_URL;
const SRC_TOKEN = process.env.SRC_TOKEN || process.env.TURSO_AUTH_TOKEN;
const DEST = process.env.DEST || "/data/redince.db";

if (!SRC_URL) {
  console.error("✗ SRC_URL (Turso manzili libsql://…) berilmagan");
  process.exit(1);
}
if (fs.existsSync(DEST) && process.env.FORCE !== "1") {
  console.error(`✗ ${DEST} allaqachon bor. Avval zaxira qiling: mv ${DEST} ${DEST}.bak (yoki FORCE=1)`);
  process.exit(1);
}
if (fs.existsSync(DEST)) fs.rmSync(DEST);
fs.mkdirSync(path.dirname(DEST), { recursive: true });

const src = createClient({ url: SRC_URL, authToken: SRC_TOKEN });
const dst = createClient({ url: `file:${DEST}` });

const objs = (
  await src.execute("select type, name, tbl_name, sql from sqlite_master where sql is not null and name not like 'sqlite_%' and name not like '_litestream%' and name not like 'libsql_%' order by case type when 'table' then 0 when 'index' then 1 else 2 end, name")
).rows;
const tables = objs.filter((o) => o.type === "table");
const rest = objs.filter((o) => o.type !== "table");

await dst.execute("PRAGMA foreign_keys = OFF");
await dst.execute("PRAGMA journal_mode = WAL");

for (const t of tables) await dst.execute(String(t.sql));
console.log(`→ ${tables.length} ta jadval yaratildi`);

let total = 0;
for (const t of tables) {
  const name = String(t.name);
  const q = `"${name.replace(/"/g, '""')}"`;
  const [{ n }] = (await src.execute(`select count(*) as n from ${q}`)).rows;
  const count = Number(n);
  if (!count) continue;
  const cols = (await src.execute(`pragma table_info(${q})`)).rows.map((c) => String(c.name));
  const colList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
  const ph = cols.map(() => "?").join(", ");
  for (let off = 0; off < count; off += 200) {
    const rows = (await src.execute({ sql: `select ${colList} from ${q} limit 200 offset ?`, args: [off] })).rows;
    await dst.batch(
      rows.map((r) => ({ sql: `insert into ${q} (${colList}) values (${ph})`, args: cols.map((c) => r[c] ?? null) })),
      "write",
    );
  }
  total += count;
  console.log(`  ${name}: ${count}`);
}

for (const o of rest) {
  try {
    await dst.execute(String(o.sql));
  } catch (e) {
    console.warn(`  ⚠ ${o.type} ${o.name}: ${e instanceof Error ? e.message : e}`);
  }
}
await dst.execute("PRAGMA foreign_keys = ON");
const ic = (await dst.execute("pragma integrity_check")).rows[0];
console.log(`✓ ${total} qator ko'chirildi → ${DEST} (integrity: ${Object.values(ic)[0]})`);
