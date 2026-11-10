/**
 * `users.signup_via` ni bir martalik to'ldirish (7-audit, 2026-11-10) — deploy'da db-prepare chaqiradi, idempotent.
 *
 * Qoida (faqat signup_via bo'sh qatorlar):
 *   google_id bor                                  → "google"   (Google orqali ochilgan yoki bog'langan — parol egasi isbotlangan)
 *   email `tg<raqam>@telegram.local` VA audit jurnalida shu hisobning "register" yozuvi YO'Q → "telegram"
 *       (sayt formasi har ro'yxatdan o'tishni audit'ga yozadi, bot/Mini App yozmaydi — demak bu hisobni Telegram ochgan);
 *   qolganlari                                     → "site".
 * Sayt formasidan `@telegram.local` bilan ochilgan qator "site" bo'lib qoladi va Telegram'dan qayta bog'lanmaydi.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createClient } = await import("@libsql/client");
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:./data/redince.db";
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const g = await client.execute("update users set signup_via = 'google' where signup_via is null and google_id is not null");
  const t = await client.execute(
    "update users set signup_via = 'telegram' where signup_via is null and email like 'tg%@telegram.local' and id not in (select actor_id from audit_logs where action = 'register' and actor_id is not null)",
  );
  const s = await client.execute("update users set signup_via = 'site' where signup_via is null");
  const n = g.rowsAffected + t.rowsAffected + s.rowsAffected;
  console.log(n > 0 ? `✓ signup_via to'ldirildi: google ${g.rowsAffected}, telegram ${t.rowsAffected}, sayt ${s.rowsAffected}` : "✓ signup_via joyida");
  const squat = await client.execute("select count(*) as n from users where signup_via = 'site' and email like '%@telegram.local'");
  const k = Number(squat.rows[0]?.n ?? 0);
  if (k > 0) console.warn(`⚠ ${k} ta hisob sayt formasidan @telegram.local emaili bilan ochilgan — admin panelda tekshiring (hisobni oldindan egallash urinishi bo'lishi mumkin)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("✗ signup_via backfill xatosi:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
