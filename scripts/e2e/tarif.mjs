/**
 * TARIF ALMASHTIRISH va PUL QAYTARISH (7-audit, 2026-11-10) — `ADMIN_PASSWORD=… node scripts/e2e/tarif.mjs`.
 * Tekshiradi: Pro muddati qolgan mutaxassis 1 oylik Max olsa — qolgan vaqt narx nisbatida qayta hisoblanadi (butun muddat
 * Max bo'lib ketmaydi); to'lov qaytarilsa — muddat va tarif AVVALGI holatga qaytadi. Sinov demo mutaxassisda, yakunda tiklanadi.
 */
import { cookies, makeReq, ok, finish, db } from "./_lib.mjs";

const C = await cookies();
if (!C.ad) {
  console.log("⚠ admin sessiyasi yo'q (ADMIN_PASSWORD) — sinov o'tkazib yuborildi");
  process.exit(0);
}
const req = makeReq(C);
const DAY = 86_400_000;
const sp = (await db.execute("select s.id, s.subscription_until as until, s.subscription_tier as tier from specialists s join users u on u.id = s.user_id where u.email = 'mutaxassis@redince.uz'")).rows[0];
const cardRow = (await db.execute("select value from platform_settings where key = 'platformCard'")).rows[0];
const priceOf = async (key, def) => Number((await db.execute({ sql: "select value from platform_settings where key = ?", args: [key] })).rows[0]?.value ?? def);
const pro = await priceOf("subscriptionPrice", 49000);
const max = await priceOf("subscriptionPriceMax", 79000);
let invoiceId = null;
try {
  const start = Date.now();
  const until0 = start + 300 * DAY;
  await db.execute({ sql: "update specialists set subscription_until = ?, subscription_tier = 'pro' where id = ?", args: [until0, sp.id] });
  if (!cardRow) await db.execute({ sql: "insert into platform_settings (key, value) values ('platformCard', ?)", args: [JSON.stringify("8600 0000 0000 0000")] });
  await db.execute("delete from rate_limits where key like 'subscription%' or key like 'adminSubscription%'");

  const co = await req("sp", "/api/subscription/checkout", { method: "POST", body: JSON.stringify({ months: 1, provider: "manual", tier: "max" }) });
  const cj = await co.json();
  ok(co.ok && cj.ok, "Max (1 oy) hisobi ochildi", `${co.status} ${cj.error ?? ""}`);
  invoiceId = cj.data?.invoiceId ?? null;
  ok(Boolean(invoiceId), "hisob id olindi", JSON.stringify(Object.keys(cj.data ?? {})));

  const pay = await req("ad", `/api/admin/subscriptions/${sp.id}`, { method: "PATCH", body: JSON.stringify({ action: "confirm", invoiceId, note: "e2e tarif sinovi" }) });
  ok(pay.ok, "admin o'tkazmani tasdiqladi", String(pay.status));
  const a = (await db.execute({ sql: "select subscription_until as until, subscription_tier as tier from specialists where id = ?", args: [sp.id] })).rows[0];
  const now = Date.now();
  const converted = (until0 - now) * (pro / max);
  const days = (Number(a.until) - now) / DAY;
  const expected = converted / DAY + 30.4;
  ok(a.tier === "max", "tarif Max bo'ldi", String(a.tier));
  ok(Math.abs(days - expected) < 3, "qolgan Pro vaqti narx nisbatida qayta hisoblandi", `${days.toFixed(1)} kun, kutilgan ≈ ${expected.toFixed(1)} (eski mantiq: ${(300 + 30.4).toFixed(0)} kun Max)`);
  ok(days < 300, "butun Pro muddati Max'ga aylanib ketmadi", `${days.toFixed(1)} < 300`);

  const rf = await req("ad", `/api/admin/subscriptions/${sp.id}`, { method: "PATCH", body: JSON.stringify({ action: "refund", invoiceId, note: "e2e tarif sinovi — qaytarish" }) });
  ok(rf.ok, "admin to'lovni qaytardi", String(rf.status));
  const b = (await db.execute({ sql: "select subscription_until as until, subscription_tier as tier from specialists where id = ?", args: [sp.id] })).rows[0];
  ok(b.tier === "pro", "qaytarilgach tarif yana Pro", String(b.tier));
  ok(Math.abs(Number(b.until) - until0) < DAY, "qaytarilgach muddat avvalgi holatga qaytdi", `${((Number(b.until) - Date.now()) / DAY).toFixed(1)} kun`);
} finally {
  await db.execute({ sql: "update specialists set subscription_until = ?, subscription_tier = ? where id = ?", args: [sp.until ?? null, sp.tier ?? "pro", sp.id] });
  if (invoiceId) await db.execute({ sql: "delete from subscription_invoices where id = ?", args: [invoiceId] });
  await db.execute({ sql: "delete from subscription_invoices where specialist_id = ? and state in ('created','pending') and json_extract(meta, '$.tier') = 'max' and created_at > ?", args: [sp.id, Date.now() - 10 * 60_000] });
  if (!cardRow) await db.execute("delete from platform_settings where key = 'platformCard'");
}
finish();
