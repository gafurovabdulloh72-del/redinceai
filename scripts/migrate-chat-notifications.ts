/**
 * Bir martalik (idempotent): chat/buyurtma-chat bildirishnomalari endi saytga yozilmaydi (2026-10-31) —
 * avval yozilgan o'qilmaganlarini o'qilgan deb belgilaymiz, aks holda qo'ng'iroqcha «1» bo'lib qolaveradi.
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL || "file:./data/redince.db";
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const r = await client.execute({ sql: "update notifications set read_at = ? where type in ('chat','message_new') and read_at is null", args: [Date.now()] });
  console.log(`✓ chat bildirishnomalari: ${r.rowsAffected} ta o'qilgan deb belgilandi`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
