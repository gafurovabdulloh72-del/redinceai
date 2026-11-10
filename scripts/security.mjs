/**
 * Xavfsizlik testlari (2026-10-25 auditi, 26-band).
 * Smoke testlar funksiyani tekshiradi; bu yerda AVTORIZATSIYA tekshiriladi:
 * begona foydalanuvchi boshqa odamning resursiga tega olmasligi, mehmon yopiq
 * route'ga kira olmasligi, CSRF va limitlar ishlashi.
 *
 * Ishga tushirish: dev server ishlab tursin, keyin `node --test scripts/security.mjs`.
 * Jar fayllar (/tmp/sp.jar, /tmp/cl.jar, /tmp/ad.jar) scratchpad'dagi restart-dev.sh bilan yaratiladi.
 */
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ORIGIN = BASE;

const jar = (p) => {
  if (!fs.existsSync(p)) return "";
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l && (!l.startsWith("#") || l.startsWith("#HttpOnly_")))
    .map((l) => l.split("\t"))
    .filter((a) => a.length >= 7)
    .map((a) => `${a[5]}=${a[6]}`)
    .join("; ");
};

/**
 * Sessiya cookie'lari. Ikki manba:
 *  1) API orqali kirish (seed demo hisoblari) — CI shu yo'ldan ketadi, jar fayllar yo'q;
 *  2) lokal jar fayllar (scratchpad `restart-dev.sh` yaratadi) — kirish ishlamasa zaxira.
 * Hisob topilmasa IDOR/admin testlari jim o'tkazib yuborilmaydi — aniq xato beradi
 * (sabab: cookie'siz «401» keladi va test avtorizatsiyani emas, mehmonlikni tekshirgan bo'ladi).
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo12345";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

async function login(email, password) {
  if (!password) return "";
  try {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { Origin: ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    if (!r.ok) return "";
    const list = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") ?? ""];
    return list.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  } catch {
    return "";
  }
}

const COOKIES = { sp: "", cl: "", ad: "", guest: "" };
COOKIES.sp = (await login("mutaxassis@redince.uz", DEMO_PASSWORD)) || jar("/tmp/sp.jar");
COOKIES.cl = (await login("mijoz@redince.uz", DEMO_PASSWORD)) || jar("/tmp/cl.jar");
COOKIES.ad = (await login(process.env.ADMIN_EMAIL || "admin@redince.uz", ADMIN_PASSWORD)) || jar("/tmp/ad.jar");
if (!COOKIES.cl) throw new Error("Xavfsizlik testlari: mijoz sessiyasi olinmadi (seed demo hisobi yoki DEMO_PASSWORD ni tekshiring) — avtorizatsiya testlari ma'nosiz bo'lib qoladi");

async function req(who, path, init = {}) {
  const headers = { Origin: ORIGIN, "Content-Type": "application/json", ...(init.headers ?? {}) };
  if (COOKIES[who]) headers.Cookie = COOKIES[who];
  return fetch(BASE + path, { ...init, headers, redirect: "manual" });
}

/**
 * Bazaga TO'G'RIDAN-TO'G'RI murojaat (fixture, tozalash, tekshiruv). Lokal SQLite faylida server ham yozayotgan bo'lsa
 * `SQLITE_BUSY` keladi (o'qishda ham) — qisqa kutib qayta urinamiz, aks holda test tasodifiy yiqiladi.
 */
let sharedDb = null;
/** registerTemp() uchun navbatdagi TEST-NET manzil oxiri (pastda) */
let tempSeq = Math.floor(Math.random() * 200);
async function dbRun(sql, args = []) {
  if (!sharedDb) {
    const { createClient } = await import("@libsql/client");
    sharedDb = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
  }
  for (let i = 0; ; i++) {
    try {
      return await sharedDb.execute({ sql, args });
    } catch (e) {
      if (!/SQLITE_BUSY|database is locked/i.test(String(e?.message ?? e))) throw e;
      // Band bo'lib yiqilgan so'rov ulanishni «tugamagan» holatda qoldiradi — keyingi yozuvlar commit bo'lmay qoladi; yangilaymiz
      await Promise.resolve(sharedDb.reconnect()).catch(() => undefined);
      if (i >= 6) throw e;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
}

/**
 * Har test oldidan «hisob tuzog'i» ballari tozalanadi: to'plam demo hisoblar nomidan ataylab o'nlab 403/404 oladi — ballar
 * to'planib (ayniqsa to'plam bir soat ichida qayta yurgizilsa) demo hisobning o'zi muzlab, keyingi testlar 401/429 olardi.
 */
beforeEach(async () => {
  await dbRun("DELETE FROM rate_limits WHERE key LIKE 'abuse:%' OR key LIKE 'abuse1:%'").catch(() => undefined);
});

/* ------------------------- 1. Mehmon yopiq route'larga kira olmaydi ------------------------- */

const GUEST_FORBIDDEN = [
  ["GET", "/api/chat"],
  ["GET", "/api/chat/stream"],
  ["GET", "/api/posts/saved"],
  ["GET", "/api/blocks"],
  ["GET", "/api/account/privacy"],
  ["GET", "/api/users/mention?q=a"],
  ["GET", "/api/mentorlik/daromad"],
  ["GET", "/api/mentorlik/kurslar/saqlangan"],
  // 5-audit: yopiq fayl route'lari — mehmon hech qachon 302/oqim olmaydi
  ["GET", "/api/media/dm/x_0"],
  ["GET", "/api/media/group/x_0"],
  ["GET", "/api/media/order/x_0"],
  ["GET", "/api/media/material/x_0"],
  ["GET", "/api/media/receipt/x"],
  ["GET", "/api/media/dm/x_0/stream"],
];

test("Mini App: soxta initData → 401 (imzo tekshiruvi)", async () => {
  const r = await req("guest", "/api/tg/auth", { method: "POST", body: JSON.stringify({ initData: "query_id=x&user=%7B%22id%22%3A1%7D&auth_date=1&hash=" + "0".repeat(64) }) });
  assert.ok([401, 503].includes(r.status), `kutilgan 401 (bot sozlanmagan bo'lsa 503), keldi ${r.status}`);
});

test("mehmon: POST /api/push → 401 (GET ataylab ommaviy — VAPID ochiq kaliti)", async () => {
  const r = await req("guest", "/api/push", { method: "POST", body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "x".repeat(30), auth: "y".repeat(16) } }) });
  assert.equal(r.status, 401, `kutilgan 401, keldi ${r.status}`);
});

for (const [method, path] of GUEST_FORBIDDEN) {
  test(`mehmon: ${method} ${path} → 401`, async () => {
    const r = await req("guest", path, { method });
    assert.equal(r.status, 401, `${path} kutilgan 401, keldi ${r.status}`);
  });
}

/* ------------------------- 2. Admin route'lari oddiy foydalanuvchiga yopiq ------------------------- */

const ADMIN_ONLY = ["/api/admin/health", "/api/admin/moderation", "/api/admin/mentors"];

for (const path of ADMIN_ONLY) {
  test(`oddiy foydalanuvchi: GET ${path} → 403`, async () => {
    const r = await req("cl", path);
    assert.ok([401, 403].includes(r.status), `${path} kutilgan 401/403, keldi ${r.status}`);
  });
}

/* ------------------------- 3. CSRF: Origin bo'lmasa mutatsiya rad etiladi ------------------------- */

test("CSRF: Origin'siz POST → 403", async () => {
  const r = await fetch(`${BASE}/api/account/privacy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: COOKIES.cl },
    body: JSON.stringify({ dmPolicy: "all" }),
  });
  assert.equal(r.status, 403, `kutilgan 403, keldi ${r.status}`);
});

test("CSRF: begona Origin bilan POST → 403", async () => {
  const r = await fetch(`${BASE}/api/account/privacy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: COOKIES.cl, Origin: "https://evil.example" },
    body: JSON.stringify({ dmPolicy: "all" }),
  });
  assert.equal(r.status, 403, `kutilgan 403, keldi ${r.status}`);
});

/* ------------------------- 4. IDOR: begona resursga tegish ------------------------- */

test("IDOR: mavjud bo'lmagan suhbatga xabar → 403/404", async () => {
  const r = await req("cl", "/api/chat/begona-suhbat-id", { method: "POST", body: JSON.stringify({ body: "salom" }) });
  assert.ok([403, 404, 422].includes(r.status), `kutilgan 403/404/422, keldi ${r.status}`);
});

test("IDOR: begona postni o'chirish → 403/404", async () => {
  const r = await req("cl", "/api/posts/begona-post-id", { method: "DELETE" });
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});

test("IDOR: mavjud bo'lmagan kursni saqlash → 404", async () => {
  const r = await req("cl", "/api/mentorlik/kurslar/begona-kurs-id/saqlash", { method: "POST" });
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});

test("IDOR: kursga yozilmagan mijoz dars eslatmalarini ko'ra olmaydi → 403/404", async () => {
  const r = await req("cl", "/api/mentorlik/darslar/begona-dars-id/eslatmalar");
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});

test("IDOR: begona eslatmani o'chirish → 404", async () => {
  const r = await req("cl", "/api/mentorlik/eslatmalar/begona-eslatma-id", { method: "DELETE" });
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});

test("IDOR: begona post statistikasi → 403/404", async () => {
  const r = await req("cl", "/api/posts/begona-post-id/statistika");
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});

test("IDOR: begona efir sozlamasi → 403/404", async () => {
  const r = await req("cl", "/api/live/begona-efir/sozlama", { method: "PATCH", body: JSON.stringify({ waitingRoom: true }) });
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});

/* ------------------------- 5. Zaiflik regressiyalari ------------------------- */

test("XSS: vakansiya JSON-LD da `<` ekranlangan", async () => {
  const list = await (await req("guest", "/api/vakansiyalar?limit=1")).json().catch(() => null);
  const id = list?.data?.items?.[0]?.id;
  if (!id) return; // vakansiya yo'q — test o'tkazib yuboriladi
  const html = await (await req("guest", `/vakansiyalar/${id}`)).text();
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (m) assert.ok(!m[1].includes("<"), "JSON-LD ichida ekranlanmagan `<` bor — XSS xavfi");
});

test("Web Push: begona endpoint rad etiladi (SSRF)", async () => {
  if (!COOKIES.cl) return;
  const r = await req("cl", "/api/push", {
    method: "POST",
    body: JSON.stringify({ endpoint: "https://evil.example/push/abc", keys: { p256dh: "x".repeat(30), auth: "y".repeat(16) } }),
  });
  assert.ok([401, 422].includes(r.status), `begona push xosti qabul qilindi (${r.status}) — SSRF xavfi`);
});

test("Efir kodi: 4 belgi qabul qilinmaydi (6+ kerak)", async () => {
  const r = await req("cl", "/api/live/begona-efir/sozlama", { method: "PATCH", body: JSON.stringify({ passcode: "1234" }) });
  assert.ok([403, 404, 422].includes(r.status), `kutilgan 403/404/422, keldi ${r.status}`);
});

test("Efir kodi: 6 belgi validatsiyadan o'tadi (xato egalik bo'yicha bo'ladi)", async () => {
  const r = await req("cl", "/api/live/begona-efir/sozlama", { method: "PATCH", body: JSON.stringify({ passcode: "123456" }) });
  // Efir mavjud emas → 403/404. 422 kelsa — uzunlik qoidasi 6 belgini ham rad etadi (regressiya).
  assert.ok([403, 404].includes(r.status), `6 belgili kod rad etildi (${r.status}) — PASSCODE_RE ni tekshiring`);
});

/* ------------------------- 6. Xavfsizlik sarlavhalari ------------------------- */

test("Xavfsizlik sarlavhalari o'rnatilgan", async () => {
  const r = await req("guest", "/");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  // Telegram Mini App (2026-10-31): ramka faqat o'zimiz va Telegram Web uchun — DENY emas, SAMEORIGIN + CSP frame-ancestors
  assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
  const fa = /frame-ancestors ([^;]+)/.exec(r.headers.get("content-security-policy") ?? "")?.[1] ?? "";
  assert.ok(fa.includes("'self'") && fa.includes("telegram.org") && !fa.includes("*;") && !/\s\*\s/.test(fa), `CSP frame-ancestors noto'g'ri: ${fa}`);
  // 2026-10-31: tabnabbing / XS-Leaks — begona oyna window.opener orqali boshqara olmasin
  assert.equal(r.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
  assert.equal(r.headers.get("x-permitted-cross-domain-policies"), "none");
});

test("API javoblari keshlanmaydi", async () => {
  if (!COOKIES.cl) return;
  const r = await req("cl", "/api/chat");
  assert.ok((r.headers.get("cache-control") ?? "").includes("no-store"), "API javobi keshlanishi mumkin");
});

/* ------------------------- 7. Ochiq yo'naltirish (open redirect) ------------------------- */

// `/api/til?next=` faqat sayt ichidagi yo'lni qabul qiladi (`safeInternalPath`).
// Tashqi manzil berilsa "/" ga qaytarilishi kerak — fishing havolasi yasab bo'lmasin.
for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "////evil.example"]) {
  test(`Ochiq yo'naltirish yo'q: /api/til?next=${bad}`, async () => {
    const r = await req("guest", `/api/til?t=ru&next=${encodeURIComponent(bad)}`);
    assert.equal(r.status, 303, `kutilgan 303, keldi ${r.status}`);
    const loc = new URL(r.headers.get("location") ?? "/", BASE);
    assert.equal(loc.origin, new URL(BASE).origin, `begona manzilga yo'naltirildi: ${loc.href}`);
    assert.ok(!loc.pathname.startsWith("//"), `protokolsiz manzil o'tdi: ${loc.href}`);
  });
}

/* ------------------------- 8. Mehmon efir/qo'ng'iroq tokeni olmaydi ------------------------- */

// LiveKit tokeni = pul (daqiqa). Mehmonga HECH QACHON berilmasligi kerak.
for (const path of ["/api/live/begona-efir/token", "/api/qongiroq/token?id=yoq"]) {
  test(`mehmon: POST ${path} — token bermaydi`, async () => {
    const r = await req("guest", path, { method: "POST", body: "{}" });
    // 401 — kutilgan javob; 503 — LiveKit env'i sozlanmagan muhit (CI) auth'dan oldin to'xtaydi.
    // Muhimi: mehmon HECH QACHON 2xx va token olmasligi kerak.
    assert.ok(r.status >= 400, `${path} mehmonga ${r.status} qaytardi — token sizishi mumkin`);
    assert.ok([401, 503].includes(r.status), `${path} kutilgan 401 (yoki 503 — LiveKit sozlanmagan), keldi ${r.status}`);
  });
}

/* ------------------------- Kontakt sotuvi (2026-10-31) ------------------------- */
test("Kontakt: mehmon to'lovni boshlay olmaydi → 401", async () => {
  const r = await fetch(`${BASE}/api/kontakt`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ specialistId: "x", provider: "manual" }) });
  assert.equal(r.status, 401);
});
test("Kontakt: begona/mavjud bo'lmagan hisob holati → 404", async () => {
  const r = await req("cl", "/api/kontakt/tolov/sub_begona-hisob");
  assert.equal(r.status, 404);
});
test("Kontakt: admin narx/rejim API'si oddiy foydalanuvchiga yopiq → 403", async () => {
  const r = await req("cl", "/api/admin/kontaktlar", { method: "PATCH", body: JSON.stringify({ specialistId: "x", contactMode: "hidden" }) });
  assert.equal(r.status, 403);
});

test("Kontakt rejimi: mijoz o'z rejimini o'zgartira olmaydi (profil yo'q) → 403/404", async () => {
  const r = await req("cl", "/api/kontakt/rejim", { method: "PATCH", body: JSON.stringify({ contactMode: "hidden" }) });
  assert.ok([403, 404].includes(r.status), `kutilgan 403/404, keldi ${r.status}`);
});
test("Mini App: initData'siz kirish → 401 (hisob yaratilmaydi)", async () => {
  const r = await fetch(`${BASE}/api/tg/auth`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ initData: "user=%7B%7D&hash=00", to: "/" }) });
  assert.ok([401, 503].includes(r.status), `kutilgan 401/503, keldi ${r.status}`);
});
test("Sessiya cookie: oddiy kirish SameSite=Lax; iframe (Telegram Web) kirishi SameSite=None; Secure; Partitioned", async () => {
  const login = (embedded) => fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: "mijoz@redince.uz", password: DEMO_PASSWORD, embedded }), redirect: "manual" });
  const pick = (r) => (typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") ?? ""]).find((c) => c.startsWith("redince_session=")) ?? "";
  const plain = pick(await login(false));
  if (!plain) return; // demo hisob yo'q muhit — tekshirib bo'lmaydi
  assert.match(plain, /SameSite=lax/i, `oddiy sessiya Lax bo'lishi kerak: ${plain.replace(/=[^;]+/, "=…")}`);
  assert.doesNotMatch(plain, /Partitioned/i);
  const framed = pick(await login(true));
  assert.match(framed, /SameSite=none/i);
  assert.match(framed, /Secure/i);
  assert.match(framed, /Partitioned/i);
  assert.match(framed, /HttpOnly/i);
});

test("Telegram ulash kodi: mehmon → 401 (link/unlink)", async () => {
  for (const path of ["/api/telegram/link", "/api/telegram/unlink"]) {
    const r = await fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: "{}" });
    assert.equal(r.status, 401, `${path} mehmonga ochiq: ${r.status}`);
  }
});

test("Admin Telegram sinov xabari oddiy foydalanuvchiga yopiq → 403", async () => {
  const r = await req("cl", "/api/admin/telegram", { method: "PATCH" });
  assert.equal(r.status, 403);
});

test("Kontakt Telegram to'lovi: mehmon → 401", async () => {
  const r = await fetch(`${BASE}/api/kontakt/telegram`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ specialistId: "x" }) });
  assert.equal(r.status, 401);
});

test("CSP hisobotlari: report-uri ulangan, qabul qiluvchi chegaralangan (204/400/413/405)", async () => {
  const csp = (await req("guest", "/")).headers.get("content-security-policy") ?? "";
  assert.ok(csp.includes("report-uri /api/csp-report"), "CSP'da report-uri yo'q");
  const post = (body, type = "application/csp-report") =>
    fetch(`${BASE}/api/csp-report`, { method: "POST", headers: { "content-type": type }, body });
  const ok = await post(JSON.stringify({ "csp-report": { "violated-directive": "img-src", "blocked-uri": "https://ci.example/x.png", "document-uri": `${BASE}/?token=sir` } }));
  assert.equal(ok.status, 204, `to'g'ri hisobot qabul qilinmadi: ${ok.status}`);
  assert.equal((await post("{buzuq")).status, 400);
  assert.equal((await post("x".repeat(20_000))).status, 413);
  assert.equal((await fetch(`${BASE}/api/csp-report`)).status, 405);
});

test("SSRF: havola prevyusi ichki manzillarni o'qimaydi (metadata, loopback, IPv6, redirect)", async () => {
  for (const u of ["http://169.254.169.254/latest/meta-data/", "https://127.0.0.1/", `${BASE}/api/health`, "http://[::1]/", "https://2130706433/"]) {
    const r = await fetch(`${BASE}/api/posts/preview?url=${encodeURIComponent(u)}`);
    assert.equal(r.status, 200, `${u}: ${r.status}`);
    assert.equal((await r.json()).data, null, `post prevyusi ichki manzilni o'qidi: ${u}`);
    if (COOKIES.cl) {
      const c = await req("cl", `/api/chat/preview?url=${encodeURIComponent(u)}`);
      if (c.status === 200) assert.equal((await c.json()).data?.preview ?? null, null, `chat prevyusi ichki manzilni o'qidi: ${u}`);
    }
  }
});

test("Kontakt sotuvi: mehmon va kontaktni ochmagan mijoz telefon/Telegram/Instagram/email'ni API'da ko'rmaydi", async () => {
  const list = await (await fetch(`${BASE}/api/specialists?limit=5`)).json();
  const items = list.data?.items ?? list.data ?? [];
  assert.ok(Array.isArray(items) && items.length > 0, "katalog bo'sh — test ma'nosiz");
  for (const it of items.slice(0, 3)) {
    const slug = it.slug;
    for (const who of ["guest", "cl"]) {
      if (who === "cl" && !COOKIES.cl) continue;
      const r = await req(who, `/api/specialists/${encodeURIComponent(slug)}`);
      if (r.status !== 200) continue;
      const d = (await r.json()).data ?? {};
      // Eslatma: bu API kontaktni hatto sotib olganlarga ham bermaydi (ular profil sahifasida ko'radi) — shuning uchun hammaga null
      for (const [k, v] of [["telegram", d.telegram], ["instagram", d.instagram], ["phone", d.user?.phone], ["email", d.user?.email]]) {
        assert.ok(v == null || v === "", `${who}: ${slug} ${k} sizdi`);
      }
    }
  }
});

test("Parol havolasi Telegramga: mehmon → 401; javobda token yo'q", async () => {
  const r = await fetch(`${BASE}/api/auth/parol/telegram`, { method: "POST", headers: { origin: BASE } });
  assert.equal(r.status, 401);
  if (COOKIES.cl) {
    const c = await req("cl", "/api/auth/parol/telegram", { method: "POST" });
    // Telegram ulangan bo'lsa 200, bo'lmasa 400 — ikkala holatda ham javobda token chiqmaydi
    assert.ok([200, 400, 503].includes(c.status), `kutilmagan holat: ${c.status}`);
    assert.ok(!(await c.text()).includes("parol-tiklash"), "javobda tiklash havolasi sizdi");
  }
});

test("Eksport qayta tasdiqlash: GET 405, parolsiz/noto'g'ri parol rad, mehmon 401", async () => {
  assert.equal((await fetch(`${BASE}/api/account/export`)).status, 405);
  const guest = await fetch(`${BASE}/api/account/export`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ password: "x" }) });
  assert.equal(guest.status, 401);
  if (COOKIES.cl) {
    const bad = await req("cl", "/api/account/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "mutlaqo-xato-parol" }) });
    assert.equal(bad.status, 422, `noto'g'ri parol bilan eksport: ${bad.status}`);
  }
});

test("Darslar tartibi: mehmon 401, begona foydalanuvchi 403", async () => {
  const g = await fetch(`${BASE}/api/mentorlik/darslar/tartib`, { method: "PUT", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ courseId: "yoq-kurs", ids: ["a1b2c3"] }) });
  assert.equal(g.status, 401);
  if (COOKIES.cl) {
    const r = await req("cl", "/api/mentorlik/darslar/tartib", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId: "yoq-kurs", ids: ["a1b2c3"] }) });
    assert.ok([403, 404].includes(r.status), `begona: ${r.status}`);
  }
});

test("Konkurs: mehmon ishtirok/ovoz 401, admin yaratish — mehmon 401 / mijoz 403", async () => {
  const h = { "content-type": "application/json", origin: BASE };
  assert.equal((await fetch(`${BASE}/api/konkurs/yoq-konkurs/qatnashish`, { method: "POST", headers: h, body: JSON.stringify({ postId: "x" }) })).status, 401);
  assert.equal((await fetch(`${BASE}/api/konkurs/yoq-konkurs/ovoz`, { method: "POST", headers: h, body: JSON.stringify({ entryId: "x" }) })).status, 401);
  assert.equal((await fetch(`${BASE}/api/admin/konkurs`, { method: "POST", headers: h, body: JSON.stringify({ title: "Sinov" }) })).status, 401);
  if (COOKIES.cl) {
    const r = await req("cl", "/api/admin/konkurs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Sinov" }) });
    assert.equal(r.status, 403, `mijoz admin konkurs: ${r.status}`);
  }
});

test("Maslahat (Q&A): mehmon savol/javob/foydali/qabul 401, begona o'chirish 403-404", async () => {
  const h = { "content-type": "application/json", origin: BASE };
  assert.equal((await fetch(`${BASE}/api/savollar`, { method: "POST", headers: h, body: JSON.stringify({ title: "Mehmon savol yozyapti" }) })).status, 401);
  assert.equal((await fetch(`${BASE}/api/savollar/yoq/javob`, { method: "POST", headers: h, body: JSON.stringify({ body: "Mehmon javob yozyapti" }) })).status, 401);
  assert.equal((await fetch(`${BASE}/api/javoblar/yoq/ovoz`, { method: "POST", headers: h })).status, 401);
  assert.equal((await fetch(`${BASE}/api/savollar/yoq/qabul`, { method: "POST", headers: h, body: JSON.stringify({ answerId: "a1b2c3" }) })).status, 401);
  if (COOKIES.cl) {
    const r = await req("cl", "/api/savollar/yoq-savol", { method: "DELETE" });
    assert.ok([403, 404].includes(r.status), `begona o'chirish: ${r.status}`);
  }
});

test("Chat inbox (Telegram): mehmon guruh-pref 401, begona guruh 404", async () => {
  const h = { "content-type": "application/json", origin: BASE };
  assert.equal((await fetch(`${BASE}/api/chat/guruh/x`, { method: "PATCH", headers: h, body: JSON.stringify({ pinned: true }) })).status, 401);
  if (COOKIES.cl) {
    const r = await req("cl", "/api/chat/guruh/yoq-guruh-404", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pinned: true }) });
    assert.equal(r.status, 404, `yo'q guruh: ${r.status}`);
  }
});

/* ------------------------- 4-AUDIT (2026-11-03): himoyalangan video oqimi ------------------------- */

/** Katalogdan mehmonga ochiq (bepul namuna) videoli dars topiladi — kurs sahifasidagi dars havolalari bo'yicha; bo'lmasa test o'tkazib yuboriladi */
async function findPreviewLesson() {
  const list = await (await req("guest", "/api/mentorlik/kurslar?limit=20")).json().catch(() => null);
  for (const c of list?.data?.items ?? []) {
    const html = await (await req("guest", `/mentorlik/${c.slug}`)).text().catch(() => "");
    for (const id of new Set([...html.matchAll(/\/mentorlik\/dars\/([\w-]+)/g)].map((m) => m[1]))) {
      if ((await req("guest", `/api/mentorlik/video/${id}`)).status === 302) return id;
    }
  }
  return null;
}

test("Dars videosi: xom saqlash manzili sizmaydi — faqat tokenli /stream, token boshqa sessiya/muddat/o'zgartirishda 403", async (t) => {
  const id = await findPreviewLesson();
  if (!id) return t.skip("bepul namuna dars topilmadi");
  const r = await req("guest", `/api/mentorlik/video/${id}`);
  assert.equal(r.status, 302, `kutilgan 302, keldi ${r.status}`);
  const loc = r.headers.get("location") ?? "";
  assert.ok(loc.includes(`/api/mentorlik/video/${id}/stream?t=`), `Location tokenli stream bo'lishi kerak: ${loc}`);
  assert.ok(!/\/uploads\/|blob\.vercel-storage|r2\.|\.mp4|\.webm/.test(loc), `Location xom manzilni oshkor qiladi: ${loc}`);
  assert.equal(r.headers.get("cache-control"), "private, no-store");
  const path = loc.replace(BASE, "");
  // Mehmon tokeni mehmonga ishlaydi (Range bilan 206 yoki 200), yuklab olishga yo'l qo'ymaydigan sarlavhalar bilan
  const ok = await req("guest", path, { headers: { Range: "bytes=0-9" } });
  assert.ok([200, 206].includes(ok.status), `token bilan kutilgan 200/206, keldi ${ok.status}`);
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
  assert.ok(/^(video|audio)\//.test(ok.headers.get("content-type") ?? ""), "video/audio MIME");
  // Boshqa sessiya (mijoz) mehmon tokenini ishlata olmaydi
  const other = await req("cl", path);
  assert.equal(other.status, 403, `begona sessiya tokeni: kutilgan 403, keldi ${other.status}`);
  // Imzosi buzilgan / tokensiz
  assert.equal((await req("guest", path + "x")).status, 403, "buzilgan token 403");
  assert.equal((await req("guest", path.split("?")[0])).status, 403, "tokensiz 403");
  // Muddati o'tgan token (payload'dagi exp qo'lda kamaytirilsa imzo buziladi — baribir 403)
  const [payload, mac] = path.split("t=")[1].split(".");
  const old = Buffer.from(Buffer.from(payload, "base64url").toString().replace(/\.(\d+)$/, ".1"), "utf8").toString("base64url");
  assert.equal((await req("guest", `${path.split("?")[0]}?t=${old}.${mac}`)).status, 403, "muddati o'tgan token 403");
});

test("Efir yozuvi: yo'q efir 404, tokensiz /video/stream 403 (xom R2 manzili API'da yo'q)", async () => {
  assert.equal((await req("guest", "/api/live/yoq-efir-404/video")).status, 404);
  assert.equal((await req("cl", "/api/live/yoq-efir-404/video")).status, 404);
  assert.equal((await req("guest", "/api/live/yoq-efir-404/video/stream")).status, 403);
  assert.equal((await req("cl", "/api/live/yoq-efir-404/video/stream?t=abc.def")).status, 403);
});

/* ------------------------- Ovozli xabar presign (2026-11-04): mehmon 401, noto'g'ri MIME 422, audio OK ------------------------- */

test("Ovozli xabar presign: mehmon 401, video/begona kengaytma 422, 5 MB dan katta 422, audio OK (r2 yoki fallback)", async () => {
  const body = (o) => ({ method: "POST", body: JSON.stringify(o) });
  assert.equal((await req("guest", "/api/upload/presign", body({ purpose: "voice", ext: "weba", size: 1000 }))).status, 401, "mehmon 401");
  assert.equal((await req("sp", "/api/upload/presign", body({ purpose: "voice", ext: "mp4", size: 1000 }))).status, 422, "voice bilan video kengaytmasi 422");
  assert.equal((await req("sp", "/api/upload/presign", body({ purpose: "voice", ext: "exe", size: 1000 }))).status, 422, "begona kengaytma 422");
  assert.equal((await req("sp", "/api/upload/presign", body({ purpose: "voice", ext: "weba", size: 6 * 1024 * 1024 }))).status, 422, "5 MB dan katta 422");
  const okRes = await req("sp", "/api/upload/presign", body({ purpose: "voice", ext: "weba", size: 1000 }));
  assert.equal(okRes.status, 200, "audio presign 200");
  const j = await okRes.json();
  assert.ok(j.ok && (j.data.mode === "fallback" || (j.data.mode === "r2" && j.data.contentType === "audio/webm" && /\/uploads\/[\w-]+\.weba$/.test(j.data.publicUrl))), `javob: ${JSON.stringify(j)}`);
});

/* ------------------------- 7-AUDIT: 2FA urinishlari foydalanuvchi bo'yicha ATOMAR sanaladi ------------------------- */

/** RFC 6238 TOTP (SHA-1, 30 s, 6 xona) — server `lib/security/totp.ts` bilan bir xil */
function totpAt(secretB32, ms) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of secretB32.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(ms / 1000 / 30)));
  const mac = createHmac("sha1", key).update(msg).digest();
  const o = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(bin % 1e6).padStart(6, "0");
}

// Ilgari «limit to'lmaganmi» deb o'qilar, hisoblagich esa kod noto'g'ri chiqqach oshirilardi: turli chiptalar bilan PARALLEL
// yuborilgan so'rovlar hammasi tekshiruvdan o'tib, bir oynada 10 emas — xohlagancha kodni sinab ko'ra olardi.
test("2FA kirish: parallel noto'g'ri kodlardan ko'pi bilan 10 tasi tekshiriladi (qolgani 429); to'g'ri kod hisoblagichni tozalaydi", async (t) => {
  const u = await registerTemp("client");
  if (!u) return t.skip("sinov hisobi ochilmadi (register limiti)");
  const post = (cookie, path, body) => reqAs(cookie, path, { method: "POST", body: JSON.stringify(body) });
  const ticket = async () => {
    const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: "Sinov12345" }) });
    const j = await r.json();
    assert.ok(j.data?.twoFactor && j.data.ticket, `kirish 2FA chiptasini berdi: ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
    return j.data.ticket;
  };
  const verify = (tk, code) => fetch(`${BASE}/api/auth/2fa/verify`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ ticket: tk, code }) });
  try {
    const setup = await post(u.cookie, "/api/auth/2fa/setup", {});
    assert.equal(setup.status, 200, `2FA sozlash: ${setup.status}`);
    const secret = (await setup.json()).data.secret;
    const en = await post(u.cookie, "/api/auth/2fa/enable", { code: totpAt(secret, Date.now()) });
    assert.equal(en.status, 200, `2FA yoqish: ${en.status}`);

    // 1) Ikki noto'g'ri kod → 422; to'g'ri kod (keyingi qadam — yoqishdagi kod ikkinchi marta qabul qilinmaydi) → kirish
    const a = await ticket();
    assert.equal((await verify(a, "000000")).status, 422, "noto'g'ri kod 422");
    assert.equal((await verify(a, "000001")).status, 422, "noto'g'ri kod 422");
    const good = await verify(a, totpAt(secret, Date.now() + 30_000));
    assert.equal(good.status, 200, `to'g'ri kod: ${good.status}`);

    // 2) Hisoblagich tozalangan: uch chipta × 5 = 15 ta noto'g'ri kod BIR VAQTDA — ko'pi bilan 10 tasi tekshiriladi
    const tickets = [await ticket(), await ticket(), await ticket()];
    const res = await Promise.all(tickets.flatMap((tk, i) => [0, 1, 2, 3, 4].map((n) => verify(tk, String(100000 + i * 10 + n)))));
    const codes = res.map((r) => r.status);
    const checked = codes.filter((c) => c === 422).length;
    const limited = codes.filter((c) => c === 429).length;
    assert.ok(checked <= 10, `tekshirilgan kodlar: ${checked} (≤10 bo'lishi shart) — ${codes.join(",")}`);
    assert.ok(checked >= 1 && limited >= 5, `limit ishladi: 422×${checked}, 429×${limited} — ${codes.join(",")}`);
  } finally {
    await cleanupTemp([u.email]);
  }
});

/* ------------------------- 7-AUDIT: hisobni o'chirish ijtimoiy tarmoq ma'lumotlarini ham tozalaydi ------------------------- */

// Hisob qatori saqlanadi (to'lov daftari) — kaskad ishlamaydi. Ilgari o'chirilgan hisobning postlari, obunalari, push obunasi
// va Google/Telegram bog'lanishi qolib ketardi: odam o'sha Google/Telegram bilan qayta ro'yxatdan o'ta olmasdi.
test("Hisobni o'chirish: Google/Telegram bog'lanishi, taxallus, postlar, obunalar va push obunasi tozalanadi; eski sessiya yopiladi", async (t) => {
  const u = await registerTemp("specialist");
  if (!u) return t.skip("sinov hisobi ochilmadi");
  const target = (await dbRun("SELECT id FROM users WHERE email = ?", ["mijoz@redince.uz"])).rows[0]?.id;
  let deleted = false;
  try {
    const pr = await reqAs(u.cookie, "/api/profil/postlar", { method: "POST", body: JSON.stringify({ body: "O'chiriladigan hisob posti", media: [] }) });
    assert.equal(pr.status, 201, `post: ${pr.status}`);
    const fl = await reqAs(u.cookie, `/api/follow/${target}`, { method: "POST" });
    assert.ok(fl.ok, `obuna: ${fl.status}`);
    // Tashqi bog'lanishlar va push obunasi — bazaga to'g'ridan-to'g'ri (Google/Telegram/VAPID bu muhitda sozlanmagan bo'lishi mumkin)
    const chat = `9${Date.now()}`.slice(0, 12);
    await dbRun("UPDATE users SET google_id = ?, telegram_chat_id = ? WHERE id = ?", [`sec-google-${u.id}`, chat, u.id]);
    await dbRun("INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)", [`sec-push-${u.id}`, u.id, `https://fcm.googleapis.com/fcm/send/sec-${u.id}`, "p", "a"]);

    const wrong = await reqAs(u.cookie, "/api/account/delete", { method: "POST", body: JSON.stringify({ password: "notogri-parol" }) });
    assert.equal(wrong.status, 422, `noto'g'ri parol bilan o'chmaydi: ${wrong.status}`);
    const del = await reqAs(u.cookie, "/api/account/delete", { method: "POST", body: JSON.stringify({ password: "Sinov12345" }) });
    assert.equal(del.status, 200, `o'chirish: ${del.status}`);
    deleted = true;

    const row = (await dbRun("SELECT email, username, google_id, telegram_chat_id, is_banned FROM users WHERE id = ?", [u.id])).rows[0];
    assert.ok(row, "hisob qatori saqlangan (daftar uchun)");
    assert.match(String(row.email), /^deleted-/, "email anonimlashtirilgan");
    assert.equal(row.username, null, "taxallus bo'shatilgan");
    assert.equal(row.google_id, null, "Google bog'lanishi uzilgan");
    assert.equal(row.telegram_chat_id, null, "Telegram bog'lanishi uzilgan");
    assert.equal(Number(row.is_banned), 1, "hisob yopilgan");
    const count = async (sql) => Number((await dbRun(sql, [u.id])).rows[0].n);
    assert.equal(await count("SELECT count(*) AS n FROM posts WHERE author_id = ? AND group_id IS NULL"), 0, "profil postlari o'chirilgan");
    assert.equal(await count("SELECT count(*) AS n FROM follows WHERE follower_id = ?"), 0, "obunalar o'chirilgan");
    assert.equal(await count("SELECT count(*) AS n FROM push_subscriptions WHERE user_id = ?"), 0, "push obunasi o'chirilgan");
    assert.equal(await count("SELECT count(*) AS n FROM specialists WHERE user_id = ?"), 0, "mutaxassis profili o'chirilgan");
    assert.equal((await (await reqAs(u.cookie, "/api/auth/me")).json()).data, null, "eski sessiya yopilgan (joriy foydalanuvchi yo'q)");
    assert.equal((await reqAs(u.cookie, "/api/chat")).status, 401, "eski sessiya bilan yopiq API 401");
    const back = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: "Sinov12345" }) });
    assert.equal(back.status, 401, `eski email/parol bilan kirib bo'lmaydi: ${back.status}`);
  } finally {
    if (deleted) await dbRun("DELETE FROM users WHERE id = ?", [u.id]).catch(() => undefined);
    else await cleanupTemp([u.email]);
  }
});

/* ------------------------- 7-AUDIT: promokod limiti CAS bilan band qilinadi ------------------------- */

// 100% chegirmali «1 marta» promokod: ilgari limit narx hisoblanayotganda O'QILAR, hisoblagich esa kirish berilgach oshirilardi —
// parallel so'rovlar bilan bir necha hisob bepul kirib olardi. Fixture bazaga to'g'ridan-to'g'ri (ustoz + kurs + kod), oxirida o'chiriladi.
test("Promokod: «1 marta» 100% kod ikki hisobdan BIR VAQTDA — faqat bittasiga kirish ochiladi", async (t) => {
  if (!COOKIES.sp) return t.skip("mutaxassis sessiyasi yo'q");
  const owner = (await dbRun("SELECT id FROM users WHERE email = ?", ["madina.yusupova@example.com"])).rows[0]?.id;
  if (!owner) return t.skip("demo ustoz hisobi yo'q");
  const mark = randomUUID().slice(0, 8);
  const had = (await dbRun("SELECT id FROM mentors WHERE user_id = ?", [owner])).rows[0]?.id;
  const mentorId = had ?? `sec-mentor-${mark}`;
  const courseId = `sec-course-${mark}`;
  const code = `SEC${mark.toUpperCase()}`.replace(/[^A-Z0-9]/g, "");
  if (!had) await dbRun("INSERT INTO mentors (id, user_id, headline, is_approved) VALUES (?, ?, ?, 1)", [mentorId, owner, "SEC promo sinovi"]);
  try {
    await dbRun("INSERT INTO courses (id, mentor_id, slug, title, is_published, price_from) VALUES (?, ?, ?, ?, 1, 50000)", [courseId, mentorId, `sec-promo-${mark}`, `SEC promo kursi ${mark}`]);
    await dbRun("INSERT INTO promo_codes (id, mentor_id, code, percent, course_id, max_uses, uses, is_active) VALUES (?, ?, ?, 100, ?, 1, 0, 1)", [`sec-promo-${mark}`, mentorId, code, courseId]);
    const buy = (who) => req(who, "/api/mentorlik/tolov", { method: "POST", body: JSON.stringify({ type: "course", id: courseId, promo: code, provider: "manual" }) });
    const res = await Promise.all([buy("cl"), buy("sp")]);
    const bodies = await Promise.all(res.map((r) => r.json().catch(() => ({}))));
    const free = bodies.filter((b) => b?.data?.free === true).length;
    const statuses = res.map((r) => r.status).join(",");
    assert.equal(free, 1, `bepul kirish soni: ${free} (statuslar: ${statuses})`);
    assert.ok(res.some((r) => [409, 422].includes(r.status)), `ikkinchisi rad etildi: ${statuses}`);
    const enrolled = Number((await dbRun("SELECT count(*) AS n FROM enrollments WHERE course_id = ?", [courseId])).rows[0].n);
    const uses = Number((await dbRun("SELECT uses FROM promo_codes WHERE code = ?", [code])).rows[0].uses);
    assert.equal(enrolled, 1, `yozilganlar: ${enrolled}`);
    assert.equal(uses, 1, `kod ishlatilishi: ${uses}`);
  } finally {
    await dbRun("DELETE FROM notifications WHERE title LIKE ? OR body LIKE ?", [`%SEC promo kursi ${mark}%`, `%SEC promo kursi ${mark}%`]).catch(() => undefined);
    await dbRun("DELETE FROM enrollments WHERE course_id = ?", [courseId]).catch(() => undefined);
    await dbRun("DELETE FROM promo_codes WHERE code = ?", [code]).catch(() => undefined);
    await dbRun("DELETE FROM courses WHERE id = ?", [courseId]).catch(() => undefined);
    if (!had) await dbRun("DELETE FROM mentors WHERE id = ?", [mentorId]).catch(() => undefined);
  }
});

/* ------------------------- 7-AUDIT: yuklama manzili fayl saqlangan joyga mos bo'lishi shart ------------------------- */

// Egalik fayl NOMI bo'yicha tekshiriladi, yuklama naqshi esa har qanday Blob do'konini o'tkazadi: foydalanuvchi faylni bizga
// yuklab, keyin O'Z do'konidagi shu nomli faylga havola bera olardi (mazmunini keyin almashtiradi). Endi rad etiladi.
test("Yuklama: bizga yuklangan fayl nomi bilan BEGONA Blob do'koniga havola — 422; haqiqiy manzil o'tadi", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "sec-store.png");
  fd.append("purpose", "attachment");
  const up = await fetch(BASE + "/api/upload", { method: "POST", headers: { Origin: ORIGIN, Cookie: COOKIES.sp }, body: fd });
  assert.equal(up.status, 201, `yuklash: ${up.status}`);
  const url = (await up.json()).data.url;
  const name = url.split("/").pop();
  const to = (await dbRun("SELECT username FROM users WHERE email = ?", ["mijoz@redince.uz"])).rows[0]?.username;
  assert.ok(to, "mijoz taxallusi topildi");
  const send = (u) => req("sp", "/api/chat", { method: "POST", body: JSON.stringify({ to, body: "", attachments: [{ url: u, name: "sec-store.png", size: png.length, type: "image/png" }] }) });
  try {
    const foreign = await send(`https://begona-dokon.public.blob.vercel-storage.com/uploads/${name}`);
    // Fayl diskda yoki R2'da saqlangan bo'lsa — Blob manzili umuman bizniki emas; Blob'da saqlangan bo'lsa — xost boshqa
    assert.equal(foreign.status, 422, `begona do'kon: ${foreign.status}`);
    const stranger = await req("cl", "/api/chat", { method: "POST", body: JSON.stringify({ to: (await dbRun("SELECT username FROM users WHERE email = ?", ["mutaxassis@redince.uz"])).rows[0]?.username, body: "", attachments: [{ url, name: "sec-store.png", size: png.length, type: "image/png" }] }) });
    assert.equal(stranger.status, 422, `boshqa foydalanuvchi yuklagan fayl: ${stranger.status}`);
    const real = await send(url);
    assert.equal(real.status, 201, `haqiqiy manzil: ${real.status}`);
  } finally {
    await dbRun("DELETE FROM dm_messages WHERE attachments LIKE ?", [`%${name}%`]);
    if (url.startsWith("/uploads/")) fs.rmSync(path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads"), name), { force: true });
  }
});

/* ------------------------- 5-AUDIT (2026-11-04): yopiq fayllar — imzolangan URL ------------------------- */

// Chat biriktirmasi xom saqlash manzili (Blob ommaviy!) bilan emas, `/api/media/<kind>/<id>` orqali beriladi:
// mehmon 401 · begona 404 · ishtirokchi 302 → tokenli /stream 200 · token boshqa sessiya/buzilgan/tokensiz → 403.
// Fixture: bazaga to'g'ridan-to'g'ri (mijoz ↔ mutaxassis suhbatiga rasm biriktirilgan xabar; yuklama papkasida 1×1 PNG).
import { createHmac, randomUUID } from "node:crypto";
import path from "node:path";
import { db as secDb } from "./e2e/_lib.mjs";

async function dmFixture() {
  const users = await secDb.execute({ sql: "select id, email from users where email in (?, ?)", args: ["mijoz@redince.uz", "mutaxassis@redince.uz"] });
  const cl = users.rows.find((r) => r.email === "mijoz@redince.uz")?.id;
  const sp = users.rows.find((r) => r.email === "mutaxassis@redince.uz")?.id;
  if (!cl || !sp) return null;
  const [a, b] = [String(cl), String(sp)].sort();
  let conv = (await secDb.execute({ sql: "select id from conversations where a_id = ? and b_id = ?", args: [a, b] })).rows[0]?.id;
  if (!conv) {
    conv = randomUUID();
    await secDb.execute({ sql: "insert into conversations (id, a_id, b_id, created_by, created_at) values (?, ?, ?, ?, ?)", args: [conv, a, b, a, Date.now()] });
  }
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `sec-media-${randomUUID()}.png`;
  // 1×1 shaffof PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  fs.writeFileSync(path.join(dir, fileName), png);
  const msgId = randomUUID();
  const attachments = JSON.stringify([{ url: `/uploads/${fileName}`, name: "sec-test.png", size: png.length, type: "image/png" }]);
  await secDb.execute({ sql: "insert into dm_messages (id, conversation_id, sender_id, body, attachments, created_at) values (?, ?, ?, ?, ?, ?)", args: [msgId, String(conv), String(cl), "", attachments, Date.now()] });
  const cleanup = async () => {
    await secDb.execute({ sql: "delete from dm_messages where id = ?", args: [msgId] }).catch(() => {});
    try {
      fs.unlinkSync(path.join(dir, fileName));
    } catch {}
  };
  return { conv: String(conv), msgId, fileName, size: png.length, cleanup };
}

test("Yopiq fayl: mehmon 401, noma'lum tur/ID 404", async () => {
  assert.equal((await req("guest", "/api/media/dm/x")).status, 401);
  assert.equal((await req("cl", "/api/media/xyz/abc_0")).status, 404, "noma'lum tur 404");
  assert.equal((await req("cl", "/api/media/dm/yoq-xabar_0")).status, 404, "yo'q xabar 404");
  assert.equal((await req("cl", "/api/media/material/yoq-dars_0")).status, 404, "yo'q dars 404");
  assert.equal((await req("cl", "/api/media/receipt/yoq-hisob")).status, 404, "yo'q chek 404");
  assert.equal((await req("cl", "/api/media/dm/yoq-xabar_0/stream")).status, 403, "tokensiz stream 403");
});

test("DM biriktirmasi: API'da xom manzil yo'q; begona 404; ishtirokchi 302 → tokenli stream 200; token boshqa sessiyada/buzilgan → 403", async (t) => {
  const f = await dmFixture();
  if (!f) return t.skip("demo hisoblar topilmadi");
  try {
    // 1) Suhbat DTO'sida xom manzil yo'q
    const thread = await (await req("cl", `/api/chat/${f.conv}`)).json();
    const item = thread?.data?.items?.find((m) => m.id === f.msgId);
    assert.ok(item, "fixture xabari suhbatda ko'rinishi kerak");
    assert.equal(item.attachments[0].url, `/api/media/dm/${f.msgId}_0`);
    assert.ok(!JSON.stringify(thread).includes(f.fileName), "suhbat javobida xom /uploads manzili sizdi");
    // 2) Begona (admin ham DM ishtirokchisi emas) → 404
    if (COOKIES.ad) assert.equal((await req("ad", `/api/media/dm/${f.msgId}_0`)).status, 404, "begona 404");
    // 3) Ishtirokchi → 302 tokenli stream
    const r = await req("cl", `/api/media/dm/${f.msgId}_0`);
    assert.equal(r.status, 302, `ishtirokchi: kutilgan 302, keldi ${r.status}`);
    const loc = r.headers.get("location") ?? "";
    assert.ok(loc.includes(`/api/media/dm/${f.msgId}_0/stream?t=`), `Location: ${loc}`);
    assert.ok(!loc.includes("/uploads/") && !loc.includes(f.fileName), "Location xom manzilni oshkor qiladi");
    const p = loc.replace(BASE, "");
    const s = await req("cl", p);
    assert.equal(s.status, 200, `stream: kutilgan 200, keldi ${s.status}`);
    assert.equal(s.headers.get("content-type"), "image/png");
    assert.equal(s.headers.get("x-content-type-options"), "nosniff");
    assert.ok((s.headers.get("content-disposition") ?? "").startsWith("inline"), "Content-Disposition inline");
    assert.ok((s.headers.get("cache-control") ?? "").includes("private"), "private kesh");
    assert.equal((await s.arrayBuffer()).byteLength, f.size);
    // 4) Token boshqa sessiyada (ikkinchi ishtirokchi ham) ishlamaydi; buzilgan/tokensiz → 403
    assert.equal((await req("sp", p)).status, 403, "boshqa sessiya tokeni 403");
    assert.equal((await req("cl", p + "x")).status, 403, "buzilgan token 403");
    assert.equal((await req("cl", p.split("?")[0])).status, 403, "tokensiz 403");
    assert.equal((await req("guest", p)).status, 401, "mehmon stream 401");
    // 5) Indeksdan tashqari biriktirma / muqova yo'q → 404
    assert.equal((await req("cl", `/api/media/dm/${f.msgId}_1`)).status, 404);
    assert.equal((await req("cl", `/api/media/dm/${f.msgId}_0_p`)).status, 404);
  } finally {
    await f.cleanup();
  }
});

/* ------------------------- Fikr bildirish (2026-11-04) ------------------------- */

test("Fikr: mehmon yubora oladi (qattiq limit bilan), XSS matni matn sifatida saqlanadi, begona admin ro'yxatini ko'ra olmaydi", async () => {
  const xss = `<img src=x onerror=alert(1)> fikr sinovi ${Date.now()}`;
  const r = await req("guest", "/api/fikr", { method: "POST", body: JSON.stringify({ kind: "bug", text: xss, page: "/top" }) });
  assert.ok([201, 429].includes(r.status), `mehmon fikr: kutilgan 201 (yoki limit 429), keldi ${r.status}`);
  // Admin ro'yxati: mehmon 401, oddiy foydalanuvchi 403
  assert.equal((await req("guest", "/api/admin/fikrlar")).status, 401);
  assert.equal((await req("cl", "/api/admin/fikrlar")).status, 403);
  assert.equal((await req("cl", "/api/admin/fikrlar", { method: "PATCH", body: JSON.stringify({ id: "x", status: "done" }) })).status, 403);
  if (r.status === 201 && COOKIES.ad) {
    const { data } = await r.json();
    const list = await req("ad", "/api/admin/fikrlar?status=open");
    assert.equal(list.status, 200);
    const j = await list.json();
    const row = j.data.items.find((x) => x.id === data.id);
    assert.ok(row, "admin ro'yxatida yangi fikr bor");
    assert.equal(row.text, xss, "matn o'zgartirilmasdan (xom) saqlanadi — UI matn sifatida chizadi");
    assert.equal(row.user, null, "mehmon fikri — user null");
    // Admin sahifasida React matn sifatida chizadi: xom <img ...> tegi HTML'da bo'lmasligi kerak
    const html = await (await req("ad", "/admin")).text();
    assert.ok(!html.includes("<img src=x onerror"), "admin sahifasida fikr matni ekranlangan");
    // Yopish — ro'yxatdan chiqadi
    const p = await req("ad", "/api/admin/fikrlar", { method: "PATCH", body: JSON.stringify({ id: data.id, status: "done" }) });
    assert.equal(p.status, 200);
  }
});

test("Fikr: tashqi skrinshot URL rad etiladi (422), bo'sh matn 422", async () => {
  const bad = await req("cl", "/api/fikr", { method: "POST", body: JSON.stringify({ kind: "idea", text: "skrinshot sinovi matni", screenshotUrl: "https://evil.example/x.png" }) });
  assert.ok([422, 429].includes(bad.status), `tashqi URL: kutilgan 422, keldi ${bad.status}`);
  const empty = await req("cl", "/api/fikr", { method: "POST", body: JSON.stringify({ kind: "idea", text: "" }) });
  assert.ok([422, 429].includes(empty.status), `bo'sh matn: kutilgan 422, keldi ${empty.status}`);
});

/* ------------------------- Moderatsiya (avto-yashirish) va yopiq profil (2026-11-04) ------------------------- */

/** Sinov hisobi: ro'yxatdan o'tadi (register limiti 5/soat IP) va sessiya cookie'sini qaytaradi */
async function registerTemp(role) {
  // Ro'yxat limiti (5/soat, IP) to'plamning o'zini to'xtatib qo'ymasin: sinov hisoblari soni limitdan ko'p — navbatdagi
  // testlar jim «o'tkazib yuborilardi» (hisobni egallash, hisob tuzog'i). Har hisob alohida TEST-NET manzilidan ochiladi
  // (proksisiz lokal/CI serverda `X-Forwarded-For` mijoz manzili sifatida olinadi); limitning o'zi bu yerda sinalmaydi.
  tempSeq = (tempSeq % 250) + 1;
  const email = `sec-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@sinov.local`;
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${tempSeq}` },
    body: JSON.stringify({ name: `Sinov ${role}`, email, password: "Sinov12345", role, acceptTerms: true }),
    redirect: "manual",
  });
  if (!r.ok) return null;
  const j = await r.json();
  const list = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") ?? ""];
  const cookie = list.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  // Sessiya haqiqatan ochilganini tekshiramiz (dev serverda qayta kompilyatsiya paytida birinchi so'rov 401 bo'lishi mumkin)
  for (let i = 0; i < 3; i++) {
    if ((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } })).status === 200) return { id: j.data.id, email, cookie };
    await new Promise((res) => setTimeout(res, 700));
  }
  return null;
}

/** Sinov hisoblarini bazadan o'chirish (cascade: post, shikoyat, obuna, so'rov) — libsql orqali, CI'da ham ishlaydi */
async function cleanupTemp(emails) {
  if (!emails.length) return;
  try {
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
    for (const e of emails) await db.execute({ sql: "DELETE FROM users WHERE email = ?", args: [e] });
  } catch {
    /* tozalash ixtiyoriy */
  }
}

const reqAs = (cookie, path, init = {}) => fetch(BASE + path, { ...init, headers: { Origin: ORIGIN, "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) }, redirect: "manual" });
const feedHas = async (cookie, id) => {
  const r = cookie ? await reqAs(cookie, "/api/feed?limit=30") : await req("guest", "/api/feed?limit=30");
  const j = await r.json();
  return Boolean(j.ok && j.data.items.some((p) => p.id === id));
};

test("Moderatsiya: 3 ta turli shikoyatchi → post lentadan yashirinadi; admin shikoyatni yopsa — qaytadi", async (t) => {
  const author = await registerTemp("specialist");
  if (!author) return t.skip("sinov hisobi yaratilmadi (register limiti 5/soat?)");
  const emails = [author.email];
  try {
    const pr = await reqAs(author.cookie, "/api/profil/postlar", { method: "POST", body: JSON.stringify({ body: "Moderatsiya sinovi — avto-yashirish", media: [] }) });
    assert.equal(pr.status, 201, `post yaratish: ${pr.status}`);
    const postId = (await pr.json()).data.id;
    assert.ok(await feedHas("", postId), "yangi post mehmon lentasida bo'lishi kerak");
    // O'ziga shikoyat qilib bo'lmaydi — sanalmaydi
    assert.equal((await reqAs(author.cookie, "/api/reports", { method: "POST", body: JSON.stringify({ targetType: "post", targetId: postId, reason: "spam" }) })).status, 400);
    // 3 ta turli shikoyatchi: demo mijoz, admin va demo mutaxassis; yetmasa vaqtinchalik hisob qo'shiladi
    const reporters = [COOKIES.cl, COOKIES.ad, COOKIES.sp].filter(Boolean);
    while (reporters.length < 3) {
      const more = await registerTemp("client");
      if (!more) break;
      emails.push(more.email);
      reporters.push(more.cookie);
    }
    if (reporters.length < 3) return t.skip("3 ta shikoyatchi yig'ilmadi");
    for (let i = 0; i < 3; i++) {
      const r = await reqAs(reporters[i], "/api/reports", { method: "POST", body: JSON.stringify({ targetType: "post", targetId: postId, reason: "spam" }) });
      assert.equal(r.status, 201, `shikoyat ${i + 1}: ${r.status}`);
      const j = await r.json();
      assert.equal(j.data.hidden, i === 2, `${i + 1}-shikoyatdan keyin hidden=${j.data.hidden}`);
    }
    assert.equal(await feedHas("", postId), false, "3 shikoyatdan keyin mehmon lentasida bo'lmasligi kerak");
    assert.equal(await feedHas(COOKIES.cl, postId), false, "mijoz lentasida ham yo'q");
    // Egasi o'z postini belgisi bilan ko'radi
    const own = await reqAs(author.cookie, `/api/profil/postlar?user=${author.id}`);
    const ownItems = (await own.json()).data.items;
    assert.ok(ownItems.some((p) => p.id === postId && p.hiddenByReports === true), "egasi yashirilgan postni hiddenByReports bilan ko'radi");
    // Mehmon profil lentasida ko'rmaydi
    const guestList = await req("guest", `/api/profil/postlar?user=${author.id}`);
    assert.ok(!(await guestList.json()).data.items.some((p) => p.id === postId), "mehmon profil lentasida yashirin post yo'q");
    if (!COOKIES.ad) return t.skip("admin sessiyasi yo'q — yopish bosqichi o'tkazib yuborildi");
    const list = await req("ad", "/api/admin/reports?status=open");
    const mine = (await list.json()).data.filter((r) => r.targetType === "post" && r.targetId === postId);
    assert.equal(mine.length, 3, "adminda 3 ta ochiq shikoyat");
    let restored = false;
    for (const r of mine) {
      const c = await req("ad", `/api/admin/reports/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
      assert.equal(c.status, 200);
      restored = restored || Boolean((await c.json()).data.restored);
    }
    assert.ok(restored, "oxirgi shikoyat yopilganda post qaytarilishi kerak");
    assert.ok(await feedHas("", postId), "admin yopgach post lentaga qaytadi");
  } finally {
    await cleanupTemp(emails);
  }
});

test("Yopiq profil: post mehmon va obunachi bo'lmaganga ko'rinmaydi; so'rov → tasdiq → obunachi ko'radi", async (t) => {
  const owner = await registerTemp("specialist");
  if (!owner) return t.skip("sinov hisobi yaratilmadi (register limiti?)");
  try {
    const priv = await reqAs(owner.cookie, "/api/account/privacy", { method: "PUT", body: JSON.stringify({ dmPolicy: "all", commentPolicy: "all", showOnline: true, profilePrivate: true }) });
    assert.equal(priv.status, 200, `yopiq profil sozlash: ${priv.status}`);
    const pr = await reqAs(owner.cookie, "/api/profil/postlar", { method: "POST", body: JSON.stringify({ body: "Yopiq profil sinovi", media: [] }) });
    assert.equal(pr.status, 201);
    const postId = (await pr.json()).data.id;
    const guest = await req("guest", `/api/profil/postlar?user=${owner.id}`);
    assert.equal((await guest.json()).data.items.length, 0, "mehmon yopiq profil postlarini ko'rmaydi");
    assert.equal(await feedHas("", postId), false, "mehmon lentasida yo'q");
    assert.equal(await feedHas(COOKIES.cl, postId), false, "obunachi bo'lmagan mijoz lentasida yo'q");
    assert.equal((await req("guest", `/api/posts/${postId}`)).status, 404, "mehmon bitta postni ham ocha olmaydi");
    // Mijoz obuna bosadi → so'rov; egasi tasdiqlaydi → obuna
    const f1 = await req("cl", `/api/follow/${owner.id}`, { method: "POST" });
    assert.equal(f1.status, 200);
    const f1j = await f1.json();
    assert.equal(f1j.data.status, "requested", "yopiq profilga obuna = so'rov");
    assert.equal(f1j.data.following, false);
    const st = await req("cl", `/api/follow/${owner.id}`);
    assert.equal((await st.json()).data.requested, true);
    // Begona so'rovlar ro'yxatini ko'rmaydi / hal qila olmaydi
    const reqs = await reqAs(owner.cookie, "/api/follow/sorovlar");
    const items = (await reqs.json()).data.items;
    assert.equal(items.length, 1, "egasida 1 ta so'rov");
    assert.equal((await req("guest", "/api/follow/sorovlar")).status, 401);
    assert.equal((await req("cl", `/api/follow/sorovlar/${items[0].id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) })).status, 404, "begona so'rovni tasdiqlay olmaydi");
    const ap = await reqAs(owner.cookie, `/api/follow/sorovlar/${items[0].id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
    assert.equal(ap.status, 200);
    assert.equal((await (await req("cl", `/api/follow/${owner.id}`)).json()).data.following, true, "tasdiqdan keyin obuna");
    const seen = await req("cl", `/api/profil/postlar?user=${owner.id}`);
    assert.ok((await seen.json()).data.items.some((p) => p.id === postId), "obunachi postni ko'radi");
    assert.ok(await feedHas(COOKIES.cl, postId), "obunachi lentasida bor");
    assert.equal(await feedHas("", postId), false, "mehmon hali ham ko'rmaydi");
  } finally {
    await cleanupTemp([owner.email]);
  }
});

test("Tasdiq so'rovi: mehmon 401, mijoz (profil yo'q) 404, admin verify_reject sababsiz 422", async () => {
  assert.equal((await req("guest", "/api/profile/tasdiq", { method: "POST" })).status, 401);
  if (COOKIES.cl) assert.equal((await req("cl", "/api/profile/tasdiq", { method: "POST" })).status, 404);
  if (COOKIES.ad) assert.equal((await req("ad", "/api/admin/specialists/yoq-id", { method: "PATCH", body: JSON.stringify({ action: "verify_reject", reason: "ab" }) })).status, 422);
  if (COOKIES.cl) assert.equal((await req("cl", "/api/admin/specialists/yoq-id", { method: "PATCH", body: JSON.stringify({ action: "verify_reject", reason: "sabab matni" }) })).status, 403);
});

test("Honeypot / tuzoq: soxta yo'llar jurnalga tushadi, canary bloklaydi, real route'lar tegilmaydi", async () => {
  // Soxta .env — ishonarli yolg'on, lekin HAQIQIY sir yo'q; canary kalit bor
  const env = await fetch(BASE + "/.env", { redirect: "manual" });
  assert.equal(env.status, 200, "/.env soxta javob 200");
  const envText = await env.text();
  assert.ok(envText.includes("ke_live_sk_"), "soxta .env canary kalit bor");
  // Haqiqiy AUTH_SECRET/TURSO token sizib chiqmasligi kerak (soxta qiymatlar generik)
  assert.ok(!/TURSO|libsql|AUTH_SECRET=/.test(envText), "soxta .env'da haqiqiy sir nomi yo'q");
  // Soxta login sahifasi
  const wp = await fetch(BASE + "/wp-login.php", { redirect: "manual" });
  assert.equal(wp.status, 200, "/wp-login.php soxta login 200");
  assert.ok((await wp.text()).toLowerCase().includes("login"), "soxta login HTML");
  // Real yo'q sahifa TUZOQ EMAS — oddiy 404
  assert.equal((await fetch(BASE + "/bunaqa-yoq-sahifa-tuzoq-test", { redirect: "manual" })).status, 404, "oddiy yo'q sahifa 404 (tuzoq emas)");

  // Admin tuzoq paneli: mehmon 401, mijoz 403, admin 200
  assert.equal((await req("guest", "/api/admin/tuzoq")).status, 401, "mehmon tuzoq 401");
  if (COOKIES.cl) assert.equal((await req("cl", "/api/admin/tuzoq")).status, 403, "mijoz tuzoq 403");
  if (!COOKIES.ad) return; // admin sessiyasi yo'q — qolgan qismi o'tkaziladi
  const stat = await req("ad", "/api/admin/tuzoq");
  assert.equal(stat.status, 200, "admin tuzoq 200");

  // Qo'lda blok/unblok — TEST-NET IP (203.0.113.x, hech qachon haqiqiy test-runner IP emas → o'zini bloklamaydi)
  const testIp = "203.0.113." + (50 + Math.floor(Math.random() * 40));
  const bl = await req("ad", "/api/admin/tuzoq", { method: "POST", body: JSON.stringify({ action: "block", ip: testIp, reason: "security.mjs sinovi" }) });
  assert.equal(bl.status, 200, "admin IP blokladi");
  const after = await (await req("ad", "/api/admin/tuzoq")).json();
  assert.ok(after.data.blocked.some((b) => b.ip === testIp && b.manual), "bloklangan ro'yxatda (qo'lda)");
  const un = await req("ad", "/api/admin/tuzoq", { method: "POST", body: JSON.stringify({ action: "unblock", ip: testIp }) });
  assert.equal(un.status, 200, "admin blokdan chiqardi");
  const after2 = await (await req("ad", "/api/admin/tuzoq")).json();
  assert.ok(!after2.data.blocked.some((b) => b.ip === testIp), "blokdan chiqdi");

  // Tozalash: bu test yaratgan lokal tuzoq izlari (takroriy run'da 127.0.0.1 o'zini bloklab qo'ymasin)
  try {
    const { createClient } = await import("@libsql/client");
    const d = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
    await d.execute("delete from honeypot_hits where ip in ('127.0.0.1','::1','unknown')");
    await d.execute("delete from blocked_ips where ip in ('127.0.0.1','::1','unknown')");
  } catch { /* CI'da baza fayli boshqacha bo'lsa — e'tiborsiz */ }
});

test("Efir ulashish (/efir/<id>): ochiq efir 200 + OG, yopiq jamoa efiri begonaga 404, yo'q efir 404", async (t) => {
  const { createClient } = await import("@libsql/client");
  const d = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
  const pub = (await d.execute("select id, owner_id from groups where is_private=0 limit 1")).rows[0];
  const priv = (await d.execute("select id, owner_id from groups where is_private=1 limit 1")).rows[0];
  if (!pub) return t.skip("ochiq jamoa yo'q");
  const pubId = "sectest_live_pub_" + Date.now();
  const privId = "sectest_live_priv_" + Date.now();
  const now = Date.now();
  await d.execute({ sql: "insert into live_streams (id, group_id, host_id, title, room, status, price_som, started_at) values (?, ?, ?, 'Sinov efiri', ?, 'ended', 0, ?)", args: [pubId, pub.id, pub.owner_id, "live_" + pubId, now - 3600_000] });
  if (priv) await d.execute({ sql: "insert into live_streams (id, group_id, host_id, title, room, status, price_som, started_at) values (?, ?, ?, 'MAXFIY-EFIR-SARLAVHA', ?, 'ended', 0, ?)", args: [privId, priv.id, priv.owner_id, "live_" + privId, now - 3600_000] });
  try {
    const ok = await fetch(BASE + "/efir/" + pubId, { redirect: "manual" });
    assert.equal(ok.status, 200, "ochiq jamoa efiri 200");
    const html = await ok.text();
    assert.ok(html.includes("Sinov efiri"), "sarlavha sahifada");
    assert.ok(/noindex/.test(html), "efir sahifasi indekslanmaydi");
    assert.equal((await fetch(BASE + "/efir/yoq-efir-xyz", { redirect: "manual" })).status, 404, "yo'q efir 404");
    if (priv) {
      const g = await fetch(BASE + "/efir/" + privId, { redirect: "manual" });
      assert.equal(g.status, 404, "yopiq jamoa efiri mehmonga 404");
      assert.ok(!(await g.text()).includes("MAXFIY-EFIR-SARLAVHA"), "yopiq efir sarlavhasi sizib chiqmaydi");
    }
  } finally {
    await d.execute({ sql: "delete from live_streams where id in (?, ?)", args: [pubId, privId] });
  }
});

test("AI saralash: yordamchi mehmonga 401, test javoblari nomzodga ko'rinmaydi, mos nomzodlar/taklif begonaga 403", async (t) => {
  assert.equal((await req("guest", "/api/vakansiyalar/yordamchi", { method: "POST", body: JSON.stringify({ brief: "Montajchi kerak, Premiere" }) })).status, 401, "mehmon yordamchi 401");
  if (!COOKIES.cl || !COOKIES.sp) return t.skip("sessiyalar yo'q");
  const screening = { questions: [{ id: "q1", text: "Tajribangiz haqida yozing", required: true }], quiz: [{ id: "t1", text: "Reels nisbati?", options: ["16:9", "9:16"], correct: 1 }] };
  const cr = await req("cl", "/api/vakansiyalar", { method: "POST", body: JSON.stringify({ title: "SEC saralash sinovi", profession: "video", description: "Sinov vakansiyasi: montaj, rang korreksiyasi va Reels tayyorlash.", format: "remote", regionSlug: "remote", skills: ["Premiere"], screening }) });
  if (cr.status === 429) return t.skip("vakansiya limiti");
  assert.ok(cr.status === 200 || cr.status === 201, `vakansiya yaratildi (${cr.status})`);
  const vid = (await cr.json()).data.id;
  try {
    const pub = (await (await req("sp", `/api/vakansiyalar/${vid}`)).json()).data;
    assert.ok(pub.screening.quiz.every((q) => !("correct" in q)), "nomzodga to'g'ri javob yo'q");
    assert.equal(pub.screeningFull, null, "screeningFull nomzodga null");
    assert.equal((await req("sp", `/api/vakansiyalar/${vid}/nomzodlar`)).status, 403, "begona mos nomzodlar 403");
    assert.equal((await req("sp", `/api/vakansiyalar/${vid}/taklif`, { method: "POST", body: JSON.stringify({ userId: "x" }) })).status, 403, "begona taklif 403");
    assert.equal((await req("guest", `/api/vakansiyalar/${vid}/nomzodlar`)).status, 401, "mehmon mos nomzodlar 401");
    const bad = await req("sp", `/api/vakansiyalar/${vid}/ariza`, { method: "POST", body: JSON.stringify({ coverLetter: "Salom, men tajribali montajchiman, qiziqaman." }) });
    assert.equal(bad.status, 422, "anketasiz ariza 422");
  } finally {
    await req("cl", `/api/vakansiyalar/${vid}`, { method: "DELETE" });
  }
});

test("Qisman PATCH yuborilmagan maydonlarni O'ZGARTIRMAYDI (zod v4 partial+default regressiyasi): vakansiya va yopiq jamoa", async (t) => {
  if (!COOKIES.cl) return t.skip("sessiya yo'q");
  // 1) Vakansiya: yopish/uzaytirish kompaniya, talab, format, tajriba, ko'nikmalarni o'chirib yubormasin
  const cr = await req("cl", "/api/vakansiyalar", { method: "POST", body: JSON.stringify({ title: "SEC qisman patch sinovi", company: "SEC Studio", profession: "video", description: "Sinov vakansiyasi: montaj, rang korreksiyasi va Reels tayyorlash.", requirements: "Portfolio bo'lishi shart", format: "office", employment: "part", experience: "middle", regionSlug: "samarqand", salaryMin: "3000000", salaryMax: "5000000", skills: ["Premiere", "DaVinci"] }) });
  if (cr.status === 429) return t.skip("vakansiya limiti");
  assert.ok(cr.status === 200 || cr.status === 201, `vakansiya yaratildi (${cr.status})`);
  const vid = (await cr.json()).data.id;
  try {
    for (const body of [{ status: "closed" }, { extend: true }]) {
      const r = await req("cl", `/api/vakansiyalar/${vid}`, { method: "PATCH", body: JSON.stringify(body) });
      assert.equal(r.status, 200, `PATCH ${JSON.stringify(body)}`);
      const v = (await r.json()).data;
      assert.equal(v.company, "SEC Studio", "kompaniya saqlandi");
      assert.equal(v.requirements, "Portfolio bo'lishi shart", "talablar saqlandi");
      assert.equal(v.format, "office", "format saqlandi");
      assert.equal(v.employment, "part", "bandlik saqlandi");
      assert.equal(v.experience, "middle", "tajriba saqlandi");
      assert.equal(v.regionSlug, "samarqand", "hudud saqlandi");
      assert.equal(v.salaryMin, 3000000, "maosh saqlandi");
      assert.deepEqual(v.skills, ["Premiere", "DaVinci"], "ko'nikmalar saqlandi");
    }
  } finally {
    await req("cl", `/api/vakansiyalar/${vid}`, { method: "DELETE" });
  }
  // 2) Yopiq kanal: bitta maydonni o'zgartirish uni OCHIQ guruhga aylantirmasin, tavsifini o'chirmasin
  const g = await req("cl", "/api/groups", { method: "POST", body: JSON.stringify({ name: "SEC yopiq kanal " + Date.now().toString(36), description: "Sinov tavsifi", isPrivate: true, kind: "channel" }) });
  if (g.status === 429) return t.skip("jamoa limiti");
  assert.ok(g.status === 200 || g.status === 201, `jamoa yaratildi (${g.status})`);
  const slug = (await g.json()).data.slug;
  try {
    const r = await req("cl", `/api/groups/${slug}`, { method: "PATCH", body: JSON.stringify({ rules: "Hurmat bilan yozing" }) });
    assert.equal(r.status, 200, "qoidalar yangilandi");
    const v = (await r.json()).data;
    assert.equal(v.isPrivate, true, "yopiq jamoa yopiqligicha qoldi");
    assert.equal(v.kind, "channel", "kanal kanalligicha qoldi");
    assert.equal(v.description, "Sinov tavsifi", "tavsif saqlandi");
  } finally {
    await req("cl", `/api/groups/${slug}`, { method: "DELETE" });
  }
});

/* ------------------------- 7-audit (2026-11-10): «mijoz/ijodkor bo'lib kirib buzish» yo'llari ------------------------- */

test("«Yaqin do'stlar» posti ID orqali o'qilmaydi: izoh/reaksiya/saqlash/ko'rish/keyinroq/to'plam — begonaga 404; qidiruvda yo'q", async (t) => {
  const owner = await registerTemp("specialist");
  if (!owner) return t.skip("sinov hisobi yaratilmadi (register limiti?)");
  try {
    const mark = `yaqinsinov${Date.now().toString(36)}`;
    // Auditoriya post bilan BIRGA yoziladi (ilgari avval ommaviy yaratilib, keyin PATCH qilinardi)
    const pr = await reqAs(owner.cookie, "/api/profil/postlar", { method: "POST", body: JSON.stringify({ body: `Faqat yaqin do'stlar uchun ${mark}`, media: [], audience: "close" }) });
    assert.equal(pr.status, 201, `yaqin do'stlar posti: ${pr.status}`);
    const id = (await pr.json()).data.id;
    assert.equal(await feedHas(COOKIES.cl, id), false, "begona lentasida yo'q");
    for (const [who, label] of [["guest", "mehmon"], ["cl", "begona mijoz"]]) {
      assert.equal((await req(who, `/api/posts/${id}`)).status, 404, `${label}: post 404`);
      assert.equal((await req(who, `/api/posts/${id}/comments`)).status, 404, `${label}: izohlar 404`);
      assert.equal((await req(who, `/api/posts/${id}/reactions`)).status, 404, `${label}: reaksiyalar 404`);
      assert.equal((await req(who, `/api/posts/${id}/view`, { method: "POST" })).status, 404, `${label}: ko'rish 404`);
    }
    for (const [path, init] of [
      [`/api/posts/${id}/save`, { method: "POST" }],
      [`/api/posts/${id}/like`, { method: "POST", body: JSON.stringify({ reaction: "heart" }) }],
      [`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ body: "begona izoh" }) }],
      [`/api/posts/${id}/keyinroq`, { method: "POST" }],
      [`/api/posts/${id}/progress`, { method: "POST", body: JSON.stringify({ position: 3, duration: 10 }) }],
      [`/api/posts/${id}/hide`, { method: "POST", body: JSON.stringify({ hidden: true }) }],
      [`/api/posts/${id}/toplamlar`, {}],
    ]) {
      assert.equal((await req("cl", path, init)).status, 404, `begona: ${init.method ?? "GET"} ${path.replace(id, ":id")} → 404`);
    }
    // To'plamga ham qo'shib bo'lmaydi (ID'ni taxmin qilib)
    const col = await req("cl", "/api/toplamlar", { method: "POST", body: JSON.stringify({ title: "Sinov to'plam" }) });
    if (col.status === 201 || col.status === 200) {
      const colId = (await col.json()).data.id;
      assert.equal((await req("cl", `/api/toplamlar/${colId}/items`, { method: "POST", body: JSON.stringify({ postId: id }) })).status, 404, "begona: to'plamga qo'shish 404");
      await req("cl", `/api/toplamlar/${colId}`, { method: "DELETE" });
    }
    // Egasi o'zi ko'radi
    assert.equal((await reqAs(owner.cookie, `/api/posts/${id}/comments`)).status, 200, "muallif izohlarni ko'radi");
    // Qidiruv sahifasida begonaga chiqmaydi
    const html = await (await fetch(`${BASE}/qidiruv?q=${mark}`, { headers: { Cookie: COOKIES.cl ?? "" } })).text();
    assert.ok(!html.includes(`/mutaxassislar/`) || !html.includes(mark + '"'), "qidiruv natijasida post havolasi yo'q");
    assert.ok(!new RegExp(`post=${id}`).test(html), "qidiruvda yaqin do'stlar posti chiqmagan");
  } finally {
    await cleanupTemp([owner.email]);
  }
});

test("Rejalashtirilgan post: begona kanalga yozib bo'lmaydi (403), mijoz profilga rejalashtira olmaydi", async (t) => {
  if (!COOKIES.sp || !COOKIES.cl) return t.skip("demo sessiyalar yo'q");
  // Kanal: faqat egasi/adminlar yozadi. Egasi — mutaxassis; mijoz a'zo bo'lsa ham reja orqali yoza olmasligi kerak.
  const name = `Sinov kanal ${Date.now().toString(36)}`;
  const g = await req("sp", "/api/groups", { method: "POST", body: JSON.stringify({ name, description: "Rejalashtirish ruxsati sinovi", kind: "channel" }) });
  if (g.status !== 201 && g.status !== 200) return t.skip(`sinov kanali yaratilmadi (${g.status})`);
  const slug = (await g.json()).data.slug;
  const { createClient } = await import("@libsql/client");
  const d = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
  try {
    const gid = (await d.execute({ sql: "select id from groups where slug = ?", args: [slug] })).rows[0]?.id;
    assert.ok(gid, "kanal bazada bor");
    const runAt = Date.now() + 20 * 60 * 1000;
    const body = "Begona kanalga reja orqali post";
    // a'zo emas
    assert.equal((await req("cl", "/api/rejalashtirilgan", { method: "POST", body: JSON.stringify({ body, media: [], groupId: gid, runAt }) })).status, 403, "a'zo bo'lmagan: id bilan → 403");
    assert.equal((await req("cl", "/api/rejalashtirilgan", { method: "POST", body: JSON.stringify({ body, media: [], groupSlug: slug, runAt }) })).status, 403, "a'zo bo'lmagan: slug bilan → 403");
    // a'zo bo'ldi — kanalda baribir faqat egasi/adminlar yozadi
    await req("cl", `/api/groups/${slug}/join`, { method: "POST", body: JSON.stringify({}) });
    assert.equal((await req("cl", "/api/rejalashtirilgan", { method: "POST", body: JSON.stringify({ body, media: [], groupSlug: slug, runAt }) })).status, 403, "kanal a'zosi (admin emas) → 403");
    assert.equal((await req("cl", "/api/rejalashtirilgan", { method: "POST", body: JSON.stringify({ body, media: [], groupId: "yoq-jamoa-id", runAt }) })).status, 404, "mavjud bo'lmagan jamoa → 404");
    assert.equal((await req("cl", "/api/rejalashtirilgan", { method: "POST", body: JSON.stringify({ body: "Mijoz profil posti", media: [], runAt }) })).status, 403, "mijoz profilga post rejalashtira olmaydi");
    const left = await d.execute({ sql: "select count(*) as n from scheduled_posts where body = ?", args: [body] });
    assert.equal(Number(left.rows[0].n), 0, "rad etilgan reja bazaga yozilmagan");
    // Egasi rejalashtira oladi (jamoaga ketadi — ilgari profilga tushib qolardi)
    const own = await req("sp", "/api/rejalashtirilgan", { method: "POST", body: JSON.stringify({ body: "Egasining rejasi", media: [], groupSlug: slug, runAt }) });
    assert.equal(own.status, 201, `kanal egasi rejalashtiradi: ${own.status}`);
    const row = (await d.execute({ sql: "select group_id from scheduled_posts where id = ?", args: [(await own.json()).data.id] })).rows[0];
    assert.equal(row?.group_id, gid, "reja aynan shu jamoaga bog'langan");
  } finally {
    await d.execute({ sql: "delete from scheduled_posts where group_id in (select id from groups where slug = ?)", args: [slug] }).catch(() => undefined);
    await d.execute({ sql: "delete from groups where slug = ?", args: [slug] }).catch(() => undefined);
  }
});

test("JSON-LD saqlangan XSS: savol sarlavhasidagi </script> sahifada skript tegini yopmaydi", async (t) => {
  if (!COOKIES.cl) return t.skip("mijoz sessiyasi yo'q");
  const payload = `Sinov savoli </script><script>window.__xss=1</script> ${Date.now().toString(36)}`;
  const r = await req("cl", "/api/savollar", { method: "POST", body: JSON.stringify({ title: payload, body: "JSON-LD qochirish sinovi" }) });
  if (r.status !== 201) return t.skip(`savol yaratilmadi (${r.status}) — sarlavha validatsiyada rad etilgan bo'lsa ham xavfsiz`);
  const id = (await r.json()).data.id;
  try {
    const html = await (await fetch(`${BASE}/savollar/${id}`)).text();
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    assert.ok(ld.length >= 1, "JSON-LD bloki bor");
    assert.ok(!html.includes("</script><script>window.__xss=1"), "xom </script><script> sahifada yo'q");
    assert.ok(ld.some((b) => b.includes("\\u003c/script\\u003e")), "sarlavha JSON-LD ichida \\u003c ko'rinishida qochirilgan");
    for (const b of ld) JSON.parse(b.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")); // har blok to'g'ri JSON
  } finally {
    await req("cl", `/api/savollar/${id}`, { method: "DELETE" });
  }
});

test("Highlights: yopiq profilning saqlangan story to'plamlari begonaga ko'rinmaydi", async (t) => {
  const owner = await registerTemp("specialist");
  if (!owner) return t.skip("sinov hisobi yaratilmadi (register limiti?)");
  try {
    const h = await reqAs(owner.cookie, "/api/highlights", { method: "POST", body: JSON.stringify({ title: "Sinov" }) });
    assert.equal(h.status, 201, `highlight yaratish: ${h.status}`);
    const hid = (await h.json()).data.id;
    assert.equal((await (await req("guest", `/api/highlights?user=${owner.id}`)).json()).data.items.length, 1, "ochiq profilda ko'rinadi");
    const priv = await reqAs(owner.cookie, "/api/account/privacy", { method: "PUT", body: JSON.stringify({ dmPolicy: "all", commentPolicy: "all", showOnline: true, profilePrivate: true }) });
    assert.equal(priv.status, 200);
    assert.equal((await (await req("guest", `/api/highlights?user=${owner.id}`)).json()).data.items.length, 0, "yopiq profil: mehmonga bo'sh");
    assert.equal((await (await req("cl", `/api/highlights?user=${owner.id}`)).json()).data.items.length, 0, "yopiq profil: begonaga bo'sh");
    assert.equal((await req("cl", `/api/highlights/${hid}`)).status, 404, "yopiq profil: to'plam ID orqali ham 404");
    assert.equal((await reqAs(owner.cookie, `/api/highlights/${hid}`)).status, 200, "egasi ko'radi");
  } finally {
    await cleanupTemp([owner.email]);
  }
});

test("Hisobni egallash yo'llari yopiq: band email bilan ro'yxat (422), tasdiqlash kodi «tiklash tokeni» bo'lib o'tmaydi", async (t) => {
  // 1) @telegram.local (bot hisoblarining vaqtinchalik manzili) va *.internal bilan saytdan ro'yxatdan o'tib bo'lmaydi
  for (const email of [`tg${Date.now()}@telegram.local`, "kimdir@kasbegalari.internal"]) {
    const r = await req("guest", "/api/auth/register", { method: "POST", body: JSON.stringify({ name: "Band Email", email, password: "Sinov12345", role: "client", acceptTerms: true }) });
    assert.equal(r.status, 422, `${email} → 422 (keldi: ${r.status})`);
    assert.ok((await r.json()).fields?.email, "xato email maydonida");
  }
  // 2) Email tasdiqlash kodi (6 raqam) parolni tiklash tokeni sifatida ishlamaydi
  const u = await registerTemp("client");
  if (!u) return t.skip("sinov hisobi yaratilmadi (register limiti?)");
  const { createClient } = await import("@libsql/client");
  const { createHash, randomUUID } = await import("node:crypto");
  const d = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
  try {
    const code = "424242";
    const hash = createHash("sha256").update(`${code}:${u.id}`).digest("hex");
    await d.execute({ sql: "insert into password_resets (id, user_id, token_hash, purpose, expires_at) values (?, ?, ?, 'verify_email', ?)", args: [randomUUID(), u.id, hash, Date.now() + 10 * 60 * 1000] });
    const r = await req("guest", "/api/auth/reset/confirm", { method: "POST", body: JSON.stringify({ token: `${code}:${u.id}`, newPassword: "Buzilgan12345" }) });
    assert.equal(r.status, 400, `tasdiqlash kodi tiklash tokeni emas (keldi: ${r.status})`);
    const stolen = await req("guest", "/api/auth/login", { method: "POST", body: JSON.stringify({ email: u.email, password: "Buzilgan12345" }) });
    assert.equal(stolen.status, 401, "parol o'zgarmagan — yangi parol bilan kirib bo'lmaydi");
    const still = await d.execute({ sql: "select used_at from password_resets where token_hash = ?", args: [hash] });
    assert.equal(still.rows[0]?.used_at ?? null, null, "tasdiqlash kodi «ishlatilgan» deb belgilanmagan");
    // 3) Emailni band manzilga o'zgartirib bo'lmaydi
    const ch = await reqAs(u.cookie, "/api/profile", { method: "PATCH", body: JSON.stringify({ name: "Sinov client", email: "tg777000111@telegram.local", currentPassword: "Sinov12345" }) });
    assert.equal(ch.status, 422, `emailni band manzilga o'zgartirish → 422 (keldi: ${ch.status})`);
  } finally {
    await cleanupTemp([u.email]);
  }
});

test("Hisob tuzog'i: begona manzillarni terib chiqqan hisob adminga ko'rinadi va muzlatiladi; oddiy takror so'rov sanalmaydi", async (t) => {
  const u = await registerTemp("client");
  if (!u) return t.skip("sinov hisobi yaratilmadi (register limiti?)");
  const { createClient } = await import("@libsql/client");
  const d = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
  const score = async () => Number((await d.execute({ sql: "select count from rate_limits where key = ?", args: [`abuse:${u.id}`] })).rows[0]?.count ?? 0);
  try {
    // 1) Bitta manzilni 12 marta so'rash (sahifa takror so'rovi) — bir marta sanaladi
    for (let i = 0; i < 12; i++) await reqAs(u.cookie, "/api/posts/yoq-post-bir-xil/comments");
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(await score(), 1, "bir xil manzil takrori — 1 ball");
    // 2) Admin yo'liga urinish og'irroq (5 ball)
    assert.equal((await reqAs(u.cookie, "/api/admin/tuzoq")).status, 403);
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(await score(), 6, "admin yo'li — +5 ball");
    // 3) Turli begona ID'larni terib chiqish (IDOR sinovi) — ball o'sadi, 30 dan oshganda audit yozuvi paydo bo'ladi
    for (let i = 0; i < 30; i++) await reqAs(u.cookie, `/api/posts/idor-sinov-${i}/comments`);
    await new Promise((r) => setTimeout(r, 1200));
    assert.ok((await score()) >= 30, `ball 30 dan oshdi (${await score()})`);
    const al = await d.execute({ sql: "select count(*) as n from audit_logs where actor_id = ? and action = 'abuse_suspected'", args: [u.id] });
    assert.equal(Number(al.rows[0].n), 1, "adminlar uchun «shubhali hisob» audit yozuvi (bir marta)");
    assert.equal((await reqAs(u.cookie, "/api/feed?limit=1")).status, 200, "ogohlantirish bosqichida hisob hali ishlaydi");
    // 4) Davom etsa — muzlatiladi: API 429, sessiya yopiladi
    for (let i = 0; i < 95; i++) await reqAs(u.cookie, `/api/posts/idor-sinov-b${i}/comments`);
    await new Promise((r) => setTimeout(r, 1500));
    const fz = await d.execute({ sql: "select reset_at from rate_limits where key = ?", args: [`frozen:${u.id}`] });
    assert.ok(Number(fz.rows[0]?.reset_at ?? 0) > Date.now(), "hisob muzlatildi");
    const after = await reqAs(u.cookie, "/api/feed?limit=1");
    assert.ok(after.status === 429 || after.status === 200, `muzlatilgach eski sessiya yopilgan (lenta mehmon sifatida ${after.status})`);
    assert.equal((await reqAs(u.cookie, "/api/posts/saved")).status, 401, "eski sessiya endi ishlamaydi (401)");
    // Qayta kirsa ham — muzlatish tugaguncha 429
    const relog = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ email: u.email, password: "Sinov12345" }), redirect: "manual" });
    const list = typeof relog.headers.getSetCookie === "function" ? relog.headers.getSetCookie() : [relog.headers.get("set-cookie") ?? ""];
    const cookie2 = list.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
    if (relog.ok && cookie2) {
      const blocked = await reqAs(cookie2, "/api/posts/saved");
      assert.equal(blocked.status, 429, "qayta kirgach ham API 429");
      assert.ok(!/ball|IDOR|urinish|tuzoq/i.test((await blocked.json()).error ?? ""), "xabar sababni oshkor qilmaydi");
    }
  } finally {
    await d.execute({ sql: "delete from rate_limits where key in (?, ?)", args: [`abuse:${u.id}`, `frozen:${u.id}`] }).catch(() => undefined);
    await d.execute("delete from rate_limits where key like 'abuse1:%'").catch(() => undefined);
    await cleanupTemp([u.email]);
  }
});

/** Brauzer sarlavhalari (Fetch Metadata) — tuzoq «kim so'rayapti»ni shular bo'yicha ajratadi */
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const NAV_HEADERS = { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "uz,ru;q=0.8", "sec-fetch-site": "none", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-user": "?1" };
const IMG_HEADERS = { "user-agent": BROWSER_UA, accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "accept-language": "uz,ru;q=0.8", "sec-fetch-site": "same-origin", "sec-fetch-mode": "no-cors", "sec-fetch-dest": "image" };
const XHR_HEADERS = { "user-agent": BROWSER_UA, accept: "*/*", "accept-language": "uz,ru;q=0.8", "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" };
const LOCAL_IP_RE = /^(?:127\.0\.0\.1|::1|::ffff:127\.)/;
/**
 * Xom HTTP so'rov (node:http): Node `fetch` `sec-fetch-mode` ni o'zi "cors" qilib qayta yozadi — brauzer navigatsiyasini
 * taqlid qilib bo'lmaydi. Bu yordamchi sarlavhalarni AYNAN berilgandek yuboradi. Natija: { status, text }.
 */
async function raw(path, headers = {}, init = {}) {
  const { request } = await import("node:http");
  const u = new URL(BASE + path);
  return new Promise((resolve, reject) => {
    const r = request({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: init.method ?? "GET", headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    r.on("error", reject);
    if (init.body) r.write(init.body);
    r.end();
  });
}

test("Tuzoq pranklari: hujum imzosi sahifa/API'ga yetmaydi (418), oddiy qidiruv ishlaydi, canary email bloklaydi, admin blokni yechadi", async (t) => {
  const cleanup = async () => {
    try {
      const { createClient } = await import("@libsql/client");
      const d = createClient({ url: process.env.DATABASE_URL || "file:./data/redince.db" });
      await d.execute("delete from honeypot_hits where ip in ('127.0.0.1','::1','unknown') or ip like '::ffff:127.%'");
      await d.execute("delete from blocked_ips where ip in ('127.0.0.1','::1','unknown') or ip like '::ffff:127.%'");
    } catch { /* e'tiborsiz */ }
  };
  const stats = async () => (await (await req("ad", "/api/admin/tuzoq")).json()).data;
  /** Server keshidagi blokni ham darhol tozalaydi (admin API `bustCache` qiladi) */
  const unblockLocal = async () => {
    if (!COOKIES.ad) return;
    for (const b of (await stats())?.blocked ?? []) if (LOCAL_IP_RE.test(b.ip)) await req("ad", "/api/admin/tuzoq", { method: "POST", body: JSON.stringify({ action: "unblock", ip: b.ip }) });
  };
  const waitBlocked = async (re) => {
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const hit = (await stats())?.blocked?.find((b) => LOCAL_IP_RE.test(b.ip) && re.test(b.reason));
      if (hit) return hit.ip;
    }
    return null;
  };
  try {
    await cleanup();
    await unblockLocal();

    // 0) TUZOQNI QUROLGA AYLANTIRIB BO'LMAYDI: brauzerning ichki so'rovlari (begona odam qo'ygan <img>, prefetch) iz qoldirmaydi,
    //    brauzerda ochilgan havola va qidiruv boti esa faqat «yumshoq» yoziladi — nechta bo'lsa ham IP bloklanmaydi.
    for (let i = 0; i < 6; i++) {
      const img = await raw("/boshqaruv-7731", IMG_HEADERS);
      assert.equal(img.status, 404, "<img src=tuzoq> → oddiy 404");
    }
    assert.equal((await raw("/.env", { ...IMG_HEADERS, "sec-fetch-dest": "iframe", "sec-fetch-mode": "navigate", "sec-fetch-site": "cross-site" })).status, 404, "begona saytdagi iframe → 404");
    const form = "log=a&pwd=b";
    assert.equal((await raw("/wp-login.php", { ...NAV_HEADERS, "sec-fetch-site": "cross-site", "content-type": "application/x-www-form-urlencoded", "content-length": String(form.length) }, { method: "POST", body: form })).status, 404, "begona saytdagi yashirin forma → 404");
    for (let i = 0; i < 5; i++) {
      const nav = await raw("/wp-login.php", NAV_HEADERS);
      assert.equal(nav.status, 200, "brauzerda ochilgan tuzoq → soxta login");
    }
    const navCanary = await raw("/boshqaruv-7731", { ...NAV_HEADERS, "sec-fetch-site": "same-origin" });
    assert.equal(navCanary.status, 200, "chatdagi havola orqali canary yo'li → soxta login (blok emas)");
    const bot = await raw("/.env", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", accept: "text/html" });
    assert.equal(bot.status, 404, "qidiruv botiga soxta .env berilmaydi (404)");
    assert.ok(!bot.text.includes("ke_live_sk_"), "botga canary kalit chiqmagan");
    const xhrProbe = await raw("/api/vakansiyalar?q=" + encodeURIComponent("<script>alert(1)</script>"), XHR_HEADERS);
    assert.equal(xhrProbe.status, 418, "brauzerdan API imzo → 418 (lekin blokka sanalmaydi)");
    if (COOKIES.ad) {
      await new Promise((r) => setTimeout(r, 900));
      const st = await stats();
      assert.ok(!st.blocked.some((b) => LOCAL_IP_RE.test(b.ip)), "brauzer so'rovlari IP'ni BLOKLAMADI (12+ urinish)");
      const mine = st.recent.filter((h) => LOCAL_IP_RE.test(h.ip));
      assert.ok(mine.length >= 6 && mine.every((h) => h.soft === true), `faqat yumshoq yozuvlar (${mine.length} ta)`);
      assert.ok(mine.filter((h) => h.path.startsWith("/boshqaruv-7731")).length === 1, "rasm so'rovlari yozilmagan — faqat bitta navigatsiya");
    }

    // 1) Sahifa manzilidagi XSS / SQLi / fayl o'qish urinishi → 418 hazil sahifa; payload haqiqiy sahifaga yetmaydi
    for (const [q, word] of [["/qidiruv?q=" + encodeURIComponent("<script>alert(1)</script>"), "bajarilmaydi"], ["/mutaxassislar?q=" + encodeURIComponent("' OR 1=1 --"), "Jadvallar"], ["/ishlar?f=" + encodeURIComponent("../../../../etc/passwd"), "fayl"]]) {
      const r = await fetch(BASE + q, { redirect: "manual", headers: { accept: "text/html" } });
      assert.equal(r.status, 418, `${q} → 418`);
      const html = await r.text();
      assert.ok(html.includes("buzib kirmang"), "hazil sahifa: «buzib kirmang»");
      assert.ok(html.includes(word), `sabab matni (${word})`);
      assert.ok(!html.includes("<script>alert(1)</script>"), "payload sahifaga aks etmagan");
      assert.ok(!/bloklan|jurnal|IP:|urinish —/i.test(html), "hazil sahifa himoya tafsilotini (blok, jurnal, IP) oshkor qilmaydi");
    }
    // 2) Soxta signal yo'q: o'zbekcha apostrof, «javascript», «select», «union» so'zlari oddiy qidiruvda ishlaydi
    for (const q of ["o'zbek tilida javascript kursi", "select union video", "Premiere Pro <3", "a'lo or b'lo"]) {
      const r = await fetch(BASE + "/qidiruv?q=" + encodeURIComponent(q), { redirect: "manual" });
      assert.equal(r.status, 200, `oddiy qidiruv «${q}» 200`);
    }
    // 3) API manzilida imzo → 418 JSON (route'ga yetmaydi)
    const api = await req("guest", "/api/vakansiyalar?q=" + encodeURIComponent("' or 1=1--"));
    assert.equal(api.status, 418, "API imzo 418");
    assert.ok(/buzib kirmang/.test((await api.json()).error ?? ""), "API hazil xabari");
    // 4) security.txt va xabar berish sahifasi
    const sec = await fetch(BASE + "/.well-known/security.txt");
    assert.equal(sec.status, 200, "security.txt 200");
    assert.ok(/^Contact: /m.test(await sec.text()), "security.txt Contact");
    assert.equal((await fetch(BASE + "/xavfsizlik")).status, 200, "/xavfsizlik 200");
    // 5) O'z saytimizning sahifa manzili avatar/rasm bo'la olmaydi (ko'ruvchilar brauzeri o'sha manzilga so'rov yubormasin)
    if (COOKIES.sp) {
      const me = (await (await req("sp", "/api/auth/me")).json()).data?.user ?? {};
      const own = await req("sp", "/api/profile", { method: "PATCH", body: JSON.stringify({ name: me.name ?? "Sinov Hisob", avatarUrl: `https://${new URL(BASE).host}/boshqaruv-7731` }) });
      assert.equal(own.status, 422, "avatar = sayt sahifasi manzili → 422");
      assert.ok((await own.json()).fields?.avatarUrl, "xato aynan avatarUrl maydonida");
    }

    if (!COOKIES.ad) return; // admin sessiyasiz qolgan qismni sinab bo'lmaydi (blokni yechib bo'lmaydi)

    // 6) SKANER (brauzer bo'lmagan mijoz): «yashirin API» yemi + soxta .env → to'liq hisob → 4-urinishda avtomatik blok.
    //    Blok FAQAT vositaga: shu IP ortidagi haqiqiy brauzer (bitta NAT) ishlayveradi.
    const bait = await req("guest", "/api/v1/users");
    assert.equal(bait.status, 418, "/api/v1/users yem 418");
    const env = await fetch(BASE + "/.env", { redirect: "manual" });
    assert.equal(env.status, 200, "skanerga soxta .env beriladi");
    assert.ok((await env.text()).includes("ke_live_sk_"), "soxta .env ichida canary kalit");
    const autoIp = await waitBlocked(/Tuzoqqa/);
    assert.ok(autoIp, "skaner avtomatik bloklandi");
    assert.equal((await req("guest", "/api/vakansiyalar")).status, 403, "bloklangan IP'dan VOSITA so'rovi → 403");
    assert.equal((await raw("/api/vakansiyalar", XHR_HEADERS)).status, 200, "shu IP ortidagi BRAUZER ishlayveradi (avtomatik blok unga tegmaydi)");
    await unblockLocal();
    await cleanup();

    // 7) Canary email bilan kirish → oddiy 401, lekin IP bloklanadi; ALLAQACHON kirgan admin blokni yecha oladi
    const login = await req("guest", "/api/auth/login", { method: "POST", body: JSON.stringify({ email: "sysadmin@kasbegalari.internal", password: "Kasb#2026#r00t!" }) });
    assert.equal(login.status, 401, "canary login oddiy 401 ko'rinadi");
    const blockedIp = await waitBlocked(/Canary/i);
    assert.ok(blockedIp, "canary login IP'ni blokladi");
    assert.equal((await req("guest", "/api/vakansiyalar")).status, 403, "bloklangan IP API'da 403");
    const un = await req("ad", "/api/admin/tuzoq", { method: "POST", body: JSON.stringify({ action: "unblock", ip: blockedIp }) });
    assert.equal(un.status, 200, "kirgan admin bloklangan IP'dan ham blokni yechadi");
    assert.equal((await req("guest", "/api/vakansiyalar")).status, 200, "blok yechilgach API ishlaydi");

    // 8) Qo'lda (admin) blok — brauzerga ham amal qiladi
    const man = await req("ad", "/api/admin/tuzoq", { method: "POST", body: JSON.stringify({ action: "block", ip: blockedIp, reason: "sinov: qo'lda blok" }) });
    assert.equal(man.status, 200, "qo'lda blok qo'yildi");
    assert.equal((await raw("/api/vakansiyalar", XHR_HEADERS)).status, 403, "qo'lda blok brauzerga ham 403");
    await unblockLocal();
    assert.equal((await raw("/api/vakansiyalar", XHR_HEADERS)).status, 200, "qo'lda blok yechildi");
  } finally {
    await unblockLocal().catch(() => undefined);
    await cleanup();
  }
});
