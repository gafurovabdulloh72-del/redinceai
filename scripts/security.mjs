/**
 * Xavfsizlik testlari (2026-10-25 auditi, 26-band).
 * Smoke testlar funksiyani tekshiradi; bu yerda AVTORIZATSIYA tekshiriladi:
 * begona foydalanuvchi boshqa odamning resursiga tega olmasligi, mehmon yopiq
 * route'ga kira olmasligi, CSRF va limitlar ishlashi.
 *
 * Ishga tushirish: dev server ishlab tursin, keyin `node --test scripts/security.mjs`.
 * Jar fayllar (/tmp/sp.jar, /tmp/cl.jar, /tmp/ad.jar) scratchpad'dagi restart-dev.sh bilan yaratiladi.
 */
import { test } from "node:test";
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

/* ------------------------- 5-AUDIT (2026-11-04): yopiq fayllar — imzolangan URL ------------------------- */

// Chat biriktirmasi xom saqlash manzili (Blob ommaviy!) bilan emas, `/api/media/<kind>/<id>` orqali beriladi:
// mehmon 401 · begona 404 · ishtirokchi 302 → tokenli /stream 200 · token boshqa sessiya/buzilgan/tokensiz → 403.
// Fixture: bazaga to'g'ridan-to'g'ri (mijoz ↔ mutaxassis suhbatiga rasm biriktirilgan xabar; yuklama papkasida 1×1 PNG).
import { randomUUID } from "node:crypto";
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
  const email = `sec-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@sinov.local`;
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
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
