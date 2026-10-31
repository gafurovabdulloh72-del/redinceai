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
