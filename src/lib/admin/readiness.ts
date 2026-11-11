import "server-only";
import { desc, eq, like, or, sql } from "drizzle-orm";
import { db, dbUrl } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { isGoogleConfigured } from "@/lib/auth/google";
import { isAutoTranslateConfigured } from "@/lib/i18n/gemini";
import { errorLogCounts } from "@/lib/observability/errors";
import { paymentsEnv } from "@/lib/payments/config";
import { readManualCard } from "@/lib/payments/settings";
import { isPushEnabled } from "@/lib/push/web-push";
import { LIVEKIT_WS_URL, isCallEnabled } from "@/lib/rtc/livekit";
import { adminTwoFactorRequired } from "@/lib/security/admin-2fa";
import { verifyPassword } from "@/lib/security/password";
import { trustedSiteOrigin } from "@/lib/security/request";
import { SITE_URL } from "@/lib/site-url";
import { isR2Enabled } from "@/lib/storage/r2";
import { isTelegramEnabled, telegramApi, telegramBotUsername } from "@/lib/telegram";
import { getSiteNotice } from "./site-notice";

/**
 * «ISHGA TUSHIRISHGA TAYYORLIK» (2026-11-10) — ommaviy ochilishdan oldingi tekshiruv ro'yxati.
 *
 * Har band: holat (ok | warn | fail), bir qatorli izoh va «qanday tuzatiladi» ko'rsatmasi.
 * QOIDA: env QIYMATI hech qachon qaytarilmaydi — faqat «o'rnatilgan / o'rnatilmagan / yaroqli» (kalit uzunligi, manzil,
 * token, karta raqami, email — hech biri javobga tushmaydi). Tashqi so'rov (Telegram) javob bermasa — ogohlantirish,
 * tekshiruv yiqilmaydi. Har band alohida try/catch ichida: biri yiqilsa qolganlari chiqaveradi.
 *
 * `fail` — ishga tushirishni to'xtatadigan muammo (parol tiklash ishlamaydi, to'lov test rejimida, admin standart
 * parolda…); `warn` — e'tibor kerak yoki ixtiyoriy imkoniyat sozlanmagan (`optional`). Dev muhitida productionga xos
 * talablar `warn` bo'lib ko'rinadi (lokalda SITE_URL/https bo'lmasligi tabiiy).
 */
export type ReadinessStatus = "ok" | "warn" | "fail";

export const READINESS_GROUPS = [
  { key: "asosiy", label: "Asosiy" },
  { key: "xavfsizlik", label: "Xavfsizlik" },
  { key: "tolov", label: "To'lov" },
  { key: "aloqa", label: "Aloqa" },
  { key: "media", label: "Media" },
  { key: "qoshimcha", label: "Qo'shimcha" },
] as const;
export type ReadinessGroup = (typeof READINESS_GROUPS)[number]["key"];

export interface ReadinessCheck {
  key: string;
  group: ReadinessGroup;
  status: ReadinessStatus;
  title: string;
  /** Bir qatorli holat (qiymatsiz) */
  detail: string;
  /** Qanday tuzatiladi — ok bo'lsa yo'q */
  fix?: string;
  /** Ixtiyoriy imkoniyat: sozlanmagani «muhim muammo» emas */
  optional?: boolean;
}

export interface ReadinessReport {
  ts: number;
  /** NODE_ENV=production */
  production: boolean;
  /** Muhit nomi (qiymatsiz tavsif): Vercel / Railway / o'z serveri / lokal */
  environment: string;
  checks: ReadinessCheck[];
  summary: { total: number; ok: number; warn: number; fail: number; percent: number };
}

/** Seed standart admin paroli — productionda shu parol bilan qolgan admin eng katta xavf */
const SEED_ADMIN_PASSWORD = "admin12345";
const HOUR = 60 * 60 * 1000;
const CRON_STALE_MS = 36 * HOUR;
const PLACEHOLDER_SECRET = /^(change-me|dev-only)/i;

const set = (name: string): boolean => Boolean(process.env[name]?.trim());

/** bcrypt (≈250 ms) natijasi 10 daqiqa keshlanadi: kalit — hisob + xesh (parol o'zgarsa kalit ham o'zgaradi) */
const g = globalThis as { __keSeedPwCache?: Map<string, { weak: boolean; at: number }> };
const seedPwCache = (g.__keSeedPwCache ??= new Map());
async function usesSeedPassword(id: string, hash: string): Promise<boolean> {
  const key = `${id}:${hash.slice(-24)}`;
  const hit = seedPwCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < 10 * 60 * 1000) return hit.weak;
  const weak = await verifyPassword(SEED_ADMIN_PASSWORD, hash);
  if (seedPwCache.size > 200) seedPwCache.clear();
  seedPwCache.set(key, { weak, at: now });
  return weak;
}

const timeout = <T,>(p: Promise<T>, ms: number): Promise<T | "timeout"> => Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);

function agoText(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} daqiqa oldin`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} soat oldin`;
  return `${Math.round(h / 24)} kun oldin`;
}

export async function launchReadiness(): Promise<ReadinessReport> {
  const now = Date.now();
  const prod = process.env.NODE_ENV === "production";
  const onVercel = Boolean(process.env.VERCEL);
  /** Productionda `fail`, lokalda `warn` (lokal muhitda bu tabiiy holat) */
  const hard: ReadinessStatus = prod ? "fail" : "warn";
  const checks: ReadinessCheck[] = [];
  const add = (c: ReadinessCheck) => checks.push(c);
  /** Band yiqilsa ham ro'yxat chiqadi */
  const guard = async (key: string, group: ReadinessGroup, title: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
    } catch (e) {
      console.error(`[tayyorlik] ${key}`, e instanceof Error ? e.message : e);
      add({ key, group, status: "warn", title, detail: "Tekshirib bo'lmadi — server jurnalini ko'ring", fix: "Sahifani yangilab qayta tekshiring; takrorlansa «Xatolar» bo'limiga qarang." });
    }
  };

  /* ------------------------------ Asosiy ------------------------------ */
  await guard("site_url", "asosiy", "Sayt manzili (SITE_URL)", () => {
    const title = "Sayt manzili (SITE_URL)";
    const explicit = set("SITE_URL") || set("NEXT_PUBLIC_SITE_URL");
    const origin = trustedSiteOrigin();
    let host = "";
    let https = false;
    try {
      const u = new URL(origin ?? SITE_URL);
      host = u.hostname;
      https = u.protocol === "https:";
    } catch {
      /* noto'g'ri manzil — pastda fail */
    }
    const local = !host || /^(localhost|0\.0\.0\.0|\[::1\])$|^127\.|\.local$|\.invalid$/i.test(host);
    if (!origin) add({ key: "site_url", group: "asosiy", status: hard, title, detail: "O'rnatilmagan — parol tiklash va tasdiqlash xatlari YUBORILMAYDI, sitemap/OG noto'g'ri manzil bilan chiqadi", fix: "Hosting sozlamalarida SITE_URL=https://<domeningiz> qo'ying va qayta deploy qiling (docs/DEPLOY.md)." });
    else if (local) add({ key: "site_url", group: "asosiy", status: hard, title, detail: "Lokal manzilga qarab turibdi (localhost) — tashqi havolalar ishlamaydi", fix: "SITE_URL ni haqiqiy domenga almashtiring: https://<domeningiz>." });
    else if (!https) add({ key: "site_url", group: "asosiy", status: hard, title, detail: "https emas — cookie, Telegram webhook va to'lov qaytish havolalari https talab qiladi", fix: "SITE_URL ni https:// bilan yozing va domenga SSL sertifikat ulang." });
    else if (!explicit) add({ key: "site_url", group: "asosiy", status: "warn", title, detail: "Aniq berilmagan — platforma bergan domen ishlatilmoqda", fix: "O'z domeningiz bo'lsa SITE_URL=https://<domeningiz> qo'ying (xatlardagi havolalar shu manzil bilan ketadi)." });
    else add({ key: "site_url", group: "asosiy", status: "ok", title, detail: "O'rnatilgan, https" });
  });

  await guard("auth_secret", "asosiy", "Sessiya kaliti (AUTH_SECRET)", () => {
    const title = "Sessiya kaliti (AUTH_SECRET)";
    const fix = "`openssl rand -base64 48` bilan kalit yarating va AUTH_SECRET ga qo'ying. DIQQAT: almashtirilsa barcha sessiyalar yopiladi, 2FA sirlari va (DATA_ENCRYPTION_KEY bo'lmasa) shifrlangan kontaktlar o'qilmay qoladi.";
    const s = process.env.AUTH_SECRET ?? "";
    const derived = (process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || "").length >= 16;
    if (!s) add({ key: "auth_secret", group: "asosiy", status: derived ? "warn" : hard, title, detail: derived ? "O'rnatilmagan — kalit baza tokenidan hosil qilinmoqda (token almashsa hamma sessiya bekor bo'ladi)" : "O'rnatilmagan — lokal sinov kaliti ishlatilmoqda", fix });
    else if (PLACEHOLDER_SECRET.test(s)) add({ key: "auth_secret", group: "asosiy", status: hard, title, detail: "Namunaviy (.env.example) qiymat — hammaga ma'lum kalit bilan sessiyani soxtalashtirish mumkin", fix });
    else if (s.length < 32) add({ key: "auth_secret", group: "asosiy", status: hard, title, detail: "Juda qisqa — productionda kamida 32 belgi talab qilinadi", fix });
    else if (new Set(s).size < 10) add({ key: "auth_secret", group: "asosiy", status: "warn", title, detail: "Uzunligi yetarli, lekin bir xil belgilar ko'p — tasodifiy emasga o'xshaydi", fix });
    else add({ key: "auth_secret", group: "asosiy", status: "ok", title, detail: "Kuchli (32+ belgi, namunaviy emas)" });
  });

  await guard("db", "asosiy", "Ma'lumotlar bazasi", async () => {
    const title = "Ma'lumotlar bazasi";
    const file = dbUrl().startsWith("file:");
    const backend = file ? "lokal SQLite fayl" : "Turso (libSQL)";
    const t0 = performance.now();
    let ok = true;
    try {
      await db.run(sql`select 1`);
    } catch {
      ok = false;
    }
    const ms = Math.round(performance.now() - t0);
    if (!ok) add({ key: "db", group: "asosiy", status: "fail", title, detail: `Javob bermadi (${backend})`, fix: "Baza manzili va tokenini (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN yoki DATABASE_URL) tekshiring." });
    else if (file && onVercel) add({ key: "db", group: "asosiy", status: "fail", title, detail: "Vercel'da lokal fayl — har deployda ma'lumot yo'qoladi", fix: "Turso baza ulang (Vercel Marketplace → Turso) — TURSO_DATABASE_URL va TURSO_AUTH_TOKEN avtomatik qo'yiladi." });
    else if (ms > 400) add({ key: "db", group: "asosiy", status: "warn", title, detail: `Ishlayapti (${backend}), lekin sekin — ${ms} ms`, fix: "Turso hududi serveringizga yaqin ekanini tekshiring." });
    else add({ key: "db", group: "asosiy", status: "ok", title, detail: `Ishlayapti — ${backend}, ${ms} ms${file && prod ? " · kunlik zaxira (scripts/backup-db.mjs) crontab'da borligini tekshiring" : ""}` });
  });

  await guard("cron_secret", "asosiy", "Cron siri (CRON_SECRET)", () => {
    const title = "Cron siri (CRON_SECRET)";
    const s = process.env.CRON_SECRET?.trim() ?? "";
    if (!s) add({ key: "cron_secret", group: "asosiy", status: hard, title, detail: "O'rnatilmagan — productionda kunlik fon vazifasi butunlay o'chiq (eskrou avto-o'tkazma, eslatmalar, tozalash ishlamaydi)", fix: "`openssl rand -hex 32` bilan sir yarating, CRON_SECRET ga qo'ying. Vercel Cron uni o'zi yuboradi; VPS'da crontab: curl -H \"Authorization: Bearer $CRON_SECRET\" <sayt>/api/cron/daily." });
    else if (s.length < 16) add({ key: "cron_secret", group: "asosiy", status: "warn", title, detail: "O'rnatilgan, lekin qisqa — taxmin qilish oson", fix: "`openssl rand -hex 32` bilan uzunroq sir qo'ying." });
    else add({ key: "cron_secret", group: "asosiy", status: "ok", title, detail: "O'rnatilgan" });
  });

  await guard("cron_run", "asosiy", "Kunlik cron oxirgi ishlashi", async () => {
    const title = "Kunlik cron oxirgi ishlashi";
    const fix = "Pastdagi «Cron holati» kartasida «Hozir ishga tushirish»ni bosing; Vercel'da Settings → Cron Jobs, VPS'da crontab qatorini tekshiring.";
    const last = await db.query.auditLogs.findFirst({ where: eq(auditLogs.action, "cron_daily"), orderBy: [desc(auditLogs.createdAt)], columns: { createdAt: true, meta: true } });
    if (!last) return void add({ key: "cron_run", group: "asosiy", status: "warn", title, detail: "Hali biror marta ishlamagan", fix });
    const age = now - last.createdAt.getTime();
    const errs = Array.isArray(last.meta?.errors) ? last.meta.errors.length : 0;
    if (age > CRON_STALE_MS) add({ key: "cron_run", group: "asosiy", status: "warn", title, detail: `Oxirgi marta ${agoText(age)} — 36 soatdan ko'p o'tdi, jadval ishlamayapti`, fix });
    else if (errs) add({ key: "cron_run", group: "asosiy", status: "warn", title, detail: `${agoText(age)} ishlagan, ${errs} ta qadam xato bilan tugagan`, fix: "«Cron holati» kartasida qaysi qadam yiqilganini ko'ring." });
    else add({ key: "cron_run", group: "asosiy", status: "ok", title, detail: `${agoText(age)} ishlagan, xatosiz` });
  });

  await guard("maintenance", "asosiy", "Texnik ishlar rejimi", async () => {
    const title = "Texnik ishlar rejimi";
    const { maintenance } = await getSiteNotice();
    if (maintenance.on) add({ key: "maintenance", group: "asosiy", status: "warn", title, detail: "YOQILGAN — foydalanuvchilar hozir hech narsa yoza olmaydi", fix: "Ish tugagach «Texnik ishlar rejimi» kartasida o'chiring." });
    else add({ key: "maintenance", group: "asosiy", status: "ok", title, detail: "O'chiq — sayt to'liq ishlayapti" });
  });

  await guard("errors", "asosiy", "Xatolar jurnali", async () => {
    const title = "Xatolar jurnali";
    const c = await errorLogCounts(now);
    // Faqat SERVER xatolari muammo sanaladi. Brauzer xatolari (kengaytmalar, eski brauzer, uzilgan tarmoq) asosan shovqin —
    // ular «Xatolar» bo'limida ko'rinadi, lekin bu ro'yxatni va tab belgisini qizartirmaydi.
    if (c.openServer > 0) add({ key: "errors", group: "asosiy", status: "warn", title, detail: `${c.openServer} ta ochiq server xatosi`, fix: "«Xatolar» bo'limida «Server» filtrini oching; tuzatilganini «Hal qilindi» deb belgilang." });
    else add({ key: "errors", group: "asosiy", status: "ok", title, detail: c.openClient ? `Server xatosi yo'q (${c.openClient} ta brauzer yozuvi — odatda kengaytma yoki eski brauzer shovqini)` : "Ochiq xato yo'q" });
  });

  /* ---------------------------- Xavfsizlik ---------------------------- */
  await guard("admin_accounts", "xavfsizlik", "Admin hisoblari", async () => {
    const admins = await db.query.users.findMany({ where: eq(users.role, "admin"), columns: { id: true, passwordHash: true, totpEnabled: true, isBanned: true }, limit: 25 });
    const active = admins.filter((a) => !a.isBanned);

    // Standart (seed) parol — eng xavfli holat
    const weak = (await Promise.all(active.slice(0, 10).map((a) => usesSeedPassword(a.id, a.passwordHash)))).filter(Boolean).length;
    if (weak) add({ key: "seed_password", group: "xavfsizlik", status: "fail", title: "Admin paroli", detail: `${weak} ta admin hali standart (seed) parol bilan — bu parol ochiq kodda yozilgan`, fix: "Shu admin bilan kirib Kabinet → Xavfsizlik'da parolni darhol almashtiring; hostingda ADMIN_PASSWORD ni ham yangilang." });
    else add({ key: "seed_password", group: "xavfsizlik", status: "ok", title: "Admin paroli", detail: `Standart parol ishlatilmayapti (${active.length} ta admin tekshirildi)` });

    const no2fa = active.filter((a) => !a.totpEnabled).length;
    if (no2fa) add({ key: "admin_2fa", group: "xavfsizlik", status: "warn", title: "Adminlarda 2FA", detail: `${no2fa} ta admin (jami ${active.length} tadan) ikki bosqichli himoyasiz`, fix: "Har bir admin Kabinet → Xavfsizlik'da 2FA'ni yoqsin (autentifikator ilovasi, 1 daqiqa)." });
    else add({ key: "admin_2fa", group: "xavfsizlik", status: "ok", title: "Adminlarda 2FA", detail: `Barcha adminlarda yoqilgan (${active.length} ta)` });

    if (adminTwoFactorRequired()) add({ key: "admin_2fa_env", group: "xavfsizlik", status: "ok", title: "Majburiy 2FA (ADMIN_REQUIRE_2FA)", detail: "Yoqilgan — 2FA'siz admin panel va admin bot yopiq" });
    else add({ key: "admin_2fa_env", group: "xavfsizlik", status: "warn", optional: true, title: "Majburiy 2FA (ADMIN_REQUIRE_2FA)", detail: no2fa ? "O'chiq — 2FA'siz admin parol bilan kira oladi (yuqoridagi «Adminlarda 2FA» bandini hal qiling)" : "O'chiq, lekin barcha adminlarda 2FA yoqilgan — kirishda kod baribir so'raladi. Yangi admin qo'shilsa foydali", fix: no2fa ? "AVVAL barcha adminlar 2FA'ni yoqsin, KEYIN hostingda ADMIN_REQUIRE_2FA=1 qo'ying (aks holda o'zingizni qulflab qo'yasiz)." : "Hostingda ADMIN_REQUIRE_2FA=1 qo'ying va qayta deploy qiling." });
  });

  await guard("data_key", "xavfsizlik", "Kontakt shifrlash kaliti (DATA_ENCRYPTION_KEY)", () => {
    const title = "Kontakt shifrlash kaliti (DATA_ENCRYPTION_KEY)";
    if ((process.env.DATA_ENCRYPTION_KEY?.trim() ?? "").length >= 16) add({ key: "data_key", group: "xavfsizlik", status: "ok", title, detail: "Alohida kalit o'rnatilgan" });
    else add({ key: "data_key", group: "xavfsizlik", status: "warn", optional: true, title, detail: "Kontaktlar AUTH_SECRET'dan hosil qilingan kalit bilan shifrlangan va ishlayapti. Faqat AUTH_SECRET'ni o'zgartirmang", fix: "Alohida kalit bering: `openssl rand -base64 48` → DATA_ENCRYPTION_KEY. Mavjud bazada OLDIN eski kalit bilan `npx tsx scripts/seal-contacts.ts --unseal`, kalitni qo'ygach qayta `npx tsx scripts/seal-contacts.ts`." });
  });

  await guard("demo_accounts", "xavfsizlik", "Demo (seed) hisoblar", async () => {
    const title = "Demo (seed) hisoblar";
    const [r] = await db
      .select({ n: sql<number>`count(*)`, admins: sql<number>`coalesce(sum(case when ${users.role} = 'admin' then 1 else 0 end), 0)` })
      .from(users)
      .where(or(like(users.email, "%@redince.uz"), like(users.email, "%@example.com"), like(users.id, "seed-%")));
    const n = Number(r?.n ?? 0);
    const admins = Number(r?.admins ?? 0);
    const profiles = n - admins;
    if (profiles > 0) add({ key: "demo_accounts", group: "xavfsizlik", status: "warn", title, detail: `${profiles} ta demo profil — katalogda soxta ijodkorlar ko'rinadi`, fix: "Admin panel tepasidagi «Demo ma'lumotlarni o'chirish» tugmasi bilan tozalang." });
    else if (admins > 0) add({ key: "demo_accounts", group: "xavfsizlik", status: "warn", optional: true, title, detail: `Katalog toza. Boshlang'ich admin hisobi (${admins} ta, @redince.uz) qolgan — paroli standart emas`, fix: "Ishlatmasangiz: hostingda ADMIN_EMAIL'ni o'z emailingizga o'zgartiring yoki shu hisobning parolini uzun va noyob qiling." });
    else add({ key: "demo_accounts", group: "xavfsizlik", status: "ok", title, detail: "Demo hisoblar yo'q" });
  });

  /* ------------------------------- To'lov ------------------------------ */
  await guard("payments", "tolov", "To'lov tizimlari", async () => {
    const env = paymentsEnv();
    const paymeOn = Boolean(env.payme.merchantId);
    const clickOn = Boolean(env.click.serviceId && env.click.merchantId);
    const card = await readManualCard();

    if (process.env.PAYME_TEST === "1") add({ key: "payme_test", group: "tolov", status: hard, title: "Payme test rejimi (PAYME_TEST)", detail: prod ? "YOQILGAN — to'lovlar test kassasiga ketadi, haqiqiy pul tushmaydi" : "Yoqilgan — test kassasi (lokal sinov uchun to'g'ri)", fix: "Productionda PAYME_TEST o'zgaruvchisini butunlay olib tashlang va PAYME_KEY (jonli kalit) borligini tekshiring." });
    else add({ key: "payme_test", group: "tolov", status: "ok", title: "Payme test rejimi (PAYME_TEST)", detail: "O'chiq — jonli kassa" });

    if (!paymeOn) add({ key: "payme", group: "tolov", status: "warn", optional: true, title: "Payme", detail: "Ulanmagan — to'lov usullarida chiqmaydi", fix: "Payme Business kabinetidan PAYME_MERCHANT_ID va PAYME_KEY oling; webhook manzili: <sayt>/api/payments/payme." });
    else if (!env.payme.key) add({ key: "payme", group: "tolov", status: "fail", title: "Payme", detail: "Merchant ID bor, kalit yo'q — Payme so'rovlari imzodan o'tmaydi, to'lov tasdiqlanmaydi", fix: "PAYME_KEY (jonli kalit) ni qo'ying." });
    else add({ key: "payme", group: "tolov", status: "ok", title: "Payme", detail: "Sozlangan" });

    if (!clickOn && !env.click.serviceId && !env.click.merchantId && !env.click.secret) add({ key: "click", group: "tolov", status: "warn", optional: true, title: "Click", detail: "Ulanmagan — to'lov usullarida chiqmaydi", fix: "Click kabinetidan CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_MERCHANT_USER_ID va CLICK_SECRET_KEY oling; Prepare/Complete manzili: <sayt>/api/payments/click." });
    else if (!clickOn || !env.click.secret) add({ key: "click", group: "tolov", status: "fail", title: "Click", detail: "Kalitlar to'liq emas — Click so'rovlari imzodan o'tmaydi", fix: "To'rttasi ham kerak: CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_MERCHANT_USER_ID, CLICK_SECRET_KEY." });
    else add({ key: "click", group: "tolov", status: "ok", title: "Click", detail: "Sozlangan" });

    if (card.source === "none") add({ key: "manual_card", group: "tolov", status: "warn", optional: true, title: "Qo'lda o'tkazma kartasi", detail: "Karta rekviziti kiritilmagan — «kartaga o'tkazish» usuli chiqmaydi", fix: "Admin → Moliya → «To'lov tizimlari»da karta raqami va egasini kiriting." });
    else add({ key: "manual_card", group: "tolov", status: "ok", title: "Qo'lda o'tkazma kartasi", detail: card.source === "settings" ? "Kiritilgan (admin sozlamasi)" : "Kiritilgan (env)" });

    if (!paymeOn && !clickOn && card.source === "none") add({ key: "payments_any", group: "tolov", status: hard, title: "Kamida bitta to'lov usuli", detail: "Hech qanday to'lov usuli yo'q — obuna, kontakt va kurs sotib bo'lmaydi", fix: "Eng tezi: «To'lov tizimlari»da karta rekvizitini kiriting (qo'lda tasdiqlash); keyin Payme/Click ulang." });
  });

  /* ------------------------------- Aloqa ------------------------------- */
  await guard("email", "aloqa", "Email (Resend)", () => {
    const title = "Email (Resend)";
    const key = set("RESEND_API_KEY");
    const from = set("MAIL_FROM");
    if (key && from) add({ key: "email", group: "aloqa", status: "ok", title, detail: "Sozlangan" });
    else add({ key: "email", group: "aloqa", status: hard, title, detail: `${!key && !from ? "Sozlanmagan" : !key ? "RESEND_API_KEY yo'q" : "MAIL_FROM yo'q"} — parol tiklash, email tasdiqlash va bildirishnoma xatlari yuborilmaydi`, fix: "resend.com'da domenni tasdiqlang; RESEND_API_KEY va MAIL_FROM=\"Kasb Egalari <no-reply@domeningiz>\" qo'ying." });
  });

  await guard("telegram", "aloqa", "Telegram bot", async () => {
    if (!isTelegramEnabled()) return void add({ key: "telegram_bot", group: "aloqa", status: "warn", title: "Telegram bot", detail: "Token yo'q — bot, «Telegram bilan kirish» va Telegram bildirishnomalari o'chiq", fix: "@BotFather'da bot yarating, TELEGRAM_BOT_TOKEN va TELEGRAM_BOT_USERNAME ni qo'ying, so'ng «Telegram bot» kartasida webhook'ni o'rnating." });

    const [me, info] = await Promise.all([timeout(telegramApi<{ username?: string }>("getMe"), 4000), timeout(telegramApi<{ url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number }>("getWebhookInfo"), 4000)]);
    const apiDown = me === "timeout" || me === null;
    const envUser = telegramBotUsername();
    if (apiDown) add({ key: "telegram_bot", group: "aloqa", status: "warn", title: "Telegram bot", detail: "Token bor, lekin Telegram API javob bermadi — holatni tekshirib bo'lmadi", fix: "Birozdan so'ng qayta tekshiring; serverdan api.telegram.org ochiqligini tekshiring." });
    else if (!me.ok) add({ key: "telegram_bot", group: "aloqa", status: "fail", title: "Telegram bot", detail: "Token yaroqsiz — Telegram uni rad etdi", fix: "@BotFather → /token bilan yangi token oling va TELEGRAM_BOT_TOKEN ni almashtiring." });
    else if (!envUser) add({ key: "telegram_bot", group: "aloqa", status: "warn", title: "Telegram bot", detail: "Token yaroqli, lekin TELEGRAM_BOT_USERNAME yo'q — «Telegramga ulash» va ulashish havolalari chiqmaydi", fix: "TELEGRAM_BOT_USERNAME ga bot nomini (@ belgisisiz) yozing." });
    else if (me.result?.username && me.result.username.toLowerCase() !== envUser.toLowerCase()) add({ key: "telegram_bot", group: "aloqa", status: "fail", title: "Telegram bot", detail: "TELEGRAM_BOT_USERNAME token egasi bo'lgan botga mos emas — havolalar boshqa botga olib boradi", fix: "TELEGRAM_BOT_USERNAME ni tokenga tegishli bot nomiga to'g'rilang." });
    else add({ key: "telegram_bot", group: "aloqa", status: "ok", title: "Telegram bot", detail: "Token yaroqli, bot nomi mos" });

    const title = "Telegram webhook";
    const fix = "Admin → Tizim → «Telegram bot» kartasida «Webhookni o'rnatish» tugmasini bosing.";
    if (info === "timeout" || info === null) add({ key: "telegram_webhook", group: "aloqa", status: "warn", title, detail: "Telegram API javob bermadi — webhook holati noma'lum", fix: "Birozdan so'ng qayta tekshiring." });
    else if (!info.ok) add({ key: "telegram_webhook", group: "aloqa", status: "warn", title, detail: "Webhook holatini olib bo'lmadi", fix });
    else {
      const expected = `${SITE_URL.replace(/\/$/, "")}/api/telegram/webhook`;
      const url = info.result?.url ?? "";
      const errAge = info.result?.last_error_date ? now - info.result.last_error_date * 1000 : null;
      if (!url) add({ key: "telegram_webhook", group: "aloqa", status: hard, title, detail: "O'rnatilmagan — bot xabarlarga javob bermaydi", fix });
      else if (url !== expected) add({ key: "telegram_webhook", group: "aloqa", status: hard, title, detail: "Boshqa manzilga qarab turibdi — bot bu saytga xabar yubormaydi", fix });
      else if (errAge != null && errAge < 24 * HOUR) add({ key: "telegram_webhook", group: "aloqa", status: "warn", title, detail: `O'rnatilgan, lekin ${agoText(errAge)} Telegram xato olgan (${info.result?.pending_update_count ?? 0} ta xabar navbatda)`, fix: "«Xatolar» bo'limida /api/telegram/webhook xatosini qidiring; tuzatgach «Webhookni yangilash»ni bosing." });
      else add({ key: "telegram_webhook", group: "aloqa", status: "ok", title, detail: "Shu saytga o'rnatilgan, oxirgi 24 soatda xatosiz" });
    }
  });

  await guard("telegram_channel", "aloqa", "Majburiy obuna kanali", () => {
    const title = "Majburiy obuna kanali (TELEGRAM_REQUIRED_CHANNEL)";
    if (set("TELEGRAM_REQUIRED_CHANNEL")) add({ key: "telegram_channel", group: "aloqa", status: "ok", title, detail: "O'rnatilgan — botdan foydalanish uchun kanalga obuna shart (bot kanalda admin bo'lishi kerak)" });
    else add({ key: "telegram_channel", group: "aloqa", status: "warn", optional: true, title, detail: "O'chiq — bot kanalga obunani talab qilmaydi", fix: "Xohlasangiz TELEGRAM_REQUIRED_CHANNEL=@kanal qo'ying va botni kanalga ADMIN qiling." });
  });

  await guard("push", "aloqa", "Web Push (VAPID)", () => {
    const title = "Web Push (VAPID)";
    if (isPushEnabled()) add({ key: "push", group: "aloqa", status: "ok", title, detail: "Sozlangan — brauzer bildirishnomalari ishlaydi" });
    else add({ key: "push", group: "aloqa", status: "warn", optional: true, title, detail: "Sozlanmagan — brauzer bildirishnomalari paneli ko'rinmaydi", fix: "`node scripts/gen-vapid.mjs` bilan kalit yarating: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT." });
  });

  await guard("google", "aloqa", "Google bilan kirish", () => {
    const title = "Google bilan kirish";
    if (isGoogleConfigured()) add({ key: "google", group: "aloqa", status: "ok", title, detail: "Sozlangan (redirect URI: <sayt>/api/auth/google/callback)" });
    else add({ key: "google", group: "aloqa", status: "warn", optional: true, title, detail: "Sozlanmagan — kirish sahifasida Google tugmasi ko'rinmaydi", fix: "Google Cloud Console → OAuth: GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET; redirect URI — <sayt>/api/auth/google/callback." });
  });

  /* ------------------------------- Media ------------------------------- */
  await guard("storage", "media", "Fayl saqlash", () => {
    const title = "Fayl saqlash";
    if (isR2Enabled()) add({ key: "storage", group: "media", status: "ok", title, detail: "Cloudflare R2 ulangan" });
    else if (set("BLOB_READ_WRITE_TOKEN")) add({ key: "storage", group: "media", status: "ok", title, detail: "Vercel Blob ulangan" });
    else if (onVercel) add({ key: "storage", group: "media", status: "fail", title, detail: "Saqlash ulanmagan — Vercel'da rasm/video yuklash ishlamaydi", fix: "Vercel → Storage → Blob (Public) yarating yoki R2 env'larini to'liq kiriting (docs/DEPLOY.md)." });
    else if (prod && !set("UPLOAD_DIR")) add({ key: "storage", group: "media", status: "warn", title, detail: "Server diski, lekin UPLOAD_DIR berilmagan — konteyner qayta qurilganda fayllar yo'qolishi mumkin", fix: "UPLOAD_DIR ni doimiy diskka (volume) qarating yoki R2 ulang." });
    else add({ key: "storage", group: "media", status: "ok", title, detail: "Server diski (doimiy papka)" });
  });

  await guard("livekit", "media", "LiveKit (efir va qo'ng'iroq)", () => {
    const title = "LiveKit (efir va qo'ng'iroq)";
    const any = Boolean(LIVEKIT_WS_URL) || set("LIVEKIT_API_KEY") || set("LIVEKIT_API_SECRET");
    if (isCallEnabled()) add({ key: "livekit", group: "media", status: "ok", title, detail: isR2Enabled() ? "Ulangan — efir yozuvi ham mumkin (R2 bor)" : "Ulangan — efir yozuvi uchun R2 kerak (hozir yo'q)" });
    else if (any) add({ key: "livekit", group: "media", status: "fail", title, detail: "Kalitlar to'liq emas — efir va qo'ng'iroq boshlanmaydi", fix: "Uchalasi ham kerak: LIVEKIT_URL (yoki NEXT_PUBLIC_LIVEKIT_URL), LIVEKIT_API_KEY, LIVEKIT_API_SECRET." });
    else add({ key: "livekit", group: "media", status: "warn", title, detail: "Ulanmagan — jonli efir, 1:1 konsultatsiya va qo'ng'iroqlar ishlamaydi", fix: "LiveKit Cloud loyihasidan LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET oling." });
  });

  /* ----------------------------- Qo'shimcha ---------------------------- */
  await guard("gemini", "qoshimcha", "AI (GEMINI_API_KEY)", () => {
    const title = "AI (GEMINI_API_KEY)";
    if (isAutoTranslateConfigured()) add({ key: "gemini", group: "qoshimcha", status: "ok", title, detail: "Ulangan — avto-tarjima va vakansiya yordamchisi AI bilan ishlaydi" });
    else add({ key: "gemini", group: "qoshimcha", status: "warn", optional: true, title, detail: "Kalit yo'q — AI o'rniga tayyor shablonlar ishlaydi (yangi matnlar ruschaga o'girilmaydi)", fix: "Google AI Studio'dan kalit olib GEMINI_API_KEY ga qo'ying." });
  });

  await guard("seo", "qoshimcha", "Qidiruv tizimlari tasdig'i", () => {
    const title = "Qidiruv tizimlari tasdig'i";
    const gsc = set("GOOGLE_SITE_VERIFICATION");
    const ya = set("YANDEX_VERIFICATION");
    if (gsc && ya) add({ key: "seo", group: "qoshimcha", status: "ok", title, detail: "Google va Yandex tasdiq kodlari o'rnatilgan" });
    else add({ key: "seo", group: "qoshimcha", status: "warn", optional: true, title, detail: `${gsc ? "Yandex" : ya ? "Google" : "Google va Yandex"} tasdiq kodi yo'q — indekslashni kuzatib bo'lmaydi`, fix: "Search Console / Yandex Webmaster'dan meta-teg kodini olib GOOGLE_SITE_VERIFICATION / YANDEX_VERIFICATION ga qo'ying (docs/DEPLOY.md 12-bo'lim)." });
  });

  // Tartib: guruh bo'yicha, ichida — muammo birinchi
  const gi = new Map(READINESS_GROUPS.map((x, i) => [x.key, i] as const));
  const si: Record<ReadinessStatus, number> = { fail: 0, warn: 1, ok: 2 };
  checks.sort((a, b) => (gi.get(a.group) ?? 9) - (gi.get(b.group) ?? 9) || si[a.status] - si[b.status]);

  // Ixtiyoriy (sozlanmagan) bandlar — muammo emas: na ogohlantirishlar soniga, na foizga ta'sir qiladi
  const ok = checks.filter((c) => c.status === "ok" || (c.optional && c.status === "warn")).length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const warn = checks.length - ok - fail;
  // Foiz: bajarilgan = 1, ogohlantirish = 0.5 (ixtiyoriy imkoniyat sozlanmagani tayyorlikni kam pasaytiradi — 0.75)
  const score = checks.reduce((s, c) => s + (c.status === "ok" || c.optional ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  const environment = onVercel ? `Vercel${prod ? "" : " (dev)"}` : process.env.RAILWAY_ENVIRONMENT ? "Railway" : prod ? "O'z serveri (production)" : "Lokal (development)";

  return { ts: now, production: prod, environment, checks, summary: { total: checks.length, ok, warn, fail, percent: checks.length ? Math.round((score / checks.length) * 100) : 0 } };
}
