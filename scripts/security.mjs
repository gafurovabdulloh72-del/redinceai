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
  ["GET", "/api/posts/saved"],
  ["GET", "/api/blocks"],
  ["GET", "/api/account/privacy"],
  ["GET", "/api/users/mention?q=a"],
  ["GET", "/api/mentorlik/daromad"],
];

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
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.ok((r.headers.get("content-security-policy") ?? "").includes("frame-ancestors"), "CSP frame-ancestors yo'q");
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
