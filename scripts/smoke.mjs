#!/usr/bin/env node
/**
 * Smoke testlar (E77/F94): ishlab turgan serverga qarshi tez tekshiruvlar — ma'lumotga bog'liq emas
 * (seed bo'lmasa ham o'tadi; profil testi ro'yxatdagi birinchi mutaxassisni oladi).
 *
 *   BASE_URL=http://localhost:3000 node --test scripts/smoke.mjs     (yoki: npm run test:smoke)
 *
 * Faqat node:test + fetch — qo'shimcha paket kerak emas. Hech narsa yozmaydi (login testi mavjud bo'lmagan email bilan).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const ORIGIN = new URL(BASE).origin;
/** Dev serverda birinchi so'rov sahifani kompilyatsiya qiladi — kengroq muddat */
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 90_000);

function req(path, init = {}) {
  return fetch(BASE + path, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT), ...init });
}

async function json(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    assert.fail(`JSON kutilgan edi (${res.status}): ${text.slice(0, 200)}`);
  }
}

/** Ro'yxatdagi birinchi mutaxassis (keyingi testlar uchun) */
let firstSlug = null;

test("health: /api/health → 200, baza ok", async () => {
  const res = await req("/api/health");
  assert.equal(res.status, 200);
  const body = await json(res);
  assert.equal(body.ok, true);
  assert.equal(body.db, "ok");
  assert.match(res.headers.get("cache-control") || "", /no-store/);
});

test("bosh sahifa: / → 200 HTML, CSP nonce bilan", async () => {
  const res = await req("/");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  const csp = res.headers.get("content-security-policy") || "";
  assert.match(csp, /script-src[^;]*'nonce-/, "CSP script-src nonce'siz");
  const html = await res.text();
  assert.match(html, /Redince/);
});

test("ro'yxat API: /api/specialists — shakl va maxfiylik (aloqa ma'lumotlari yo'q)", async () => {
  const res = await req("/api/specialists?limit=5");
  assert.equal(res.status, 200);
  const body = await json(res);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.data.items), "data.items massiv emas");
  assert.equal(typeof body.data.total, "number");
  assert.match(res.headers.get("cache-control") || "", /private|no-store/);
  for (const it of body.data.items) {
    assert.equal(typeof it.slug, "string");
    assert.equal(typeof it.title, "string");
    assert.equal(typeof it.user?.name, "string");
    for (const k of ["phone", "email", "telegram", "instagram"]) {
      assert.ok(!(k in it) && !(it.user && k in it.user && it.user[k]), `ro'yxat elementida "${k}" chiqmasligi kerak (${it.slug})`);
    }
  }
  firstSlug = body.data.items[0]?.slug ?? null;
});

test("profil: 200 va mehmon uchun yashirin telefon chiqmaydi", async (t) => {
  if (!firstSlug) {
    t.skip("ro'yxat bo'sh — profil testi o'tkazib yuborildi");
    return;
  }
  const page = await req(`/mutaxassislar/${encodeURIComponent(firstSlug)}`);
  assert.equal(page.status, 200);
  const html = await page.text();

  const api = await req(`/api/specialists/${encodeURIComponent(firstSlug)}`);
  assert.equal(api.status, 200);
  const { data } = await json(api);
  assert.equal(data.user?.email ?? null, null, "mehmonga email ko'rinmasligi kerak");
  if (data.locked?.phone) {
    assert.equal(data.user?.phone ?? null, null, "telefon yopiq (locked) — DTO'da bo'lmasligi kerak");
    assert.doesNotMatch(html, /\+998[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, "HTML'da telefon raqami bor");
  }
});

test("e'lonlar: /ishlar → 200", async () => {
  const res = await req("/ishlar");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
});

test("CSRF: Origin'siz POST → 403", async () => {
  const res = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "smoke@example.invalid", password: "x" }),
  });
  assert.equal(res.status, 403);
});

test("login: noto'g'ri parol → 401", async () => {
  const email = `smoke-${Date.now().toString(36)}@example.invalid`;
  const res = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password: "noto-gri-parol-123" }),
  });
  assert.equal(res.status, 401);
  const body = await json(res);
  assert.equal(body.ok, false);
  assert.equal(typeof body.error, "string");
  assert.equal(res.headers.get("set-cookie"), null, "xato loginda sessiya cookie berilmasligi kerak");
});

test("noma'lum profil → 404 (sahifa va API)", async () => {
  const slug = `yoq-profil-${Date.now().toString(36)}`;
  const page = await req(`/mutaxassislar/${slug}`);
  assert.equal(page.status, 404);
  const api = await req(`/api/specialists/${slug}`);
  assert.equal(api.status, 404);
});

test("himoyalangan sahifa: mehmon /kabinet → kirishga yo'naltiriladi", async () => {
  const res = await req("/kabinet");
  assert.ok([302, 303, 307, 308].includes(res.status), `yo'naltirish kutilgan edi, keldi ${res.status}`);
  assert.match(res.headers.get("location") || "", /\/auth\/kirish/);
});

test("PWA: manifest, service worker va oflayn sahifa", async () => {
  const m = await req("/manifest.webmanifest");
  assert.equal(m.status, 200);
  const manifest = await json(m);
  assert.ok(manifest.icons?.some((i) => i.sizes === "512x512"), "512px ikonka yo'q");
  const sw = await req("/sw.js");
  assert.equal(sw.status, 200);
  assert.match(sw.headers.get("content-type") || "", /javascript/);
  const off = await req("/offline");
  assert.equal(off.status, 200);
});

test("yordam markazi: /yordam va maqola → 200", async () => {
  assert.equal((await req("/yordam")).status, 200);
  assert.equal((await req("/yordam/eskrou-qanday-ishlaydi")).status, 200);
  assert.equal((await req("/yordam/yoq-maqola")).status, 404);
});
