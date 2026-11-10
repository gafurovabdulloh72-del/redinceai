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
const created = { orders: [], vacancies: [], conversations: [], feedback: [], tempChats: [] };
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
    await db.execute("delete from rate_limits where key like 'tgStart:%' or key like 'tgBot:%' or key like 'tgMsg:%' or key like 'tgInline:%'").catch(() => undefined);
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
  await run("delete from notifications where type = 'broadcast' and title like ?", [`Sinov % ${RUN}`]);
  // Vaqtincha chat biriktirilgan seed hisoblar (e'lon yetkazish testi) — uzamiz
  for (const c of created.tempChats) {
    await run("update users set telegram_chat_id = null where telegram_chat_id = ?", [String(c)]);
    await run("delete from rate_limits where key like ?", [`%:${c}`]);
  }
  for (const c of [CHAT_UZ, CHAT_RU, CHAT_ADMIN, CHAT_CLIENT]) {
    const u = await db.execute({ sql: "select id from users where telegram_chat_id = ? and email like 'tg%@telegram.local'", args: [String(c)] });
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

test("bot orqali post: rasm → tanlov tugmalari → bekor", async () => {
  const evs = sentTo(await hook({ message: { message_id: upd, from: from(CHAT_UZ), chat: { id: CHAT_UZ, type: "private" }, date: 1, caption: "Sinov izohi", photo: [{ file_id: "ph_s", file_size: 500, width: 90, height: 90 }, { file_id: "ph_big", file_size: 90000, width: 1280, height: 960 }] } }), CHAT_UZ);
  const b = buttons(evs);
  assert.ok(b.includes("pst:ok") && b.includes("pst:story") && b.includes("pst:no"), `tugmalar: ${b.join(", ")}`);
  const no = await cb(CHAT_UZ, "pst:no");
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
  assert.match(last.body.text, /yetkazildi 1\b/, `yetkazilgan son noto'g'ri: ${last.body.text}`);
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
