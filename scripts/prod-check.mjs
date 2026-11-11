/**
 * PRODUCTION faqat-o'qish xavfsizlik tekshiruvi (5-audit, 2026-11-04 — «pentest ssenariylarini prod'da takrorlash»).
 * Sandbox prod'ga yeta olmaydi, GitHub Actions yetadi: `.github/workflows/prod-check.yml` (qo'lda + har kuni).
 *
 * FAQAT mutatsiyasiz so'rovlar (GET/HEAD): hech qanday POST/PUT/PATCH/DELETE yo'q, hisobga kirilmaydi, baza o'zgarmaydi.
 * Tekshiriladi: xavfsizlik sarlavhalari, mehmonga yopiq API'lar 401, /api/health, robots/sitemap, yumshoq 404 qoidasi,
 * ruscha til cookie'si. Ishga tushirish: `PROD_URL=https://kasbegalari.vercel.app node --test scripts/prod-check.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = (process.env.PROD_URL || "https://kasbegalari.vercel.app").replace(/\/+$/, "");
const UA = "kasb-egalari-prod-check/1 (+security self-test; read-only)";
// Saytdagi PROD_CHECK_TOKEN bilan bir xil bo'lsa — tuzoq tekshiruvi adminlarga ogohlantirish yubormaydi
const SELF = (process.env.PROD_CHECK_TOKEN || "").trim();

/** Faqat GET/HEAD — boshqa metod bu skriptda umuman ishlatilmaydi */
async function get(path, headers = {}, method = "GET") {
  if (method !== "GET" && method !== "HEAD") throw new Error("prod-check faqat GET/HEAD yuboradi");
  return fetch(BASE + path, { method, headers: { "user-agent": UA, ...(SELF ? { "x-self-test": SELF } : {}), ...headers }, redirect: "manual", signal: AbortSignal.timeout(20_000) });
}

test("Xavfsizlik sarlavhalari (bosh sahifa)", async () => {
  const r = await get("/");
  assert.ok([200, 301, 302, 307, 308].includes(r.status), `bosh sahifa: ${r.status}`);
  const h = (k) => r.headers.get(k) ?? "";
  const csp = h("content-security-policy");
  assert.ok(csp, "CSP sarlavhasi yo'q");
  assert.ok(csp.includes("report-uri"), "CSP report-uri yo'q (CSP buzilishlari jurnalga tushmaydi)");
  assert.ok(/frame-ancestors [^;]*'self'/.test(csp), "CSP frame-ancestors 'self' yo'q");
  assert.equal(h("x-frame-options"), "SAMEORIGIN");
  assert.equal(h("cross-origin-opener-policy"), "same-origin-allow-popups");
  assert.equal(h("x-permitted-cross-domain-policies"), "none");
  assert.equal(h("x-content-type-options"), "nosniff");
  assert.ok(/max-age=\d+/.test(h("strict-transport-security")), `HSTS yo'q yoki noto'g'ri: "${h("strict-transport-security")}"`);
  assert.ok(!h("content-security-policy").includes("report-to"), "CSP'da report-to bo'lmasin (Chrome report-uri'ni tashlab yuboradi)");
});

// scripts/security.mjs GUEST_FORBIDDEN bilan bir xil ro'yxat (+ admin health, yopiq fayl route'lari). Barchasi GET.
const GUEST_401 = [
  "/api/chat",
  "/api/chat/stream",
  "/api/posts/saved",
  "/api/blocks",
  "/api/account/privacy",
  "/api/users/mention?q=a",
  "/api/mentorlik/daromad",
  "/api/mentorlik/kurslar/saqlangan",
  "/api/notifications",
  "/api/admin/health",
  "/api/admin/moderation",
  "/api/media/dm/x_0",
  "/api/media/group/x_0",
  "/api/media/order/x_0",
  "/api/media/material/x_0",
  "/api/media/receipt/x",
  "/api/media/dm/x_0/stream",
];
for (const path of GUEST_401) {
  test(`mehmon: GET ${path} → 401`, async () => {
    const r = await get(path);
    assert.equal(r.status, 401, `${path}: kutilgan 401, keldi ${r.status}`);
    assert.ok((r.headers.get("cache-control") ?? "").includes("no-store"), "API javobi keshlanmasin");
  });
}

test("/api/health → 200 {ok:true, db:ok}", async () => {
  const r = await get("/api/health");
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.equal(j.db, "ok");
});

test("robots.txt va sitemap.xml → 200", async () => {
  const robots = await get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.ok((await robots.text()).toLowerCase().includes("sitemap"), "robots.txt sitemap'ga ishora qilsin");
  const sm = await get("/sitemap.xml");
  assert.equal(sm.status, 200);
  assert.ok((await sm.text()).includes("<urlset"), "sitemap urlset emas");
});

test("Yumshoq 404 yo'q: /mutaxassislar/yoq-slug → 404", async () => {
  const r = await get("/mutaxassislar/yoq-slug-prod-check-404");
  assert.equal(r.status, 404, `kutilgan 404, keldi ${r.status} (loading.tsx Suspense'dan 200 sizib ketyapti)`);
});

test("Yumshoq 404 yo'q: /mentorlik/<yoq-kurs> va /vakansiyalar/<yoq> → 404", async () => {
  for (const p of ["/mentorlik/yoq-kurs-prod-check-404", "/mentorlik/ustoz/yoq-ustoz-prod-check-404", "/vakansiyalar/yoq-vakansiya-prod-check-404"]) {
    const r = await get(p);
    assert.equal(r.status, 404, `${p}: kutilgan 404, keldi ${r.status}`);
  }
});

test("Ruscha til: /narxlar + Cookie til=ru → kirill matn", async () => {
  const r = await get("/narxlar", { cookie: "til=ru" });
  assert.equal(r.status, 200, `narxlar: ${r.status}`);
  const html = await r.text();
  assert.ok(/[Ѐ-ӿ]{3,}/.test(html), "ruscha rejimda kirill matn topilmadi");
});

test("Ochiq yo'naltirish yo'q: /api/til?next=//evil", async () => {
  const r = await get(`/api/til?t=uz&next=${encodeURIComponent("//evil.example")}`);
  assert.ok([302, 303, 307].includes(r.status), `kutilgan 303, keldi ${r.status}`);
  const loc = new URL(r.headers.get("location") ?? "/", BASE);
  assert.equal(loc.origin, new URL(BASE).origin, `begona manzilga yo'naltirildi: ${loc.href}`);
});

test("Himoyalangan video: yo'q dars/efir → 404, tokensiz stream → 403", async () => {
  assert.equal((await get("/api/mentorlik/video/yoq-dars-prod-check")).status, 404);
  assert.equal((await get("/api/live/yoq-efir-prod-check/video")).status, 404);
  assert.equal((await get("/api/live/yoq-efir-prod-check/video/stream")).status, 403);
});

test("Honeypot: /.env soxta javob beradi (haqiqiy sir yo'q), real 404 tuzoq emas", async () => {
  const env = await get("/.env");
  // Soxta .env 200 (tuzoq) yoki 404 — lekin HAQIQIY sir nomi hech qachon chiqmasligi kerak
  if (env.status === 200) {
    const t = await env.text();
    assert.ok(!/TURSO_AUTH_TOKEN|DATABASE_AUTH_TOKEN|libsql:\/\//.test(t), "/.env da haqiqiy sir nomi chiqmasin");
  }
  assert.equal((await get("/bunaqa-yoq-sahifa-404-check")).status, 404, "oddiy yo'q sahifa 404 (tuzoq emas)");
});

test("Path traversal: /uploads/../.env → 404 (yoki tuzoqning SOXTA javobi)", async () => {
  // fetch `..` bo'laklarini o'zi yechadi: "/uploads/../.env" serverga "/.env" bo'lib boradi — u esa 2026-11-06 dan beri
  // TUZOQ (honeypot) va ataylab 200 + soxta fayl qaytaradi. Shuning uchun 200 faqat javob soxta ekani isbotlansa qabul
  // qilinadi (canary kalit bor, haqiqiy sir nomi yo'q); aks holda — haqiqiy sizib chiqish, test yiqiladi.
  for (const p of ["/uploads/../.env", "/uploads/..%2f.env", "/_next/static/../../package.json"]) {
    const r = await get(p);
    if (r.status === 200) {
      const t = await r.text();
      assert.ok(t.includes("ke_live_sk_"), `${p}: 200, lekin tuzoq javobi emas (haqiqiy fayl sizib chiqqan bo'lishi mumkin)`);
      assert.ok(!/TURSO_AUTH_TOKEN|DATABASE_AUTH_TOKEN|libsql:\/\/|"dependencies"/.test(t), `${p}: javobda haqiqiy sir/fayl mazmuni bor`);
      continue;
    }
    assert.ok([400, 404].includes(r.status), `${p}: ${r.status}`);
  }
});
