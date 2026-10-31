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
 * admin buyrug'i yopiqligi, admin ulash → /stat (trend) → /navbat → /shikoyatlar, inline rejim, bot orqali post taklifi.
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
const DB_URL = envOr("DATABASE_URL", "file:./data/redince.db");

const RUN = String(Date.now()).slice(-7);
const CHAT_UZ = Number(`88${RUN}`);
const CHAT_RU = Number(`89${RUN}`);
const CHAT_ADMIN = Number(`87${RUN}`);
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
async function hook(update, wait = 900) {
  const r = await fetch(`${BASE}/api/telegram/webhook`, { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET }, body: JSON.stringify({ update_id: upd++, ...update }) });
  assert.equal(r.status, 200, `webhook ${r.status}`);
  await sleep(wait);
  return fresh();
}
const from = (id, lang = "uz") => ({ id, is_bot: false, first_name: "Sinov", last_name: "Bot", username: "sinovbot", language_code: lang });
const msg = (chatId, text, lang) => hook({ message: { message_id: upd, from: from(chatId, lang), chat: { id: chatId, type: "private" }, date: Math.floor(Date.now() / 1000), text } });
const cb = (chatId, data, lang) => hook({ callback_query: { id: String(upd), from: from(chatId, lang), data, message: { message_id: 4242, chat: { id: chatId, type: "private" }, text: "..." } } });
const texts = (evs) => evs.map((e) => String(e.body?.text ?? e.body?.caption ?? "")).join("\n");
const buttons = (evs) => evs.flatMap((e) => (e.body?.reply_markup?.inline_keyboard ?? []).flat().map((b) => b.callback_data ?? b.url ?? b.web_app?.url ?? ""));
const sentTo = (evs, chatId) => evs.filter((e) => String(e.body?.chat_id) === String(chatId));

/** Lokal fayl bazasi (CI'da ham file:) — tozalash va admin chatini qaytarish uchun; bo'lmasa null */
async function dbClient() {
  if (!DB_URL.startsWith("file:")) return null;
  try {
    const { createClient } = await import("@libsql/client");
    return createClient({ url: DB_URL });
  } catch {
    return null;
  }
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

async function login(email, password) {
  if (password) {
    const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email, password }) });
    if (r.ok) return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  }
  return jar(process.env.ADMIN_COOKIE_JAR || "/tmp/ad.jar");
}

before(async () => {
  // Avval DB holati (admin chatini keyin QAYTARISH uchun) — undan keyingina tekshiruvlar, aks holda after() noto'g'ri qiymat yozadi
  const db = await dbClient();
  if (db) {
    const r = await db.execute({ sql: "select telegram_chat_id from users where email = ? limit 1", args: [ADMIN_EMAIL] }).catch(() => null);
    if (r) adminPrevChat = r.rows[0]?.telegram_chat_id ?? null;
    await db.execute("delete from rate_limits where key like 'tgStart:%' or key like 'tgBot:%'").catch(() => undefined);
  }
  assert.ok(SECRET, "TELEGRAM_WEBHOOK_SECRET kerak (env yoki .env)");
  // Dev server birinchi so'rovda kompilyatsiya qiladi — bir necha urinish
  let ping = false;
  for (let i = 0; i < 6 && !ping; i++) {
    ping = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.ok).catch(() => false);
    if (!ping) await sleep(2000);
  }
  assert.ok(ping, `Server javob bermayapti: ${BASE}`);
  logPos = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").length : 0;
});

after(async () => {
  const db = await dbClient();
  if (!db) return;
  for (const c of [CHAT_UZ, CHAT_RU, CHAT_ADMIN]) {
    const u = await db.execute({ sql: "select id from users where telegram_chat_id = ? and email like 'tg%@telegram.local'", args: [String(c)] });
    for (const row of u.rows) {
      await db.execute({ sql: "delete from specialists where user_id = ?", args: [row.id] });
      await db.execute({ sql: "delete from users where id = ?", args: [row.id] });
    }
    await db.execute({ sql: "delete from bot_sessions where chat_id = ?", args: [String(c)] });
  }
  // Admin chatini avvalgi holatga qaytarish (lokalda haqiqiy ulanish yo'qolmasin) — faqat before() uni o'qigan bo'lsa
  if (adminPrevChat !== undefined) await db.execute({ sql: "update users set telegram_chat_id = ? where email = ?", args: [adminPrevChat, ADMIN_EMAIL] }).catch(() => undefined);
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
