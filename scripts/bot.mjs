#!/usr/bin/env node
/**
 * Telegram bot regressiya testlari — ishlab turgan server + soxta Bot API (scripts/fake-telegram-api.mjs) ga qarshi.
 *
 *   TELEGRAM_API_BASE=http://127.0.0.1:8099 TELEGRAM_BOT_TOKEN=111:test ... npm run dev   (yoki next start)
 *   node scripts/fake-telegram-api.mjs 8099 &
 *   BASE_URL=http://localhost:3000 node --test scripts/bot.mjs
 *
 * Kerakli env: TELEGRAM_WEBHOOK_SECRET (webhook sarlavhasi), ADMIN_EMAIL/ADMIN_PASSWORD (admin boti testi; .env'dan ham o'qiladi; bo'lmasa /tmp/ad.jar cookie jar).
 * Tekshiradi: webhook siri, /start savoli (uz/ru), botda ro'yxatdan o'tish (mutaxassis), /profil, oddiy foydalanuvchiga
 * admin buyrug'i yopiqligi, admin ulash → /stat (trend) → /navbat → /shikoyatlar, admin boti ruscha (language_code=ru → /stat, /admin), inline rejim, bot orqali post taklifi.
 * Lokal fayl bazada test hisobini o'chiradi va adminning avvalgi chat ulanishini qaytaradi.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const LOG = process.env.FAKE_TG_LOG || "/tmp/fake-bot.log";

/** .env'dagi qiymat (env'da bo'lmasa) — lokal ishga tushirish qulayligi uchun */
function envOr(key, fallback = "") {
  if (process.env[key]) return process.env[key];
  try {
    const line = fs.readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith(key + "="));
    if (line) return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
  } catch {
    /* .env yo'q */
  }
  return fallback;
}
const SECRET = envOr("TELEGRAM_WEBHOOK_SECRET");
const ADMIN_EMAIL = envOr("ADMIN_EMAIL", "admin@redince.uz");
const ADMIN_PASSWORD = envOr("ADMIN_PASSWORD");
const DEMO_PASSWORD = envOr("DEMO_PASSWORD", "demo12345");
const DB_URL = envOr("DATABASE_URL", "file:./data/redince.db");
/** Soxta Bot API manzili — `/__control` orqali test ish vaqtida uning javoblarini almashtiradi (429, 403, a'zolik) */
const FAKE = envOr("TELEGRAM_API_BASE", "http://127.0.0.1:8099").replace(/\/+$/, "");

const RUN = String(Date.now()).slice(-7);
const CHAT_UZ = Number(`88${RUN}`);
const CHAT_RU = Number(`89${RUN}`);
const CHAT_ADMIN = Number(`87${RUN}`);
/** Demo mijoz (mijoz@redince.uz) uchun vaqtinchalik chat — yetkazish/blok testlari */
const CHAT_CLIENT = Number(`86${RUN}`);
/** Hisobsiz vaqtinchalik chatlar: kirish havolasi orqali ro'yxat (L), darvoza (G1–G4), chegaralar (X) */
const CHAT_L = Number(`84${RUN}`);
const CHAT_G1 = Number(`83${RUN}`);
const CHAT_G2 = Number(`82${RUN}`);
const CHAT_G3 = Number(`81${RUN}`);
const CHAT_G4 = Number(`80${RUN}`);
const CHAT_X = Number(`79${RUN}`);
/** Majburiy obuna darvozasi yoqilganmi (server shu env bilan ishga tushirilgan bo'lishi kerak) — darvoza testlari shunga bog'liq */
const GATE = Boolean(envOr("TELEGRAM_REQUIRED_CHANNEL"));
/** Telegram ichidagi to'lov (sendInvoice) sozlanganmi */
const NATIVE = Boolean(envOr("TELEGRAM_PAYMENT_PROVIDER_TOKEN"));
let upd = Number(`5${RUN}`);
let logPos = 0;

/** Jurnalning yangi qatorlari (oxirgi o'qishdan beri) */
function fresh() {
  const buf = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8") : "";
  const out = buf.slice(logPos);
  logPos = buf.length;
  return out
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Jurnal «tinchiguncha» kutadi: oxirgi yozuvdan keyin `quietMs` jim bo'lsa qaytadi (bot ba'zi ishlarni javobdan KEYIN bajaradi,
 * xabarlar esa navbat bilan ketadi — qat'iy kutish o'rniga). Hech narsa kelmasa ham `quietMs` dan keyin bo'sh ro'yxat.
 */
async function settle(quietMs = 700, maxMs = 15_000) {
  const out = [];
  const start = Date.now();
  let last = start;
  for (;;) {
    const ev = fresh();
    if (ev.length) {
      out.push(...ev);
      last = Date.now();
    }
    if (Date.now() - last >= quietMs || Date.now() - start >= maxMs) return out;
    await sleep(80);
  }
}
/** Shart bajarilguncha jurnalni yig'adi (javobdan keyingi og'ir ishlar: yuklash, ommaviy yuborish) — topilmasa to'plangani qaytadi */
async function waitFor(pred, maxMs = 20_000) {
  const out = [];
  const start = Date.now();
  for (;;) {
    out.push(...fresh());
    if (pred(out)) return out;
    if (Date.now() - start >= maxMs) return out;
    await sleep(100);
  }
}
async function hook(update, wait = 700) {
  const r = await fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET }, body: JSON.stringify({ update_id: upd++, ...update }) });
  assert.equal(r.status, 200, `webhook ${r.status}`);
  return settle(Math.max(500, wait));
}
/** Soxta Bot API holatini almashtirish (scripts/fake-telegram-api.mjs sarlavhasiga qarang) */
async function control(patch) {
  const r = await fetch(`${FAKE}/__control`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  assert.equal(r.status, 200, "soxta Bot API /__control javob bermadi (eski versiya ishlab turgan bo'lishi mumkin)");
  return (await r.json()).state;
}
const from = (id, lang = "uz") => ({ id, is_bot: false, first_name: "Sinov", last_name: "Bot", username: "sinovbot", language_code: lang });
const msg = (chatId, text, lang) => hook({ message: { message_id: upd, from: from(chatId, lang), chat: { id: chatId, type: "private" }, date: Math.floor(Date.now() / 1000), text } });
const cb = (chatId, data, lang) => hook({ callback_query: { id: String(upd), from: from(chatId, lang), data, message: { message_id: 4242, chat: { id: chatId, type: "private" }, text: "..." } } });
/** Xom update (javobni kutmasdan bir nechtasini parallel yuborish uchun — ikki marta bosish testlari) */
const rawHook = (update) => fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET }, body: JSON.stringify({ update_id: upd++, ...update }) });
const cbUpdate = (chatId, data, lang) => ({ callback_query: { id: String(upd), from: from(chatId, lang), data, message: { message_id: 4242, chat: { id: chatId, type: "private" }, text: "..." } } });
const photoMsg = (chatId, fileId, extra = {}) => ({ message: { message_id: upd, from: from(chatId), chat: { id: chatId, type: "private" }, date: 1, photo: [{ file_id: fileId, file_size: 90000, width: 1280, height: 960 }], ...extra } });
const texts = (evs) => evs.map((e) => String(e.body?.text ?? e.body?.caption ?? "")).join("\n");
const buttons = (evs) => evs.flatMap((e) => (e.body?.reply_markup?.inline_keyboard ?? []).flat().map((b) => b.callback_data ?? b.url ?? b.web_app?.url ?? ""));
const sentTo = (evs, chatId) => evs.filter((e) => String(e.body?.chat_id) === String(chatId));

/** Lokal fayl bazasi (CI'da ham file:) — tozalash va admin chatini qaytarish uchun; bo'lmasa null */
let dbShared;
async function dbClient() {
  if (dbShared !== undefined) return dbShared;
  if (!DB_URL.startsWith("file:")) return (dbShared = null);
  try {
    const { createClient } = await import("@libsql/client");
    dbShared = createClient({ url: DB_URL });
  } catch {
    dbShared = null;
  }
  return dbShared;
}
/** Bitta so'rov: qatorlar (baza yo'q bo'lsa null — test o'zi o'tkazib yuboradi) */
async function sql(query, args = []) {
  const db = await dbClient();
  if (!db) return null;
  return (await db.execute({ sql: query, args })).rows;
}
/** Sayt API'si (cookie bilan): { status, json } */
async function api(cookieHeader, method, path, body) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { "content-type": "application/json", origin: BASE, ...(cookieHeader ? { cookie: cookieHeader } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, json: await r.json().catch(() => null) };
}
/** Chatga ulangan hisob id'si (bazadan) */
async function userIdByChat(chatId) {
  const rows = await sql("select id from users where telegram_chat_id = ? limit 1", [String(chatId)]);
  return rows?.[0]?.id ?? null;
}
/** Adminning testgacha bo'lgan chat ulanishi: `undefined` — o'qilmagan (after() tegmaydi), null — ulanmagan edi */
let adminPrevChat;
let cookie = "";

/** Netscape cookie jar (curl -c) → Cookie sarlavhasi — lokal ishda tayyor sessiya (xavfsizlik testlari bilan bir xil) */
function jar(file) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.replace(/^#HttpOnly_/, ""))
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("\t"))
      .filter((c) => c.length >= 7)
      .map((c) => `${c[5]}=${c[6]}`)
      .join("; ");
  } catch {
    return "";
  }
}

async function login(email, password, jarFile = process.env.ADMIN_COOKIE_JAR || "/tmp/ad.jar") {
  if (password) {
    const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email, password }) });
    if (r.ok) return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  }
  return jar(jarFile);
}
const CLIENT_EMAIL = "mijoz@redince.uz";
/** Demo mijozning testgacha bo'lgan chati va tili (after() qaytaradi); `undefined` — o'qilmagan */
let clientPrev;
let clientCookie = "";
/** Demo mijoz sessiyasi (seed hisobi; CI'da DEMO_PASSWORD) — buyurtma/ariza/xabar oqimlarining «qarshi tomoni» */
async function clientSession() {
  if (!clientCookie) clientCookie = await login(CLIENT_EMAIL, DEMO_PASSWORD, "/tmp/cl.jar");
  return clientCookie;
}
/** Test davomida yaratilgan yozuvlar — after() tozalaydi */
const created = { orders: [], vacancies: [], conversations: [], feedback: [], tempChats: [], mentors: [], courses: [] };
/** Qo'lda o'tkazma kartasini test davomida sozlash (sozlanmagan muhitda «Karta o'tkazmasi» tugmasi chiqmaydi); qaytaruvchi funksiya beradi */
async function withManualCard() {
  const prev = (await sql("select value from platform_settings where key = 'platformCard'"))[0]?.value ?? null;
  await sql("insert into platform_settings (key, value, updated_at) values ('platformCard', ?, ?) on conflict(key) do update set value = excluded.value", [JSON.stringify("8600 1111 2222 3333"), Date.now()]);
  return async () => {
    if (prev == null) await sql("delete from platform_settings where key = 'platformCard'");
    else await sql("update platform_settings set value = ? where key = 'platformCard'", [prev]);
  };
}
/** Demo mutaxassis nomidan tasdiqlangan ustoz va pullik kurs (50 000 so'm) — bir marta yaratiladi, after() o'chiradi */
let testCourse;
async function ensureCourse() {
  if (testCourse) return testCourse;
  const owner = (await sql("select id from users where email = ?", ["mutaxassis@redince.uz"]))[0]?.id;
  assert.ok(owner, "demo mutaxassis bazada yo'q (seed)");
  let mentor = (await sql("select id from mentors where user_id = ?", [owner]))[0]?.id;
  if (!mentor) {
    mentor = crypto.randomUUID();
    await sql("insert into mentors (id, user_id, headline, is_approved, slug) values (?, ?, ?, 1, ?)", [mentor, owner, "Sinov ustoz", `sinov-ustoz-${RUN}`]);
    created.mentors.push(mentor);
  }
  const course = crypto.randomUUID();
  await sql("insert into courses (id, mentor_id, slug, title, price_from, is_published, lessons_count) values (?, ?, ?, ?, 50000, 1, 3)", [course, mentor, `sinov-kurs-${RUN}`, `Sinov kursi ${RUN}`]);
  created.courses.push(course);
  return (testCourse = { course, mentor });
}
/** Ko'p testlar bazani bevosita o'qiydi (holatni tekshirish) — fayl bazasi bo'lmasa o'tkazib yuboriladi */
const NEED_DB = !DB_URL.startsWith("file:") && "lokal fayl bazasi kerak (DATABASE_URL=file:…)";
const ADMIN_SKIP = !ADMIN_PASSWORD && !fs.existsSync(process.env.ADMIN_COOKIE_JAR || "/tmp/ad.jar") && "ADMIN_PASSWORD (yoki /tmp/ad.jar) berilmagan";

/** Sayt hisobini chatga ulash: /api/telegram/link kodi → botda `/start <kod>`; chatga kelgan xabarlar qaytadi */
async function linkChat(cookieHeader, chatId, lang = "uz") {
  const { json } = await api(cookieHeader, "POST", "/api/telegram/link");
  assert.ok(json?.ok && json.data?.url, `ulash kodi olinmadi: ${JSON.stringify(json).slice(0, 160)}`);
  const code = new URL(json.data.url).searchParams.get("start");
  assert.ok(code, "start kodi yo'q");
  return sentTo(await msg(chatId, `/start ${code}`, lang), chatId);
}
/** Saytda «Telegram bilan kirish» so'rovi (mehmon brauzer): 6 xonali kod + sir cookie'si (holatni shu cookie bilan so'raymiz) */
async function loginRequest() {
  const r = await fetch(`${BASE}/api/auth/telegram`, { method: "POST", headers: { "content-type": "application/json", origin: BASE, "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" } });
  const j = await r.json().catch(() => null);
  assert.ok(j?.ok && /^\d{6}$/.test(j.data?.code ?? ""), `kirish so'rovi ochilmadi: ${JSON.stringify(j).slice(0, 160)}`);
  return { code: j.data.code, cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ") };
}
/** Kirish so'rovi holati brauzer tomonidan: pending | confirm (bot tasdiqladi) | denied | expired */
const loginStatus = async (cookieHeader) => (await api(cookieHeader, "PUT", "/api/auth/telegram")).json?.data?.status;
/** Chegara hisoblagichini to'ldirish (chegaradan o'tgan holatni yuzlab so'rovsiz sinash uchun) */
async function exhaust(key) {
  await sql("insert into rate_limits (key, count, reset_at) values (?, 100000, ?) on conflict(key) do update set count = 100000, reset_at = excluded.reset_at", [key, Date.now() + 3_600_000]);
}
const answers = (evs) => texts(evs.filter((e) => e.method === "answerCallbackQuery"));

/** `evs` shartni qanoatlantirmasa — jurnaldan yana kutib qo'shadi (bildirishnomalar javobdan keyin, navbat bilan ketadi) */
async function collect(evs, pred, maxMs = 15_000) {
  if (pred(evs)) return evs;
  return [...evs, ...(await waitFor((more) => pred([...evs, ...more]), maxMs))];
}
/** Demo mijoz nomidan test mutaxassisiga buyurtma (id qaytadi; after() o'chiradi) */
async function placeOrder(title) {
  const sp = (await sql("select s.id from specialists s join users u on u.id = s.user_id where u.telegram_chat_id = ?", [String(CHAT_UZ)]))?.[0]?.id;
  assert.ok(sp, "test mutaxassisi topilmadi (ro'yxatdan o'tish testi o'tmagan)");
  const r = await api(await clientSession(), "POST", "/api/orders", { specialistId: sp, title, description: "Bot testi: buyurtma bildirishnomasi va tugmalari tekshiriladi.", contactPhone: "+998 90 123 45 67" });
  assert.equal(r.status, 201, `buyurtma yaratilmadi: ${JSON.stringify(r.json).slice(0, 240)}`);
  created.orders.push(r.json.data.id);
  return r.json.data.id;
}

before(async () => {
  // Avval DB holati (admin chatini keyin QAYTARISH uchun) — undan keyingina tekshiruvlar, aks holda after() noto'g'ri qiymat yozadi
  const db = await dbClient();
  if (db) {
    const r = await db.execute({ sql: "select telegram_chat_id from users where email = ? limit 1", args: [ADMIN_EMAIL] }).catch(() => null);
    if (r) adminPrevChat = r.rows[0]?.telegram_chat_id ?? null;
    const c = await db.execute({ sql: "select telegram_chat_id, lang, notify_prefs from users where email = ? limit 1", args: [CLIENT_EMAIL] }).catch(() => null);
    if (c?.rows[0]) clientPrev = { chat: c.rows[0].telegram_chat_id ?? null, lang: c.rows[0].lang ?? null, prefs: c.rows[0].notify_prefs ?? "{}" };
    // Oldingi ishga tushirishlardan qolgan bot chegaralari (har run yangi chat id'lar, lekin IP/umumiy kalitlar qolishi mumkin)
    await db.execute("delete from rate_limits where key like 'tgStart:%' or key like 'tgBot:%' or key like 'tgMsg:%' or key like 'tgInline:%' or key like 'tgLogin:%' or key like 'tgLoginPoll:%' or key like 'tgWarn:%'").catch(() => undefined);
    // Testning o'z so'rovlari server yozuvi bilan to'qnashsa kutadi (xato bermaydi)
    await db.execute("pragma busy_timeout = 4000").catch(() => undefined);
  }
  assert.ok(SECRET, "TELEGRAM_WEBHOOK_SECRET kerak (env yoki .env)");
  // Dev server birinchi so'rovda kompilyatsiya qiladi — bir necha urinish
  let ping = false;
  for (let i = 0; i < 6 && !ping; i++) {
    ping = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.ok).catch(() => false);
    if (!ping) await sleep(2000);
  }
  assert.ok(ping, `Server javob bermayapti: ${BASE}`);
  // Soxta Bot API standart holatda; majburiy obuna yoqilgan muhitda (TELEGRAM_REQUIRED_CHANNEL) hamma «a'zo» — darvoza testlari o'zi almashtiradi
  await control({ reset: true, member: "member" });
  logPos = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").length : 0;
});

after(async () => {
  await control({ reset: true }).catch(() => undefined);
  const db = await dbClient();
  if (!db) return;
  const run = (q, args = []) => db.execute({ sql: q, args }).catch(() => undefined);
  for (const id of created.orders) {
    await run("delete from order_events where order_id = ?", [id]);
    await run("delete from orders where id = ?", [id]);
  }
  for (const id of created.vacancies) {
    await run("delete from applications where vacancy_id = ?", [id]);
    await run("delete from vacancies where id = ?", [id]);
  }
  for (const id of created.conversations) {
    await run("delete from dm_messages where conversation_id = ?", [id]);
    await run("delete from conversations where id = ?", [id]);
  }
  for (const id of created.feedback) await run("delete from feedback where id = ?", [id]);
  await run("delete from promo_codes where code like ?", [`SINOV%${RUN}`]);
  for (const id of created.courses) {
    await run("delete from enrollments where course_id = ?", [id]);
    await run("delete from mentor_earnings where invoice_id in (select id from subscription_invoices where json_extract(meta, '$.courseId') = ?)", [id]);
    await run("delete from subscription_invoices where json_extract(meta, '$.courseId') = ?", [id]);
    await run("delete from courses where id = ?", [id]);
  }
  for (const id of created.mentors) await run("delete from mentors where id = ?", [id]);
  await run("delete from notifications where type = 'broadcast' and title like ?", [`Sinov % ${RUN}`]);
  // Vaqtincha chat biriktirilgan seed hisoblar (e'lon yetkazish testi) — uzamiz
  for (const c of created.tempChats) {
    await run("update users set telegram_chat_id = null where telegram_chat_id = ?", [String(c)]);
    await run("delete from rate_limits where key like ?", [`%:${c}`]);
  }
  for (const c of [CHAT_UZ, CHAT_RU, CHAT_ADMIN, CHAT_CLIENT, CHAT_L, CHAT_G1, CHAT_G2, CHAT_G3, CHAT_G4, CHAT_X]) {
    // Botda ochilgan test hisoblari: chat bo'yicha yoki (uzilgan bo'lsa) vaqtinchalik email bo'yicha
    const u = await db.execute({ sql: "select id from users where (telegram_chat_id = ? and email like 'tg%@telegram.local') or email = ?", args: [String(c), `tg${c}@telegram.local`] });
    for (const row of u.rows) {
      await run("delete from notifications where user_id = ?", [row.id]);
      await run("delete from follows where follower_id = ? or following_id = ?", [row.id, row.id]);
      await run("delete from posts where author_id = ?", [row.id]);
      await run("delete from stories where author_id = ?", [row.id]);
      await run("delete from specialists where user_id = ?", [row.id]);
      await run("delete from users where id = ?", [row.id]);
    }
    await run("delete from bot_sessions where chat_id = ?", [String(c)]);
    await run("delete from rate_limits where key like ?", [`%:${c}`]);
    await run("delete from rate_limits where key like ?", [`%:${c}:%`]);
    await run("delete from tg_channel_gate where chat_id = ?", [String(c)]);
  }
  // Admin va demo mijoz chatini avvalgi holatga qaytarish (lokalda haqiqiy ulanish yo'qolmasin) — faqat before() o'qigan bo'lsa
  if (adminPrevChat !== undefined) await run("update users set telegram_chat_id = ? where email = ?", [adminPrevChat, ADMIN_EMAIL]);
  if (clientPrev !== undefined) await run("update users set telegram_chat_id = ?, lang = ?, notify_prefs = ? where email = ?", [clientPrev.chat, clientPrev.lang, clientPrev.prefs, CLIENT_EMAIL]);
});

test("webhook: noto'g'ri sir → 401", async () => {
  const r = await fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "notogri" }, body: JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: CHAT_UZ, type: "private" }, text: "/start" } }) });
  assert.equal(r.status, 401);
});

test("/start (hisobsiz, uz): «akkauntingiz bormi?» — ro'yxat va ulash tugmalari", async () => {
  const evs = sentTo(await msg(CHAT_UZ, "/start"), CHAT_UZ);
  assert.ok(evs.length >= 1, "javob kelmadi");
  assert.match(texts(evs), /akkauntingiz bormi/i);
  const b = buttons(evs);
  assert.ok(b.includes("rg:start") && b.includes("rg:have"), `tugmalar: ${b.join(", ")}`);
});

test("/start (hisobsiz, ru): savol ruscha", async () => {
  const evs = sentTo(await msg(CHAT_RU, "/start", "ru"), CHAT_RU);
  assert.match(texts(evs), /аккаунт/i);
  assert.ok(buttons(evs).includes("rg:start"));
});

test("botda ro'yxatdan o'tish (mutaxassis): rol → ism → yo'nalish → kasb → tajriba → hudud → telefon → tasdiq → hisob", async () => {
  assert.ok(buttons(await cb(CHAT_UZ, "rg:start")).includes("rg:role:specialist"));
  assert.ok(buttons(await cb(CHAT_UZ, "rg:role:specialist")).includes("rg:name:tg"));
  assert.ok(buttons(await cb(CHAT_UZ, "rg:name:tg")).some((d) => d.startsWith("rg:grp:")));
  assert.ok(buttons(await cb(CHAT_UZ, "rg:grp:video")).includes("rg:cat:videograf"));
  assert.ok(buttons(await cb(CHAT_UZ, "rg:cat:videograf")).includes("rg:exp:middle"));
  assert.ok(buttons(await cb(CHAT_UZ, "rg:exp:middle")).includes("rg:reg:toshkent-shahri"));
  const phone = await cb(CHAT_UZ, "rg:reg:toshkent-shahri");
  assert.match(texts(phone), /telefon/i);
  assert.ok(buttons(await msg(CHAT_UZ, "⏭ O'tkazib yuborish")).includes("rg:ok"), "tasdiqlash tugmasi yo'q");
  const done = await cb(CHAT_UZ, "rg:ok", undefined);
  assert.match(texts(sentTo(done, CHAT_UZ)), /hisob ochildi|xush kelibsiz/i);
  // Profil — ulangan hisob
  const prof = sentTo(await msg(CHAT_UZ, "/profil"), CHAT_UZ);
  assert.match(texts(prof), /Sinov Bot/);
  assert.match(texts(prof), /Videograf/i);
});

test("oddiy foydalanuvchiga admin buyruqlari yopiq", async () => {
  assert.match(texts(sentTo(await msg(CHAT_UZ, "/stat"), CHAT_UZ)), /faqat administrator/i);
  const evs = await cb(CHAT_UZ, "adm:stat:today");
  assert.match(texts(evs.filter((e) => e.method === "answerCallbackQuery")), /administrator/i);
});

test("tugma faqat o'z shaxsiy chatida ishlaydi: guruh xabari yoki begona bosuvchi e'tiborsiz", async () => {
  // Guruhdagi xabar tugmasi (chat.type=group) — hech qanday javob/harakat yo'q
  const grp = -Number(`100${RUN}`);
  const g = await hook({ callback_query: { id: String(upd), from: from(CHAT_UZ), data: "rg:start", message: { message_id: 4243, chat: { id: grp, type: "group" }, text: "..." } } });
  assert.equal(sentTo(g, grp).length + sentTo(g, CHAT_UZ).length, 0, `guruh tugmasi ishladi: ${texts(g)}`);
  // Shaxsiy chat, lekin bosgan odam boshqa (from.id ≠ chat.id) — e'tiborsiz
  const other = await hook({ callback_query: { id: String(upd), from: from(CHAT_UZ + 1), data: "rg:start", message: { message_id: 4244, chat: { id: CHAT_UZ, type: "private" }, text: "..." } } });
  assert.equal(sentTo(other, CHAT_UZ).length, 0, `begona bosuvchi tugmasi ishladi: ${texts(other)}`);
});

/* ------------------------------------------------------------------ */
/* Webhook himoyasi: takror update, chegaralar, majburiy obuna         */
/* ------------------------------------------------------------------ */

test("webhook: ASCII bo'lmagan sir sarlavhasi ham 401 (500 emas)", async () => {
  // Belgilar soni teng, baytlari farqli qiymat («é» — 1 belgi, UTF-8'da 2 bayt) — ilgari timingSafeEqual xato tashlab 500 qaytarardi
  const r = await fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "é".repeat(SECRET.length) }, body: "{}" });
  assert.equal(r.status, 401);
});

test("takror update_id: Telegram qayta yuborgan update ikkinchi marta bajarilmaydi", async () => {
  const id = upd++;
  const send = () => fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET }, body: JSON.stringify({ update_id: id, message: { message_id: id, from: from(CHAT_UZ), chat: { id: CHAT_UZ, type: "private" }, date: 1, text: "/top" } }) });
  fresh();
  assert.equal((await send()).status, 200);
  const first = sentTo(await settle(), CHAT_UZ);
  assert.ok(first.length >= 1, "birinchi update javobsiz qoldi");
  assert.equal((await send()).status, 200, "takror update ham 200 bilan tasdiqlanadi");
  assert.equal(sentTo(await settle(), CHAT_UZ).length, 0, "takror update qayta bajarildi");
});

test("chegara: tugma javobsiz qolmaydi; inline va xabar chegaralari tugmalardan alohida", { skip: NEED_DB }, async () => {
  // Tugmalar chegarasi tugagan chat
  await exhaust(`tgBot:${CHAT_X}`);
  const pressed = await cb(CHAT_X, "menu:help");
  assert.match(answers(pressed), /Juda ko'p so'rov/, "chegarada tugmaga javob berilmadi (tugma «aylanib» qoladi)");
  assert.equal(sentTo(pressed, CHAT_X).length, 0, "chegarada amal bajarildi");
  // Chegara matnida qiymatlar aytilmaydi (himoya tafsiloti oshkor qilinmaydi)
  assert.doesNotMatch(answers(pressed), /\d/);
  // Inline so'rovlar o'z chelagida — tugmalar chegarasi ularni to'xtatmaydi
  const iq = await hook({ inline_query: { id: `iqx${RUN}`, from: from(CHAT_X), query: "", offset: "" } }, 1200);
  const a = iq.find((e) => e.method === "answerInlineQuery");
  assert.ok(a && a.body.results.length > 0, "tugma chegarasi inline qidiruvni ham to'xtatdi");
  // Xabarlar chegarasi: bitta ogohlantirish, keyin jim (bot o'zi flood qilmaydi)
  await exhaust(`tgMsg:${CHAT_X}`);
  const m1 = sentTo(await msg(CHAT_X, "montajchi"), CHAT_X);
  assert.equal(m1.length, 1);
  assert.match(texts(m1), /Juda ko'p so'rov/);
  assert.equal(sentTo(await msg(CHAT_X, "videograf"), CHAT_X).length, 0, "chegarada har xabarga javob qaytdi");
  // Inline chegarasi tugasa — bo'sh javob (xato emas)
  await exhaust(`tgInline:${CHAT_X}`);
  const iq2 = (await hook({ inline_query: { id: `iqy${RUN}`, from: from(CHAT_X), query: "a", offset: "" } }, 800)).find((e) => e.method === "answerInlineQuery");
  assert.ok(iq2 && iq2.body.results.length === 0, "inline chegarasida natija qaytdi");
});

test("majburiy obuna: a'zo bo'lmaganga darvoza; «a'zo emas» javobi keshlanadi; tugma va inline ham yopiq", { skip: !GATE && "TELEGRAM_REQUIRED_CHANNEL berilmagan (darvoza o'chiq)" }, async () => {
  await control({ memberOf: { [CHAT_G1]: "left" } });
  const first = await msg(CHAT_G1, "/kurslar");
  assert.match(texts(sentTo(first, CHAT_G1)), /obuna bo'ling/);
  assert.ok(buttons(first).includes("sub:check"), "«Tekshirish» tugmasi yo'q");
  assert.doesNotMatch(texts(first), /kurs/i, "darvoza ortidagi javob ham ketdi");
  const second = await msg(CHAT_G1, "salom");
  assert.match(texts(sentTo(second, CHAT_G1)), /obuna bo'ling/);
  // 30 soniya ichida Telegram'dan qayta so'ralmaydi (ilgari har xabar getChatMember chaqirardi)
  const asks = [...first, ...second].filter((e) => e.method === "getChatMember" && String(e.body?.user_id) === String(CHAT_G1));
  assert.equal(asks.length, 1, `getChatMember ${asks.length} marta chaqirildi`);
  // Tugma
  const pressed = await cb(CHAT_G1, "menu:help");
  assert.match(answers(pressed), /obuna bo'ling/);
  assert.doesNotMatch(texts(sentTo(pressed, CHAT_G1)), /nima qiladi/, "darvoza ortidagi yordam ochildi");
  // Inline: natija o'rniga botga o'tish tugmasi
  const iq = (await hook({ inline_query: { id: `iqg${RUN}`, from: from(CHAT_G1), query: "videograf", offset: "" } }, 800)).find((e) => e.method === "answerInlineQuery");
  assert.ok(iq && iq.body.results.length === 0 && iq.body.button?.start_parameter, "a'zo bo'lmaganga inline natija berildi");
});

test("majburiy obuna: to'xtatilgan /start payloadi «Tekshirish»dan keyin davom etadi", { skip: !GATE && "TELEGRAM_REQUIRED_CHANNEL berilmagan (darvoza o'chiq)" }, async () => {
  const gated = await msg(CHAT_G1, "/start reg");
  assert.match(texts(sentTo(gated, CHAT_G1)), /obuna bo'ling/);
  // Hali a'zo emas — «Tekshirish» yana darvozani ko'rsatadi
  assert.match(answers(await cb(CHAT_G1, "sub:check")), /Hali obuna bo'lmadingiz/);
  await control({ memberOf: { [CHAT_G1]: "member" } });
  const ok = await cb(CHAT_G1, "sub:check");
  assert.match(answers(ok), /Rahmat/);
  // Xush kelibsiz emas — aynan so'ralgan amal (ro'yxatdan o'tish) boshlanadi
  assert.ok(buttons(ok).includes("rg:role:client"), `payload davom etmadi: ${texts(ok).slice(0, 200)}`);
  await cb(CHAT_G1, "rg:cancel");
});

test("majburiy obuna: Telegram tekshira olmasa darvoza OCHIQ qoladi va adminga xabar ketadi", { skip: (!GATE && "TELEGRAM_REQUIRED_CHANNEL berilmagan (darvoza o'chiq)") || NEED_DB }, async () => {
  // Bot kanalda admin emas / ro'yxat yopiq → Telegram {ok:false} qaytaradi
  await control({ memberOf: { [CHAT_G2]: "error", [CHAT_G3]: "down" } });
  const a = sentTo(await msg(CHAT_G2, "/top"), CHAT_G2);
  assert.ok(a.length >= 1, "javob kelmadi");
  assert.doesNotMatch(texts(a), /obuna bo'ling/, "tekshiruv xatosida foydalanuvchi qulflandi (fail-closed)");
  // Telegram umuman javob bermadi (500)
  const b = sentTo(await msg(CHAT_G3, "/top"), CHAT_G3);
  assert.doesNotMatch(texts(b), /obuna bo'ling/);
  await settle(600);
  const alerts = await sql("select count(*) n from notifications where title = ?", ["Bot: majburiy obuna tekshiruvi ishlamayapti"]);
  assert.ok(Number(alerts[0].n) >= 1, "adminga ogohlantirish yozilmadi");
});

/* ------------------------------------------------------------------ */
/* «Telegram bilan kirish»: har doim tasdiq savoli                     */
/* ------------------------------------------------------------------ */

test("kirish havolasi (hisobsiz chat, ru): ro'yxatdan o'tadi, lekin kirish AVTOMATIK tasdiqlanmaydi — savol chiqadi", async () => {
  const { code, cookie: guest } = await loginRequest();
  const start = sentTo(await msg(CHAT_RU, `/start l_${code}`, "ru"), CHAT_RU);
  assert.match(texts(start), /Регистрация/);
  assert.ok(buttons(start).includes("rg:role:specialist"), "ro'yxat boshlanmadi");
  await cb(CHAT_RU, "rg:role:specialist", "ru");
  // Ism qo'lda (kirillcha — keyingi qidiruv testlari uchun), «shu qolsin» emas
  const afterName = await msg(CHAT_RU, "Алишер Синов", "ru");
  assert.ok(buttons(afterName).some((d) => d.startsWith("rg:grp:")), `ism qabul qilinmadi: ${texts(afterName).slice(0, 160)}`);
  await cb(CHAT_RU, "rg:grp:video", "ru");
  await cb(CHAT_RU, "rg:cat:videograf", "ru");
  await cb(CHAT_RU, "rg:exp:senior", "ru");
  await cb(CHAT_RU, "rg:reg:toshkent-shahri", "ru");
  const confirm = await msg(CHAT_RU, "+998 90 000 12 34", "ru");
  assert.ok(buttons(confirm).includes("rg:ok"));
  const done = await cb(CHAT_RU, "rg:ok", "ru");
  assert.match(texts(done), /Аккаунт создан/);
  // Kirish tasdig'i: odatdagi savol (qurilma, ogohlantirish, Ha/Yo'q) — avtomatik «tasdiqlandi» YO'Q
  assert.ok(buttons(done).includes(`lg:ok:${code}`) && buttons(done).includes(`lg:no:${code}`), "tasdiq savoli chiqmadi");
  assert.match(texts(done), /Устройство/);
  assert.doesNotMatch(texts(done), /Вход подтверждён/, "kirish avtomatik tasdiqlandi");
  assert.equal(await loginStatus(guest), "pending", "brauzer tomonida so'rov tasdiqlangan bo'lib chiqdi");
  // Foydalanuvchi o'zi tasdiqlaydi → brauzer «confirm» oladi
  const yes = await cb(CHAT_RU, `lg:ok:${code}`, "ru");
  assert.match(texts(yes), /Вход подтверждён/);
  assert.equal(await loginStatus(guest), "confirm");
});

test("kirish havolasi (uzilgan hisob): qayta ulanadi, lekin tasdiq baribir so'raladi; «Yo'q» — rad etadi", async () => {
  // /stop — chat uziladi; begona odam yuborgan l_<kod> havolasi bir bosishda kirishni tasdiqlab qo'ymasligi kerak
  await msg(CHAT_RU, "/stop", "ru");
  const { code, cookie: guest } = await loginRequest();
  const evs = sentTo(await msg(CHAT_RU, `/start l_${code}`, "ru"), CHAT_RU);
  assert.match(texts(evs), /уже привязаны/, `hisob qayta ulanmadi: ${texts(evs).slice(0, 200)}`);
  assert.ok(buttons(evs).includes(`lg:ok:${code}`), "qayta ulangach tasdiq savoli chiqmadi");
  assert.equal(await loginStatus(guest), "pending", "qayta ulanish kirishni avtomatik tasdiqladi");
  const no = await cb(CHAT_RU, `lg:no:${code}`, "ru");
  assert.match(texts(no), /отклон/i);
  assert.equal(await loginStatus(guest), "denied");
});

test("kirish so'rovi eskirsa: «tasdiqlandi» deyilmaydi — eskirgani aytiladi; darvoza ro'yxat qadamlarini to'xtatmaydi", { skip: NEED_DB }, async () => {
  // Kanalga a'zo EMAS chat: saytdan boshlangan kirish havolasi va ro'yxat qadamlari (tugma, matn) darvozadan tashqari
  if (GATE) await control({ memberOf: { [CHAT_L]: "left" } });
  const { code, cookie: guest } = await loginRequest();
  const start = await msg(CHAT_L, `/start l_${code}`);
  assert.ok(buttons(start).includes("rg:role:client"));
  await cb(CHAT_L, "rg:role:client");
  await cb(CHAT_L, "rg:name:tg");
  await msg(CHAT_L, "⏭ O'tkazib yuborish");
  // Savol-javob cho'zilib ketdi — so'rov muddati o'tdi
  await sql("update login_requests set expires_at = 1 where code = ?", [code]);
  const done = await cb(CHAT_L, "rg:ok");
  assert.match(texts(done), /Hisob ochildi/);
  assert.match(texts(done), /eskirgan/, "eskirgan so'rov haqida aytilmadi");
  assert.doesNotMatch(texts(done), /Kirish tasdiqlandi|kirish tasdiqlandi/, "eskirgan so'rov «tasdiqlandi» deb ko'rsatildi");
  assert.ok(!buttons(done).some((d) => d.startsWith("lg:")), "eskirgan so'rovga tasdiq tugmasi chiqdi");
  assert.equal(await loginStatus(guest), "expired");
  // Mavjud bo'lmagan kod bilan tugma — «eskirgan»
  assert.match(answers(await cb(CHAT_L, "lg:ok:000000")), /eskirgan/);
  // Ro'yxat tugagach a'zo bo'lmagan chat yana darvoza ortida (istisno faqat oqimning o'zi uchun edi)
  if (GATE) assert.match(texts(await msg(CHAT_L, "/kurslar")), /obuna bo'ling/);
});

test("ro'yxat: «shu qolsin» faqat ismga o'xshagan Telegram nomiga taklif qilinadi; yopilgan oqim klaviaturasi qidiruvga ketmaydi", async () => {
  if (GATE) await control({ memberOf: { [CHAT_G4]: "member" } });
  // Telegram nomi havola/@ — «shu qolsin» tugmasi chiqmaydi, eski sessiyadagi tugma ham qabul qilinmaydi
  const bad = { id: CHAT_G4, is_bot: false, first_name: "t.me/reklama", last_name: "@spam", language_code: "uz" };
  await hook({ message: { message_id: upd, from: bad, chat: { id: CHAT_G4, type: "private" }, date: 1, text: "/royxat" } });
  const ask = await hook({ callback_query: { id: String(upd), from: bad, data: "rg:role:client", message: { message_id: 4242, chat: { id: CHAT_G4, type: "private" }, text: "..." } } });
  assert.ok(!buttons(ask).includes("rg:name:tg"), "yaroqsiz Telegram nomi ism sifatida taklif qilindi");
  const forced = await hook({ callback_query: { id: String(upd), from: bad, data: "rg:name:tg", message: { message_id: 4242, chat: { id: CHAT_G4, type: "private" }, text: "..." } } });
  assert.match(texts(forced), /2–60 belgi/);
  // Telefon qadamigacha borib, bekor qilamiz — klaviatura olib tashlanadi
  await msg(CHAT_G4, "Gulnoza Sinova");
  const cancelled = await cb(CHAT_G4, "rg:cancel");
  assert.ok(cancelled.some((e) => e.body?.reply_markup?.remove_keyboard), "bekor qilinganda «Raqamni ulashish» klaviaturasi olib tashlanmadi");
  // Qolib ketgan tugma bosilsa — qidiruv emas, tushuntirish
  const stray = sentTo(await msg(CHAT_G4, "⏭ O'tkazib yuborish"), CHAT_G4);
  assert.match(texts(stray), /yopilgan/);
  assert.doesNotMatch(texts(stray), /topilmadi|ijodkorlar/);
});

test("bloklangan hisob: botdagi o'qish buyruqlari ham yopiq; tushunilmaydigan xabar turiga javob beriladi", { skip: NEED_DB }, async () => {
  const uid = (await sql("select id from users where email = ?", [`tg${CHAT_RU}@telegram.local`]))[0]?.id;
  assert.ok(uid, "test hisobi topilmadi");
  await sql("update users set is_banned = 1 where id = ?", [uid]);
  try {
    for (const c of ["/kontaktlarim", "/buyurtmalarim", "/profil", "/kurslarim", "/xabarlar"]) {
      const evs = sentTo(await msg(CHAT_RU, c, "ru"), CHAT_RU);
      assert.match(texts(evs), /заблокирован/, `${c} bloklangan hisobga javob berdi: ${texts(evs).slice(0, 120)}`);
    }
    assert.match(answers(await cb(CHAT_RU, "st:orders", "ru")), /заблокирован/);
  } finally {
    await sql("update users set is_banned = 0 where id = ?", [uid]);
  }
  // Ovozli xabar / stiker — bot jim qolmaydi
  const voice = sentTo(await hook({ message: { message_id: upd, from: from(CHAT_UZ), chat: { id: CHAT_UZ, type: "private" }, date: 1, voice: { file_id: "v1", duration: 3 } } }), CHAT_UZ);
  assert.match(texts(voice), /tushunmayman/);
});

test("bot orqali post: rasm → tanlov tugmalari → bekor", async () => {
  const evs = sentTo(await hook({ message: { message_id: upd, from: from(CHAT_UZ), chat: { id: CHAT_UZ, type: "private" }, date: 1, caption: "Sinov izohi", photo: [{ file_id: "ph_s", file_size: 500, width: 90, height: 90 }, { file_id: "ph_big", file_size: 90000, width: 1280, height: 960 }] } }), CHAT_UZ);
  const b = buttons(evs);
  // Tugmalar FAYLGA bog'langan: `pst:<amal>:<nonce>`
  const pick = (a) => b.find((d) => new RegExp(`^pst:${a}:[a-f0-9]{6}$`).test(d));
  assert.ok(pick("ok") && pick("story") && pick("no"), `tugmalar: ${b.join(", ")}`);
  // Belgisiz (eski format) tugma hech narsa qilmaydi
  assert.match(texts((await cb(CHAT_UZ, "pst:ok")).filter((e) => e.method === "answerCallbackQuery")), /eskirgan/i);
  const no = await cb(CHAT_UZ, pick("no"));
  assert.match(texts(no), /bekor/i);
});

test("inline rejim: @bot so'z → ijodkor kartalari", async () => {
  const evs = await hook({ inline_query: { id: `iq${RUN}`, from: from(CHAT_UZ), query: "videograf", offset: "" } }, 1500);
  const a = evs.find((e) => e.method === "answerInlineQuery");
  assert.ok(a, "answerInlineQuery chaqirilmadi");
  assert.ok(Array.isArray(a.body.results) && a.body.results.length > 0, "natija yo'q");
  assert.equal(a.body.results[0].type, "article");
});

test("admin boti: ulash → /stat (trend) → /navbat → /shikoyatlar", { skip: !ADMIN_PASSWORD && !fs.existsSync(process.env.ADMIN_COOKIE_JAR || "/tmp/ad.jar") && "ADMIN_PASSWORD (yoki /tmp/ad.jar) berilmagan" }, async () => {
  cookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.ok(cookie, "admin kirishi muvaffaqiyatsiz (ADMIN_EMAIL/ADMIN_PASSWORD)");
  const r = await fetch(`${BASE}/api/telegram/link`, { method: "POST", headers: { "content-type": "application/json", origin: BASE, cookie } });
  const j = await r.json();
  assert.ok(j.ok && j.data?.url, `ulash kodi olinmadi: ${JSON.stringify(j).slice(0, 120)}`);
  const code = new URL(j.data.url).searchParams.get("start");
  assert.ok(code, "start kodi yo'q");
  const linked = sentTo(await msg(CHAT_ADMIN, `/start ${code}`, "uz"), CHAT_ADMIN);
  assert.match(texts(linked), /ulangan|ulandi|xush kelibsiz/i);
  const stat = sentTo(await msg(CHAT_ADMIN, "/stat", "uz"), CHAT_ADMIN);
  assert.match(texts(stat), /Statistika/);
  assert.match(texts(stat), /Trend/);
  assert.ok(buttons(stat).includes("adm:stat:7d"));
  const queue = sentTo(await msg(CHAT_ADMIN, "/navbat", "uz"), CHAT_ADMIN);
  assert.match(texts(queue), /Tasdiq navbati/);
  const rep = sentTo(await msg(CHAT_ADMIN, "/shikoyatlar", "uz"), CHAT_ADMIN);
  assert.match(texts(rep), /shikoyat/i);
  // Uzish — chat bo'shaydi (after() adminning avvalgi chatini qaytaradi)
  const stop = sentTo(await msg(CHAT_ADMIN, "/stop", "uz"), CHAT_ADMIN);
  assert.ok(stop.length >= 1);
});

test("admin boti (ru): language_code=ru → /stat va /admin ruscha", { skip: !ADMIN_PASSWORD && !fs.existsSync(process.env.ADMIN_COOKIE_JAR || "/tmp/ad.jar") && "ADMIN_PASSWORD (yoki /tmp/ad.jar) berilmagan" }, async () => {
  cookie = cookie || (await login(ADMIN_EMAIL, ADMIN_PASSWORD));
  assert.ok(cookie, "admin kirishi muvaffaqiyatsiz");
  const r = await fetch(`${BASE}/api/telegram/link`, { method: "POST", headers: { "content-type": "application/json", origin: BASE, cookie } });
  const j = await r.json();
  const code = j.data?.url ? new URL(j.data.url).searchParams.get("start") : null;
  assert.ok(code, "start kodi yo'q");
  sentTo(await msg(CHAT_ADMIN, `/start ${code}`, "ru"), CHAT_ADMIN);
  const stat = sentTo(await msg(CHAT_ADMIN, "/stat", "ru"), CHAT_ADMIN);
  assert.match(texts(stat), /Статистика/, "ruscha sarlavha yo'q");
  assert.match(texts(stat), /Тренд/);
  assert.doesNotMatch(texts(stat), /Foydalanuvchilar|Navbat \(/, "o'zbekcha matn qolgan");
  assert.ok(buttons(stat).includes("adm:stat:7d"));
  const menu = sentTo(await msg(CHAT_ADMIN, "/admin", "ru"), CHAT_ADMIN);
  assert.match(texts(menu), /Админ-меню/);
  // Tugma bosilganda ham ruscha (adm:stat:7d → xabar tahrirlanadi)
  const edited = await cb(CHAT_ADMIN, "adm:stat:7d", "ru");
  assert.match(texts(edited.filter((e) => e.method === "editMessageText" || e.method === "sendMessage")), /Статистика — 7 дней/);
  const stop = sentTo(await msg(CHAT_ADMIN, "/stop", "ru"), CHAT_ADMIN);
  assert.ok(stop.length >= 1);
});

/* ------------------------------------------------------------------ */
/* Bildirishnomalar: tugmalar, kanallar, yuborish navbati              */
/* ------------------------------------------------------------------ */

test("demo mijoz: Telegramni ulaydi va test mutaxassisiga «har post» obunasi (keyingi testlarning qarshi tomoni)", { skip: NEED_DB }, async () => {
  const cookieCl = await clientSession();
  assert.ok(cookieCl, "demo mijoz kirishi muvaffaqiyatsiz (DEMO_PASSWORD yoki /tmp/cl.jar)");
  const cid = (await sql("select id from users where email = ?", [CLIENT_EMAIL]))[0]?.id;
  assert.ok(cid, "demo mijoz bazada yo'q (seed)");
  // Toza holat: til/sozlama standart, oldingi ishga tushirishlardan qolgan chegaralar yo'q
  await sql("update users set lang = null, notify_prefs = '{}' where id = ?", [cid]);
  await sql("delete from rate_limits where key like ?", [`%:${cid}`]);
  const linked = await linkChat(cookieCl, CHAT_CLIENT);
  assert.match(texts(linked), /ulangan|ulandi/i);
  const spUser = await userIdByChat(CHAT_UZ);
  assert.ok(spUser, "test mutaxassisi topilmadi (ro'yxatdan o'tish testi o'tmagan)");
  const f = await api(cookieCl, "POST", `/api/follow/${spUser}`);
  assert.equal(f.status, 200, JSON.stringify(f.json).slice(0, 200));
  const lvl = await api(cookieCl, "POST", `/api/follow/${spUser}/notify`, { level: "all" });
  assert.equal(lvl.status, 200, JSON.stringify(lvl.json).slice(0, 200));
  await settle(900);
});

test("yangi buyurtma: mutaxassisga «Qabul qilish / Rad etish» tugmalari bilan keladi va tugma buyurtmani qabul qiladi", { skip: NEED_DB }, async () => {
  fresh();
  const title = `Sinov buyurtma ${RUN}`;
  const id = await placeOrder(title);
  const hasCard = (all) => sentTo(all, CHAT_UZ).some((e) => String(e.body?.text ?? "").includes(title));
  const card = sentTo(await waitFor(hasCard), CHAT_UZ).filter((e) => String(e.body?.text ?? "").includes(title));
  assert.equal(card.length, 1, `buyurtma xabari bitta bo'lishi kerak (keldi: ${card.length})`);
  const b = buttons(card);
  assert.ok(b.includes(`ord:ok:${id}`) && b.includes(`ord:no:${id}`), `amal tugmalari yo'q: ${b.join(", ")}`);
  const gotClient = (all) => sentTo(all, CHAT_CLIENT).some((e) => /qabul qildi/.test(e.body?.text ?? ""));
  const acc = await collect(await cb(CHAT_UZ, `ord:ok:${id}`), gotClient);
  assert.match(texts(sentTo(acc, CHAT_UZ)), /Qabul qilindi/);
  assert.equal((await sql("select status from orders where id = ?", [id]))[0].status, "accepted");
  // Mijozga «qabul qildi» xabari — amal tugmalarisiz (u mutaxassis emas), faqat ochish tugmasi
  const toClient = sentTo(acc, CHAT_CLIENT).filter((e) => /qabul qildi/.test(e.body?.text ?? ""));
  assert.equal(toClient.length, 1, "mijozga bildirishnoma kelmadi");
  assert.ok(!buttons(toClient).some((d) => d.startsWith("ord:")), "mijozga amal tugmalari ketmasligi kerak");
});

test("bot orqali post joylash: post yaratiladi va obunachi Telegramda «yangi post» xabarini oladi (skipMail faqat emailni o'chiradi)", { skip: NEED_DB }, async () => {
  const caption = `Sinov posti ${RUN}`;
  const prompt = sentTo(await hook({ message: { message_id: upd, from: from(CHAT_UZ), chat: { id: CHAT_UZ, type: "private" }, date: 1, caption, photo: [{ file_id: "ph_big2", file_size: 90000, width: 1280, height: 960 }] } }), CHAT_UZ);
  const okBtn = buttons(prompt).find((d) => d.startsWith("pst:ok"));
  assert.ok(okBtn, `«Post qilish» tugmasi yo'q: ${buttons(prompt).join(", ")}`);
  const done = (all) => all.some((e) => /Post joylandi/.test(String(e.body?.text ?? ""))) && sentTo(all, CHAT_CLIENT).some((e) => /yangi post joyladi/.test(String(e.body?.text ?? "")));
  const evs = await collect(await cb(CHAT_UZ, okBtn), done, 25_000);
  assert.ok(evs.some((e) => /Post joylandi/.test(String(e.body?.text ?? ""))), `post joylanmadi: ${texts(evs).slice(0, 300)}`);
  const spUser = await userIdByChat(CHAT_UZ);
  const posts = await sql("select id from posts where author_id = ? and body = ?", [spUser, caption]);
  assert.equal(posts.length, 1, "post bazada bitta bo'lishi kerak");
  const note = sentTo(evs, CHAT_CLIENT).filter((e) => /yangi post joyladi/.test(String(e.body?.text ?? "")));
  assert.equal(note.length, 1, "obunachiga Telegram xabari bitta kelishi kerak (ilgari skipMail uni butunlay o'chirardi)");
});

test("bot orqali post: eski taklif tugmasi va ikki marta bosish ikkinchi post yaratmaydi; limit tugasa story; izoh qirqiladi; albom — bitta taklif", { skip: NEED_DB }, async () => {
  const spUser = await userIdByChat(CHAT_UZ);
  const count = async (table) => Number((await sql(`select count(*) n from ${table} where author_id = ?`, [spUser]))[0].n);
  const before = await count("posts");
  // 1) Ikki fayl ketma-ket: birinchi taklif ostidagi tugma ikkinchi faylni joylamaydi
  const a = buttons(sentTo(await hook(photoMsg(CHAT_UZ, "ph_a", { caption: "A fayl" })), CHAT_UZ)).find((d) => d.startsWith("pst:ok:"));
  const b = buttons(sentTo(await hook(photoMsg(CHAT_UZ, "ph_b", { caption: `Ikki bosish ${RUN}` })), CHAT_UZ)).find((d) => d.startsWith("pst:ok:"));
  assert.ok(a && b && a !== b, "har faylning tugmasi o'ziga xos bo'lishi kerak");
  assert.match(answers(await cb(CHAT_UZ, a)), /eskirgan/);
  assert.equal(await count("posts"), before, "eski taklif tugmasi post yaratdi");
  // 2) Bir vaqtda ikki marta bosish (yoki Telegram qayta yuborishi): bitta post
  fresh();
  await Promise.all([rawHook(cbUpdate(CHAT_UZ, b)), rawHook(cbUpdate(CHAT_UZ, b))]);
  const evs = await waitFor((all) => all.some((e) => /Post joylandi/.test(String(e.body?.text ?? ""))), 25_000);
  assert.ok(evs.some((e) => /Post joylandi/.test(String(e.body?.text ?? ""))), `post joylanmadi: ${texts(evs).slice(0, 300)}`);
  await settle(1500);
  assert.equal(await count("posts"), before + 1, "ikki marta bosish ikkita post yaratdi");
  // 3) Haftalik post limiti tugadi (bepul tarif): tushuntirish, sessiya saqlanadi — o'sha faylni story qilib joylash mumkin
  const long = `Story ${RUN} ${"x".repeat(300)}`;
  const prompt = sentTo(await hook(photoMsg(CHAT_UZ, "ph_c", { caption: long })), CHAT_UZ);
  const okBtn = buttons(prompt).find((d) => d.startsWith("pst:ok:"));
  const storyBtn = buttons(prompt).find((d) => d.startsWith("pst:story:"));
  const limited = await cb(CHAT_UZ, okBtn);
  assert.match(answers(limited), /limiti tugadi/, `limit xabari kelmadi: ${answers(limited)}`);
  assert.equal(await count("posts"), before + 1);
  const stories = await count("stories");
  const st = await collect(await cb(CHAT_UZ, storyBtn), (all) => all.some((e) => /Story joylandi/.test(String(e.body?.text ?? ""))), 25_000);
  assert.ok(st.some((e) => /Story joylandi/.test(String(e.body?.text ?? ""))), `story joylanmadi: ${texts(st).slice(0, 300)}`);
  assert.equal(await count("stories"), stories + 1);
  const cap = String((await sql("select caption from stories where author_id = ? order by created_at desc limit 1", [spUser]))[0].caption ?? "");
  assert.ok(cap.length > 0 && cap.length <= 220, `story izohi sayt chegarasidan uzun: ${cap.length}`);
  // 4) Albom (2 ta rasm bitta xabarda): bitta taklif, albom haqida eslatma
  fresh();
  await rawHook(photoMsg(CHAT_UZ, "ph_al1", { caption: "Albom", media_group_id: `alb${RUN}` }));
  await rawHook(photoMsg(CHAT_UZ, "ph_al2", { media_group_id: `alb${RUN}` }));
  const album = sentTo(await settle(900), CHAT_UZ).filter((e) => e.method === "sendMessage");
  assert.equal(album.length, 1, `albomga ${album.length} ta javob keldi`);
  assert.match(texts(album), /Albomdan/);
  await cb(CHAT_UZ, buttons(album).find((d) => d.startsWith("pst:no:")));
});

test("yuborish navbati: 429 kelsa retry_after kutib, xabarni qayta yuboradi (tashlab yubormaydi)", async () => {
  await control({ flood: { times: 1, retryAfter: 1 } });
  const t0 = Date.now();
  const evs = sentTo(await msg(CHAT_UZ, "/yordam"), CHAT_UZ).filter((e) => e.method === "sendMessage");
  await control({ flood: { times: 0 } });
  assert.ok(evs.some((e) => e.code === 429), "429 javobi jurnalda yo'q (soxta API flood rejimi ishlamadi)");
  assert.ok(evs.some((e) => e.ok && /nima qiladi/.test(e.body.text)), "429 dan keyin xabar qayta yuborilmadi");
  assert.ok(Date.now() - t0 >= 1000, "retry_after kutilmadi");
});

test("botni bloklagan chat: 403 → belgilanadi va keyingi bildirishnomaga urinilmaydi; my_chat_member / xabar kelsa tiklanadi", { skip: NEED_DB }, async () => {
  const rejected = (all) => all.some((e) => e.method === "sendMessage" && String(e.body?.chat_id) === String(CHAT_UZ) && /Rad etildi/.test(e.body.text ?? ""));
  const toClient = (all) => sentTo(all, CHAT_CLIENT).filter((e) => e.method === "sendMessage" && /rad etdi/.test(e.body?.text ?? ""));
  const dead = async () => Number((await sql("select count(*) n from rate_limits where key = ?", [`tgDead:${CHAT_CLIENT}`]))[0].n);
  const rejectOrder = async (n) => {
    const id = await placeOrder(`Sinov blok ${n} ${RUN}`);
    await waitFor((all) => buttons(sentTo(all, CHAT_UZ)).includes(`ord:no:${id}`));
    const evs = await collect(await cb(CHAT_UZ, `ord:no:${id}`), rejected);
    // Mijoz bildirishnomasi javobdan keyin ketadi — jurnal tinchiguncha
    return [...evs, ...(await settle(1200))];
  };
  await control({ blocked: [String(CHAT_CLIENT)] });
  // 1) Bloklagan: yuborish 403 → chat «yetib bo'lmaydigan» deb belgilanadi
  const first = toClient(await rejectOrder(1));
  assert.equal(first.length, 1, "birinchi urinish bo'lishi kerak");
  assert.equal(first[0].code, 403);
  assert.equal(await dead(), 1, "chat belgilanmadi");
  // 2) Keyingi bildirishnoma: umuman urinilmaydi (har xabarda 403 yig'ilmaydi)
  assert.equal(toClient(await rejectOrder(2)).length, 0, "bloklagan chatga qayta urinildi");
  // 3) Blokdan chiqardi (my_chat_member: member) → belgi olinadi, xabar yana boradi
  await control({ blocked: [] });
  await hook({ my_chat_member: { chat: { id: CHAT_CLIENT, type: "private" }, from: from(CHAT_CLIENT), new_chat_member: { status: "member", user: { id: 111 } } } }, 500);
  const third = toClient(await rejectOrder(3));
  assert.equal(third.length, 1, "blokdan chiqqach xabar bormadi");
  assert.equal(third[0].ok, true);
  // 4) my_chat_member: kicked → yana belgilanadi; foydalanuvchining o'zi yozsa (xabar) — tiklanadi
  await hook({ my_chat_member: { chat: { id: CHAT_CLIENT, type: "private" }, from: from(CHAT_CLIENT), new_chat_member: { status: "kicked", user: { id: 111 } } } }, 500);
  assert.equal(await dead(), 1, "kicked belgilanmadi");
  await msg(CHAT_CLIENT, "/profil");
  await settle(600);
  assert.equal(await dead(), 0, "foydalanuvchi yozgach belgi olinmadi");
});

test("admin /elon: tugmalar qoralamaga bog'langan (eski ko'rinish yubormaydi); natijada haqiqiy yetkazilgan sonlar", { skip: ADMIN_SKIP || NEED_DB }, async () => {
  cookie = cookie || (await login(ADMIN_EMAIL, ADMIN_PASSWORD));
  assert.ok(cookie, "admin kirishi muvaffaqiyatsiz");
  await linkChat(cookie, CHAT_ADMIN);
  // Ikkinchi mijoz: chat ulangan, lekin botni bloklagan (yetkazilmaydi — «bloklagan» deb sanalishi kerak)
  const other = (await sql("select id from users where role = 'client' and is_banned = 0 and telegram_chat_id is null and email != ? limit 1", [CLIENT_EMAIL]))[0]?.id;
  const CHAT_DEAD = Number(`85${RUN}`);
  if (other) {
    await sql("update users set telegram_chat_id = ? where id = ?", [String(CHAT_DEAD), other]);
    created.tempChats.push(CHAT_DEAD);
    await control({ blocked: [String(CHAT_DEAD)] });
  }
  const a = sentTo(await msg(CHAT_ADMIN, `/elon Sinov A ${RUN} | Birinchi qoralama matni — bu yuborilmasligi kerak.`), CHAT_ADMIN);
  const oldBtn = buttons(a).find((d) => d.startsWith("bc:clients:"));
  assert.ok(oldBtn, `auditoriya tugmasi yo'q: ${buttons(a).join(", ")}`);
  const b = sentTo(await msg(CHAT_ADMIN, `/elon Sinov B ${RUN} | Ikkinchi qoralama matni — faqat shu ketishi mumkin.`), CHAT_ADMIN);
  const newBtn = buttons(b).find((d) => d.startsWith("bc:clients:"));
  assert.ok(newBtn && newBtn !== oldBtn, "har qoralamaning tugmasi o'ziga xos bo'lishi kerak");
  const count = async () => Number((await sql("select count(*) n from notifications where type = 'broadcast' and title like ?", [`Sinov % ${RUN}`]))[0].n);
  // Eski ko'rinishdagi va belgisiz (eski format) tugma — hech narsa yubormaydi
  assert.match(texts((await cb(CHAT_ADMIN, oldBtn)).filter((e) => e.method === "answerCallbackQuery")), /eskirgan/i);
  assert.match(texts((await cb(CHAT_ADMIN, "bc:clients")).filter((e) => e.method === "answerCallbackQuery")), /eskirgan/i);
  assert.equal(await count(), 0, "eski tugma e'lon yubordi");
  // To'g'ri tugma: avval javob, keyin yuborish; yakunda yetkazilgan/bloklagan sonlar
  const fin = (all) => all.some((e) => e.method === "editMessageText" && /yetkazildi \d+/.test(e.body?.text ?? "") && !/navbatda/.test(e.body.text));
  const evs = await collect(await cb(CHAT_ADMIN, newBtn), fin, 30_000);
  assert.match(texts(evs.filter((e) => e.method === "answerCallbackQuery")), /Yuborilmoqda/);
  const last = evs.filter((e) => e.method === "editMessageText" && /yetkazildi/.test(e.body?.text ?? "")).pop();
  assert.ok(last, `yakuniy hisobot kelmadi: ${texts(evs).slice(0, 300)}`);
  assert.match(last.body.text, /Sinov B/);
  // Kutilgan son bazadan: chat ulangan mijozlar (demo mijoz + shu runda botda ro'yxatdan o'tganlar), bloklaganidan tashqari
  const linkedClients = Number((await sql("select count(*) n from users where role = 'client' and is_banned = 0 and telegram_chat_id is not null"))[0].n);
  const delivered = linkedClients - (other ? 1 : 0);
  assert.match(last.body.text, new RegExp(`Telegram \\(${linkedClients}\\)`), `ulangan chatlar soni noto'g'ri: ${last.body.text}`);
  assert.match(last.body.text, new RegExp(`yetkazildi ${delivered}\\b`), `yetkazilgan son noto'g'ri (kutilgan ${delivered}): ${last.body.text}`);
  if (other) assert.match(last.body.text, /bloklagan 1\b/, `bloklagan son noto'g'ri: ${last.body.text}`);
  assert.ok((await count()) >= 1, "e'lon saytga yozilmadi");
  // Mijoz Telegramida e'lon (B qoralama), A — hech qayerda yo'q
  const all = [...evs, ...(await settle(600))];
  assert.ok(sentTo(all, CHAT_CLIENT).some((e) => /Sinov B/.test(e.body?.text ?? "")), "e'lon mijozga yetib bormadi");
  assert.equal(Number((await sql("select count(*) n from notifications where title = ?", [`Sinov A ${RUN}`]))[0].n), 0);
  // Ikkinchi marta bosish — qayta yubormaydi
  const before2 = await count();
  await cb(CHAT_ADMIN, newBtn);
  assert.equal(await count(), before2, "ikkinchi bosishda e'lon qayta ketdi");
  await control({ blocked: [] });
  await msg(CHAT_ADMIN, "/stop");
});

test("admin boti: /narx bo'shliqli summani to'g'ri o'qiydi; /user kirillcha ism va telefon bo'yicha topadi; faol davr qayta bosilsa takror xabar yo'q", { skip: ADMIN_SKIP || NEED_DB }, async () => {
  cookie = cookie || (await login(ADMIN_EMAIL, ADMIN_PASSWORD));
  assert.ok(cookie, "admin kirishi muvaffaqiyatsiz");
  await linkChat(cookie, CHAT_ADMIN);
  const price = async () => {
    const v = (await sql("select value from platform_settings where key = 'contactPriceMiddle'"))[0]?.value;
    return v == null ? null : Number(JSON.parse(String(v)));
  };
  const prev = await price();
  try {
    // «60 000» — ilgari faqat «60» o'qilib, narx 60 so'm bo'lib qolardi
    assert.match(texts(sentTo(await msg(CHAT_ADMIN, "/narx middle 60 000"), CHAT_ADMIN)), /Saqlandi/);
    assert.equal(await price(), 60000);
    // 1 000 so'mdan kichik (0 dan tashqari) — rad etiladi
    assert.match(texts(sentTo(await msg(CHAT_ADMIN, "/narx middle 60"), CHAT_ADMIN)), /Format/);
    assert.equal(await price(), 60000, "juda kichik narx saqlandi");
  } finally {
    if (prev == null) await sql("delete from platform_settings where key = 'contactPriceMiddle'");
    else await sql("update platform_settings set value = ? where key = 'contactPriceMiddle'", [JSON.stringify(prev)]);
  }
  // Kirillcha ism kichik harf bilan (SQLite lower() kirillchani kichraytirmaydi) va shifrlangan telefon bo'yicha
  assert.match(texts(sentTo(await msg(CHAT_ADMIN, "/user алишер"), CHAT_ADMIN)), /Алишер Синов/, "kirillcha ism topilmadi");
  assert.match(texts(sentTo(await msg(CHAT_ADMIN, "/user 90 000 12 34"), CHAT_ADMIN)), /Алишер Синов/, "telefon bo'yicha topilmadi");
  // Oddiy foydalanuvchi qidiruvi ham kirillcha ismni topadi
  assert.match(texts(sentTo(await msg(CHAT_UZ, "алишер синов"), CHAT_UZ)), /Алишер Синов/, "bot qidiruvi kirillcha ismni topmadi");
  // Faol davr qayta bosildi: Telegram «message is not modified» deydi — yangi xabar yuborilmaydi
  await control({ fail: { editMessageText: "message is not modified: specified new message content and reply markup are exactly the same" } });
  const same = await cb(CHAT_ADMIN, "adm:stat:today");
  await control({ fail: { editMessageText: null } });
  assert.equal(sentTo(same, CHAT_ADMIN).filter((e) => e.method === "sendMessage").length, 0, "statistika ikkinchi marta yangi xabar bo'lib ketdi");
  // Qo'lda o'tkazma tugmasi: mavjud bo'lmagan hisob — aniq javob (tugma javobsiz qolmaydi)
  assert.match(answers(await cb(CHAT_ADMIN, "mp:ok:s:yoq-hisob")), /topilmadi/);
  await msg(CHAT_ADMIN, "/stop");
});

test("chek: PDF qabul qilinadi; rad etish xabari hisob turiga mos; eski hisobda mijoz rasmi — chek, mutaxassisdan «chekmi yoki post?» so'raladi", { skip: ADMIN_SKIP || NEED_DB }, async () => {
  cookie = cookie || (await login(ADMIN_EMAIL, ADMIN_PASSWORD));
  assert.ok(cookie, "admin kirishi muvaffaqiyatsiz");
  await linkChat(cookie, CHAT_ADMIN);
  const cid = (await sql("select id from users where email = ?", [CLIENT_EMAIL]))[0].id;
  const spUser = await userIdByChat(CHAT_UZ);
  const sp = (await sql("select id from specialists where user_id = ?", [spUser]))[0].id;
  const sp2 = (await sql("select s.id from specialists s join users u on u.id = s.user_id where u.email = ?", [`tg${CHAT_RU}@telegram.local`]))[0]?.id;
  assert.ok(sp2, "ikkinchi test mutaxassisi topilmadi");
  const startedAt = Date.now();
  const lastInvoice = async (userId, state) => (await sql("select id, state, meta from subscription_invoices where user_id = ? and state = ? order by created_at desc limit 1", [userId, state]))[0];
  const chek = (all, chat) => sentTo(all, chat).some((e) => /Chek qabul qilindi/.test(e.body?.text ?? ""));
  const restoreCard = await withManualCard();
  try {
    // 1) Mijoz botda kontakt xaridini boshlaydi → karta → PDF chek
    const offer = sentTo(await msg(CHAT_CLIENT, `/start b_x_${sp}`), CHAT_CLIENT);
    assert.ok(buttons(offer).includes(`cx:m:${sp}`), `«Karta o'tkazmasi» tugmasi yo'q: ${texts(offer).slice(0, 200)}`);
    assert.match(texts(sentTo(await cb(CHAT_CLIENT, `cx:m:${sp}`), CHAT_CLIENT)), /8600 1111 2222 3333/);
    const inv1 = (await lastInvoice(cid, "created")).id;
    const pdf = await collect(await hook({ message: { message_id: upd, from: from(CHAT_CLIENT), chat: { id: CHAT_CLIENT, type: "private" }, date: 1, document: { file_id: "pdf_chek", mime_type: "application/pdf", file_size: 300, file_name: "chek.pdf" } } }), (all) => chek(all, CHAT_CLIENT) && buttons(sentTo(all, CHAT_ADMIN)).includes(`mp:no:s:${inv1}`));
    assert.ok(chek(pdf, CHAT_CLIENT), `PDF chek qabul qilinmadi: ${texts(sentTo(pdf, CHAT_CLIENT)).slice(0, 200)}`);
    const row1 = (await sql("select state, meta from subscription_invoices where id = ?", [inv1]))[0];
    assert.equal(row1.state, "pending");
    assert.match(String(row1.meta), /\.pdf/, "chek manzili hisobga yozilmadi");
    assert.ok(buttons(sentTo(pdf, CHAT_ADMIN)).includes(`mp:ok:s:${inv1}`), "adminga tasdiqlash tugmalari kelmadi");
    // 2) Admin rad etadi: mijozga KONTAKT xabari (ilgari har doim «Obuna o'tkazmasi…» va obuna sahifasi ketardi)
    const rej = await collect(await cb(CHAT_ADMIN, `mp:no:s:${inv1}`), (all) => sentTo(all, CHAT_CLIENT).some((e) => /tasdiqlanmadi/.test(e.body?.text ?? "")));
    const note = sentTo(rej, CHAT_CLIENT).filter((e) => /tasdiqlanmadi/.test(e.body?.text ?? ""));
    assert.match(texts(note), /Kontakt o'tkazmasi tasdiqlanmadi/);
    assert.doesNotMatch(texts(note), /Obuna/);
    assert.ok(buttons(note).some((u) => u.includes("kontakt") && u.includes("tolov")), `havola kontakt to'loviga olib bormaydi: ${buttons(note).join(", ")}`);
    // 3) Mijoz: 2 soatdan eski ochiq hisob — rasm baribir chek (ilgari «post faqat mutaxassislar uchun» deyilardi)
    await cb(CHAT_CLIENT, `cx:m:${sp}`);
    const inv2 = (await lastInvoice(cid, "created")).id;
    await sql("update subscription_invoices set created_at = ? where id = ?", [Date.now() - 3 * 3_600_000, inv2]);
    const late = await collect(await hook(photoMsg(CHAT_CLIENT, "ph_late")), (all) => chek(all, CHAT_CLIENT));
    assert.ok(chek(late, CHAT_CLIENT), `kech yuborilgan chek qabul qilinmadi: ${texts(sentTo(late, CHAT_CLIENT)).slice(0, 200)}`);
    assert.equal((await sql("select state from subscription_invoices where id = ?", [inv2]))[0].state, "pending");
    // 4) Mutaxassis: eski ochiq hisob + rasm → so'raladi (bank skrinshoti bir bosishda ommaviy post bo'lib ketmasin)
    await cb(CHAT_UZ, `cx:m:${sp2}`);
    const inv3 = (await lastInvoice(spUser, "created")).id;
    await sql("update subscription_invoices set created_at = ? where id = ?", [Date.now() - 3 * 3_600_000, inv3]);
    const posts = Number((await sql("select count(*) n from posts where author_id = ?", [spUser]))[0].n);
    const ask = sentTo(await hook(photoMsg(CHAT_UZ, "ph_ask")), CHAT_UZ);
    assert.match(texts(ask), /chekimi yoki post/i);
    const rc = buttons(ask).find((d) => d.startsWith("pst:rc:"));
    assert.ok(rc && buttons(ask).some((d) => d.startsWith("pst:ok:")), `tanlov tugmalari yo'q: ${buttons(ask).join(", ")}`);
    const asReceipt = await collect(await cb(CHAT_UZ, rc), (all) => chek(all, CHAT_UZ));
    assert.ok(chek(asReceipt, CHAT_UZ), "«Bu to'lov cheki» chekni biriktirmadi");
    assert.equal((await sql("select state from subscription_invoices where id = ?", [inv3]))[0].state, "pending");
    assert.equal(Number((await sql("select count(*) n from posts where author_id = ?", [spUser]))[0].n), posts, "chek post bo'lib joylandi");
    // 5) Ochiq to'lovsiz PDF — tushuntirish (jim qolmaydi)
    const stray = sentTo(await hook({ message: { message_id: upd, from: from(CHAT_RU, "ru"), chat: { id: CHAT_RU, type: "private" }, date: 1, document: { file_id: "pdf_x", mime_type: "application/pdf", file_size: 300 } } }), CHAT_RU);
    assert.match(texts(stray), /PDF/);
  } finally {
    await restoreCard();
    await sql("delete from subscription_invoices where user_id in (?, ?) and created_at >= ? - 4 * 3600000 and json_extract(meta, '$.kind') = 'contact'", [cid, spUser, startedAt]);
    await settle(800);
    await msg(CHAT_ADMIN, "/stop");
  }
});

test("kurs xaridi botda: promokod havolada saqlanadi; Telegram to'lovi ochilmasa aytiladi; pul yechilib kirish ochilmasa adminga xabar", { skip: ADMIN_SKIP || NEED_DB }, async () => {
  cookie = cookie || (await login(ADMIN_EMAIL, ADMIN_PASSWORD));
  assert.ok(cookie, "admin kirishi muvaffaqiyatsiz");
  await linkChat(cookie, CHAT_ADMIN);
  const { course, mentor } = await ensureCourse();
  const cid = (await sql("select id from users where email = ?", [CLIENT_EMAIL]))[0].id;
  // Promokod: `_` va `-` bilan, 17 belgi — ilgari havolaga sig'may (≤12, faqat harf/raqam) chegirma jimgina yo'qolardi
  const promo = `SINOV_KOD-${RUN}`;
  await sql("insert into promo_codes (id, mentor_id, code, percent) values (?, ?, ?, 20)", [crypto.randomUUID(), mentor, promo]);
  const restoreCard = await withManualCard();
  const invState = async (id) => (await sql("select state from subscription_invoices where id = ?", [id]))[0]?.state;
  try {
    const link = await api(await clientSession(), "POST", "/api/mentorlik/tolov/telegram", { type: "course", id: course, promo });
    assert.equal(link.status, 200, JSON.stringify(link.json).slice(0, 200));
    const payload = new URL(link.json.data.url).searchParams.get("start");
    assert.equal(payload, `b_c_${course}_${promo}`);
    assert.match(payload, /^[A-Za-z0-9_-]{1,64}$/, "havola Telegram start parametri belgilariga mos emas");
    const offer = sentTo(await msg(CHAT_CLIENT, `/start ${payload}`), CHAT_CLIENT);
    assert.match(texts(offer), /−20%/, `promokod qo'llanmadi: ${texts(offer).slice(0, 200)}`);
    assert.match(texts(offer), /40[\s  ]?000/);
    // Eski havolalar (nuqta ajratgich) ham ishlaydi
    assert.match(texts(sentTo(await msg(CHAT_CLIENT, `/start b_c_${course}.${promo}`), CHAT_CLIENT)), /−20%/);
    const manual = buttons(offer).find((d) => d.startsWith("bp:m:c:"));
    assert.ok(manual && manual.length <= 64, `callback_data 64 baytdan oshdi: ${manual}`);
    const native = buttons(offer).find((d) => d.startsWith("bp:t:c:"));
    if (!NATIVE) {
      assert.ok(!native, "Telegram to'lovi sozlanmagan, lekin tugma chiqdi");
      return;
    }
    assert.ok(native, "«Telegram ichida to'lash» tugmasi yo'q");
    // 1) Telegram hisobni rad etdi (provayder tokeni xato…) — foydalanuvchi «Hisob tayyor» bilan hech narsasiz qolmaydi
    await control({ fail: { sendInvoice: "PAYMENT_PROVIDER_INVALID" } });
    const failed = await cb(CHAT_CLIENT, native);
    await control({ fail: { sendInvoice: null } });
    assert.match(answers(failed), /ochilmadi/);
    assert.match(texts(sentTo(failed, CHAT_CLIENT)), /boshqa to'lov usulini/);
    assert.ok(buttons(sentTo(failed, CHAT_CLIENT)).some((d) => d.startsWith("bp:m:c:")), "boshqa usullar qayta taklif qilinmadi");
    // 2) Hisob ochildi: summa tiyinda, payload = hisob id'si
    const opened = await cb(CHAT_CLIENT, native);
    const call = opened.find((e) => e.method === "sendInvoice");
    assert.ok(call, "sendInvoice chaqirilmadi");
    assert.equal(call.body.currency, "UZS");
    assert.equal(call.body.prices[0].amount, 40000 * 100);
    const inv = call.body.payload;
    // Rasm yuborilsa — Telegram to'lovi hisobiga CHEK bo'lib biriktirilmaydi (aks holda holat «pending» bo'lib, to'lov rad etilardi)
    await hook(photoMsg(CHAT_CLIENT, "ph_native"));
    await settle(900);
    assert.equal(await invState(inv), "created", "rasm Telegram to'lovi hisobiga chek bo'lib biriktirildi");
    const pre = (await hook({ pre_checkout_query: { id: `pc${RUN}`, from: from(CHAT_CLIENT), currency: "UZS", total_amount: 40000 * 100, invoice_payload: inv } })).find((e) => e.method === "answerPreCheckoutQuery");
    assert.equal(pre?.body.ok, true, "pre_checkout rad etildi");
    // 3) Pul yechildi, lekin hisob shu orada bekor qilingan: jim qolinmaydi — adminga xabar, foydalanuvchiga tushuntirish
    await sql("update subscription_invoices set state = 'cancelled' where id = ?", [inv]);
    const pay = (charge) => ({ message: { message_id: upd, from: from(CHAT_CLIENT), chat: { id: CHAT_CLIENT, type: "private" }, date: 1, successful_payment: { currency: "UZS", total_amount: 40000 * 100, invoice_payload: inv, telegram_payment_charge_id: charge } } });
    const stuck = await collect(await hook(pay(`ch1${RUN}`)), (all) => sentTo(all, CHAT_ADMIN).some((e) => /kirish ochilmadi/.test(e.body?.text ?? "")));
    assert.match(texts(sentTo(stuck, CHAT_CLIENT)), /kechikish/);
    assert.ok(sentTo(stuck, CHAT_ADMIN).some((e) => /kirish ochilmadi/.test(e.body?.text ?? "")), "adminga ogohlantirish ketmadi");
    assert.equal(Number((await sql("select count(*) n from enrollments where course_id = ? and user_id = ?", [course, cid]))[0].n), 0);
    // 4) Oddiy holat: to'lov o'tdi → kirish ochiladi
    await sql("update subscription_invoices set state = 'created' where id = ?", [inv]);
    const paid = await hook(pay(`ch2${RUN}`));
    assert.match(texts(sentTo(paid, CHAT_CLIENT)), /To'lov qabul qilindi — rahmat/);
    assert.equal(await invState(inv), "paid");
    assert.equal(Number((await sql("select count(*) n from enrollments where course_id = ? and user_id = ?", [course, cid]))[0].n), 1, "kursga kirish ochilmadi");
  } finally {
    await restoreCard();
    await settle(800);
    await msg(CHAT_ADMIN, "/stop");
  }
});
