/**
 * Bir martalik (idempotent) kontakt shifrlash (4-audit, 2026-11-03): users.phone, specialists.telegram/instagram
 * ustunlaridagi OCHIQ matn qiymatlar `fe1:` shifrmatnga o'tkaziladi. Allaqachon shifrlanganlar tegilmaydi.
 * Har deployda db-prepare chaqiradi (SEAL_CONTACTS=0 — o'tkazib yuboradi). Kalit: DATA_ENCRYPTION_KEY yoki AUTH_SECRET.
 *
 * Favqulodda qaytarish (kalitni almashtirishdan OLDIN):  npx tsx scripts/seal-contacts.ts --unseal
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";

// Lokalda .env yuklanadi (kalit server bilan BIR XIL bo'lishi shart — aks holda server shifrni ocholmaydi)
loadEnvConfig(process.cwd());
import { isSealedField, openField, sealField } from "../src/lib/security/field-crypto";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
const client = createClient({ url, authToken });
const unseal = process.argv.includes("--unseal");

const TARGETS: Array<[table: string, col: string]> = [
  ["users", "phone"],
  ["specialists", "telegram"],
  ["specialists", "instagram"],
];

async function main() {
  let total = 0;
  for (const [table, col] of TARGETS) {
    const rows = (await client.execute(`select id, "${col}" as v from "${table}" where "${col}" is not null and "${col}" <> ''`)).rows;
    const batch: { sql: string; args: (string | number)[] }[] = [];
    for (const r of rows) {
      const v = String(r.v);
      if (unseal) {
        if (!isSealedField(v)) continue;
        const open = openField(v);
        if (open === null) {
          console.warn(`  ⚠ ${table}.${col} ${r.id}: kalit mos emas — o'tkazib yuborildi`);
          continue;
        }
        batch.push({ sql: `update "${table}" set "${col}" = ? where id = ?`, args: [open, String(r.id)] });
      } else {
        if (isSealedField(v)) continue;
        batch.push({ sql: `update "${table}" set "${col}" = ? where id = ?`, args: [sealField(v)!, String(r.id)] });
      }
    }
    for (let i = 0; i < batch.length; i += 100) await client.batch(batch.slice(i, i + 100), "write");
    total += batch.length;
    if (batch.length) console.log(`  ${table}.${col}: ${batch.length} ta ${unseal ? "ochildi" : "shifrlandi"}`);
  }
  console.log(total ? `✓ seal-contacts: ${total} ta qiymat ${unseal ? "ochildi" : "shifrlandi"}` : "✓ seal-contacts: o'zgarish yo'q");
}

main().catch((e) => {
  console.error("✗ seal-contacts:", e instanceof Error ? e.message : e);
  process.exit(1);
});
