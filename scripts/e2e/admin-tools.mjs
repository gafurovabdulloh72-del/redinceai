/**
 * ADMIN VOSITALARI E2E (2026-11-10): xatolar jurnali, tayyorlik ro'yxati, sayt e'loni + texnik ishlar, audit ko'ruvchisi,
 * cron holati, tezlik cheklovlari, foydalanuvchi xavfsizlik vositalari.
 *
 * Ishga tushirish (server ishlab turishi kerak; admin paroli — seed'dagi yoki ADMIN_PASSWORD):
 *   BASE_URL=http://127.0.0.1:3300 ADMIN_PASSWORD=admin12345 node --test scripts/e2e/admin-tools.mjs
 *
 * Har yangi admin API uchun: mehmon 401 · mijoz/mutaxassis 403 · admin 200. Test o'zi yaratgan yozuvlarni tozalaydi
 * (xato yozuvlari, limit qatorlari, sinov IP bloki) va e'lon/texnik ishlar sozlamasini avvalgi holatiga qaytaradi.
 * So'rov IP'lari — TEST-NET (198.51.100.x): haqiqiy foydalanuvchi limitlariga tegmaydi.
 */
import fs from "node:fs";
import { BASE, cookies, db, finish, makeReq, ok } from "./_lib.mjs";

const C = await cookies();
C.guest = "";
const req = makeReq(C);
const json = (body) => JSON.stringify(body);
const RUN = `e2e${Date.now().toString(36)}`;
/** Har chaqiruvda yangi sinov IP'si (limitlar kesishmasin) */
let ipSeq = Math.floor(Math.random() * 200);
const nextIp = () => `198.51.100.${(ipSeq++ % 250) + 1}`;
const sql = (q, args = []) => db.execute({ sql: q, args });

if (!C.ad) {
  ok(false, "admin sessiyasi olinmadi — ADMIN_PASSWORD (va kerak bo'lsa ADMIN_EMAIL) env bering");
  finish();
}

// Takroriy ishga tushirishda admin limitlari (cron 6/soat, parol havolasi 5/soat) testni yiqitmasin
await sql("DELETE FROM rate_limits WHERE key LIKE 'adminCron:%' OR key LIKE 'adminReset:%' OR key LIKE 'clientError:198.51.100.%'");

const ids = Object.fromEntries((await sql("SELECT id, email FROM users WHERE email IN ('mijoz@redince.uz','mutaxassis@redince.uz')")).rows.map((r) => [r.email, r.id]));
const clId = ids["mijoz@redince.uz"];
const spId = ids["mutaxassis@redince.uz"];
const adId = (await (await req("ad", "/api/auth/me")).json()).data?.id;
ok(Boolean(clId && spId && adId), "sinov hisoblari topildi");

// Avvalgi e'lon/texnik ishlar holati — oxirida qaytariladi
const before = (await (await req("ad", "/api/admin/sayt-elon")).json()).data;

try {
  /* ------------------------------------------------------------------ */
  /* 1. Ruxsatlar: mehmon 401 · mijoz/mutaxassis 403 · admin 200          */
  /* ------------------------------------------------------------------ */
  const GETS = ["/api/admin/xatolar", "/api/admin/tayyorlik", "/api/admin/sayt-elon", "/api/admin/texnik-ishlar", "/api/admin/cron", "/api/admin/limitlar", `/api/admin/users/${spId}/sessions`, "/api/admin/audit?limit=1"];
  for (const p of GETS) {
    const [g, c, s, a] = await Promise.all([req("guest", p), req("cl", p), req("sp", p), req("ad", p)]);
    ok(g.status === 401 && c.status === 403 && s.status === 403 && a.status === 200, `GET ${p.replace(spId, "<id>")}: mehmon 401 · mijoz 403 · mutaxassis 403 · admin 200`, `${g.status}/${c.status}/${s.status}/${a.status}`);
  }
  // O'zgartiruvchi so'rovlar: admin bo'lmaganlar route mantig'iga YETMAYDI (zararsiz tana — baribir rad etiladi)
  const MUTS = [
    ["PATCH", "/api/admin/xatolar", { ids: ["x"], resolved: true }],
    ["DELETE", "/api/admin/xatolar?scope=all"],
    ["PUT", "/api/admin/sayt-elon", { textUz: "Begona e'lon" }],
    ["DELETE", "/api/admin/sayt-elon"],
    ["PUT", "/api/admin/texnik-ishlar", { on: true }],
    ["POST", "/api/admin/cron", { dry: true }],
    ["DELETE", "/api/admin/limitlar?key=login%3Ax"],
    ["POST", "/api/admin/limitlar", { keys: ["login:x"] }],
    ["POST", `/api/admin/users/${clId}/sessions`, { action: "revoke_all" }],
    ["POST", `/api/admin/users/${clId}/parol`, {}],
  ];
  for (const [method, p, body] of MUTS) {
    const init = { method, ...(body ? { body: json(body) } : {}) };
    const [g, c, s] = await Promise.all([req("guest", p, init), req("cl", p, init), req("sp", p, init)]);
    ok(g.status === 401 && c.status === 403 && s.status === 403, `${method} ${p.replace(clId, "<id>")}: mehmon 401 · mijoz 403 · mutaxassis 403`, `${g.status}/${c.status}/${s.status}`);
  }
  // Begona urinishlardan keyin holat o'zgarmagan
  const still = (await (await req("ad", "/api/admin/sayt-elon")).json()).data;
  ok(still.maintenance.on === before.maintenance.on && (still.banner?.version ?? null) === (before.banner?.version ?? null), "begona urinishlar sozlamani o'zgartirmadi");

  /* ------------------------------------------------------------------ */
  /* 2. Xatolar jurnali: POST /api/xato                                   */
  /* ------------------------------------------------------------------ */
  const xato = (body, { ip = nextIp(), who = "guest", headers = {} } = {}) => req(who, "/api/xato", { method: "POST", body: typeof body === "string" ? body : json(body), headers: { "x-forwarded-for": ip, ...headers } });
  const rowOf = async (marker) => (await sql("SELECT * FROM error_logs WHERE message LIKE ? ORDER BY last_at DESC LIMIT 1", [`%${marker}%`])).rows[0];

  const SECRET_EMAIL = "ali.sirli@example.com";
  const SECRET_PHONE = "+998 90 123 45 67";
  const SECRET_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzaXJsaS11c2VyIn0.c2lybGktaW16by1xaXltYXRp";
  const SECRET_TOKEN = "Zx8Qm3kLp0aVbN4sT7uYw2eRt6yHj9cDf1gXo5iKqM";
  const m1 = `${RUN}-pii`;
  const r1 = await xato({
    name: "TypeError",
    message: `${m1}: foydalanuvchi ${SECRET_EMAIL} tel ${SECRET_PHONE} jwt ${SECRET_JWT} Bearer ${SECRET_TOKEN} manzil https://sayt.uz/x?token=${SECRET_TOKEN}`,
    stack: `TypeError: ${SECRET_EMAIL}\n    at f (https://sayt.uz/_next/static/chunks/app.js?t=${SECRET_TOKEN}:10:20)`,
    path: `/kabinet/chat?conv=${SECRET_TOKEN}`,
    source: `https://sayt.uz/app.js?k=${SECRET_TOKEN}`,
    line: 10,
    col: 20,
    type: "error",
  });
  ok(r1.status === 200, "oddiy brauzer xatosi qabul qilindi (mehmon)", String(r1.status));
  const row1 = await rowOf(m1);
  ok(Boolean(row1) && row1.kind === "client" && Number(row1.count) === 1 && row1.user_id === null, "xato jurnalga yozildi (klient, mehmon)");
  const stored = JSON.stringify(row1 ?? {});
  ok(!stored.includes(SECRET_EMAIL) && !stored.includes("ali.sirli"), "email saqlanmadi");
  ok(!stored.includes("90 123 45 67") && !stored.includes("998 90"), "telefon saqlanmadi");
  ok(!stored.includes(SECRET_JWT) && !stored.includes(SECRET_TOKEN), "token/JWT saqlanmadi (xabar, stek, yo'l, qo'shimcha)");
  ok(row1?.path === "/kabinet/chat", "yo'l so'rov satrisiz saqlandi", String(row1?.path));
  ok(String(row1?.stack ?? "").includes("/_next/static/chunks/app.js:10:20"), "stek kadri saqlandi (qator:ustun bilan)");

  // Takror — o'sha guruh: count oshadi
  await xato({ name: "TypeError", message: `${m1}: foydalanuvchi boshqa@example.com tel ${SECRET_PHONE} jwt ${SECRET_JWT} Bearer ${SECRET_TOKEN} manzil https://sayt.uz/x?token=${SECRET_TOKEN}`, stack: `TypeError: x\n    at f (https://sayt.uz/_next/static/chunks/app.js:10:20)`, path: "/kabinet/chat" });
  const row1b = await rowOf(m1);
  ok(Number(row1b?.count) === 2 && row1b?.id === row1?.id, "takror xato bitta qatorda: count 2", String(row1b?.count));

  // Kirgan foydalanuvchi: user_id sessiyadan (tanadan EMAS)
  const m2 = `${RUN}-user`;
  ok((await xato({ message: `${m2}: Cannot read properties of undefined` }, { who: "cl" })).status === 200, "kirgan foydalanuvchi xatosi qabul qilindi");
  ok((await rowOf(m2))?.user_id === clId, "foydalanuvchi sessiyadan aniqlandi");
  ok((await xato({ message: `${RUN}-soxta`, userId: adId })).status === 422, "tanadagi begona maydon (userId) rad etildi — 422");

  // Noto'g'ri / katta so'rovlar
  ok((await xato("{yomon json")).status === 400, "buzuq JSON → 400");
  ok((await xato({})).status === 422, "xabarsiz hisobot → 422");
  ok((await xato({ message: "x".repeat(1500) })).status === 422, "juda uzun xabar → 422");
  ok((await xato({ message: "a", stack: "y".repeat(20000) })).status === 413, "katta tana → 413");
  ok((await fetch(`${BASE}/api/xato`, { method: "POST", headers: { "content-type": "application/json" }, body: json({ message: "origin yo'q" }) })).status === 403, "Origin'siz so'rov → 403 (CSRF)");
  // Shovqin jim tashlanadi
  const m3 = `${RUN}-ext`;
  ok((await xato({ message: `${m3} x is not defined`, stack: "at chrome-extension://abcdefgh/content.js:1:1" })).status === 200 && !(await rowOf(m3)), "brauzer kengaytmasi xatosi saqlanmadi");
  ok((await xato({ message: "Script error." })).status === 200, "«Script error.» qabul qilinadi, lekin saqlanmaydi");

  // IP bo'yicha limit: 30 ta / soat — 31-chi 429
  const floodIp = nextIp();
  let last = 0;
  for (let i = 0; i < 31; i++) last = (await xato({}, { ip: floodIp })).status;
  ok(last === 429, "bitta IP'dan 31-hisobot → 429", String(last));
  ok((await xato({ message: `${RUN}-boshqa-ip` })).status === 200, "boshqa IP cheklanmagan");

  /* ------------------------------------------------------------------ */
  /* 3. Xatolar jurnali: admin API                                        */
  /* ------------------------------------------------------------------ */
  const list = (await (await req("ad", `/api/admin/xatolar?q=${RUN}&limit=2`)).json()).data;
  ok(Array.isArray(list.items) && list.items.length === 2 && typeof list.nextCursor === "string", "admin ro'yxati: sahifa 2 ta + kursor");
  ok(typeof list.counts.open === "number" && list.counts.open >= 3, "sanoqlar qaytdi", JSON.stringify(list.counts));
  const page2 = (await (await req("ad", `/api/admin/xatolar?q=${RUN}&limit=2&before=${encodeURIComponent(list.nextCursor)}`)).json()).data;
  ok(page2.items.length >= 1 && !page2.items.some((x) => list.items.some((y) => y.id === x.id)), "kursor bo'yicha keyingi sahifa takrorlanmaydi");
  ok(!JSON.stringify(list).includes(SECRET_TOKEN) && !JSON.stringify(list).includes("user_agent"), "admin javobida token yo'q, xom user-agent yo'q");

  const target = (await (await req("ad", `/api/admin/xatolar?q=${m1}`)).json()).data.items[0];
  const res = await req("ad", "/api/admin/xatolar", { method: "PATCH", body: json({ ids: [target.id], resolved: true }) });
  ok(res.status === 200 && (await res.json()).data.changed === 1, "«Hal qilindi» belgilandi");
  ok(((await (await req("ad", `/api/admin/xatolar?holat=resolved&q=${m1}`)).json()).data.items[0]?.resolvedAt ?? null) !== null, "hal qilinganlar filtrida ko'rinadi");
  // Hal qilingan xato qaytsa — yana ochiq
  await xato({ name: "TypeError", message: `${m1}: foydalanuvchi x@example.com tel ${SECRET_PHONE} jwt ${SECRET_JWT} Bearer ${SECRET_TOKEN} manzil https://sayt.uz/x`, stack: `TypeError: x\n    at f (https://sayt.uz/_next/static/chunks/app.js:10:20)`, path: "/kabinet/chat" });
  const reopened = await rowOf(m1);
  ok(reopened?.resolved_at === null && Number(reopened?.count) === 3, "hal qilingan xato qayta uchradi → yana ochiq, count 3");
  ok((await req("ad", `/api/admin/xatolar?id=${target.id}`, { method: "DELETE" })).status === 200 && !(await rowOf(m1)), "yozuv o'chirildi");
  ok((await req("ad", "/api/admin/xatolar?id=yoq-yozuv", { method: "DELETE" })).status === 404, "yo'q yozuv → 404");
  ok((await req("ad", "/api/admin/xatolar", { method: "DELETE" })).status === 400, "nima o'chirilishi ko'rsatilmagan → 400");
  const auditErr = (await sql("SELECT action FROM audit_logs WHERE target_id = ? ORDER BY created_at DESC", [target.id])).rows.map((r) => r.action);
  ok(auditErr.includes("admin_error_resolved") && auditErr.includes("admin_error_deleted"), "xato amallari audit jurnalida");

  /* ------------------------------------------------------------------ */
  /* 4. Tayyorlik ro'yxati — env qiymatlari hech qachon qaytmaydi         */
  /* ------------------------------------------------------------------ */
  const rd = await req("ad", "/api/admin/tayyorlik");
  const rdText = await rd.text();
  const report = JSON.parse(rdText).data;
  ok(Array.isArray(report.checks) && report.checks.length >= 20 && report.checks.every((c) => c.key && c.title && c.detail && ["ok", "warn", "fail"].includes(c.status)), "tekshiruvlar ro'yxati to'liq", String(report.checks?.length));
  ok(report.checks.every((c) => report.groups.some((g) => g.key === c.group)), "har band ma'lum guruhda");
  ok(report.checks.filter((c) => c.status !== "ok").every((c) => typeof c.fix === "string" && c.fix.length > 10), "har muammoda «qanday tuzatiladi» bor");
  const s = report.summary;
  ok(s.total === report.checks.length && s.ok + s.warn + s.fail === s.total && s.percent >= 0 && s.percent <= 100, "yig'indi mos", JSON.stringify(s));
  for (const key of ["site_url", "auth_secret", "db", "cron_secret", "cron_run", "seed_password", "admin_2fa", "demo_accounts", "data_key", "payme_test", "email", "telegram_bot", "storage", "livekit", "gemini"]) {
    if (!report.checks.some((c) => c.key === key)) ok(false, `tayyorlik bandi yo'q: ${key}`);
  }
  // Maxfiy env qiymatlari: .env fayli (bo'lsa) + jarayon muhiti. Javob matnida BIRORTASI uchramasligi kerak
  const secrets = new Map();
  const SENSITIVE = /SECRET|TOKEN|PASSWORD|_KEY|KEY_|DATABASE_URL|TURSO|RESEND|MAIL_FROM|ADMIN_EMAIL|CARD|MERCHANT|SERVICE_ID|R2_|LIVEKIT|VAPID|CLIENT_ID/;
  try {
    for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && SENSITIVE.test(m[1])) secrets.set(m[1], m[2].replace(/^["']|["']$/g, ""));
    }
  } catch {
    /* .env yo'q (CI) — faqat jarayon muhiti */
  }
  for (const [k, v] of Object.entries(process.env)) if (SENSITIVE.test(k) && v) secrets.set(k, v);
  const leaked = [...secrets].filter(([, v]) => v.length >= 6 && rdText.includes(v)).map(([k]) => k);
  ok(leaked.length === 0, `tayyorlik javobida env qiymati yo'q (${secrets.size} ta tekshirildi)`, leaked.join(","));
  ok(!/admin12345|demo12345/.test(rdText), "javobda standart parol matni yo'q");

  /* ------------------------------------------------------------------ */
  /* 5. Sayt e'loni va texnik ishlar                                      */
  /* ------------------------------------------------------------------ */
  const put = (body) => req("ad", "/api/admin/sayt-elon", { method: "PUT", body: json(body) });
  for (const href of ["javascript:alert(1)", "//evil.example/x", "http://evil.example/x", "data:text/html,x"]) {
    ok((await put({ textUz: "Sinov e'loni", href })).status === 422, `xavfli havola rad etildi: ${href.slice(0, 18)}`);
  }
  ok((await put({ textUz: "Sinov e'loni", until: Date.now() - 1000 })).status === 422, "o'tgan muddat rad etildi");
  ok((await put({ textUz: "ab" })).status === 422, "juda qisqa matn rad etildi");
  ok((await put({ textUz: "Sinov", tone: "qizil" })).status === 422, "noma'lum ohang rad etildi");

  const UZ = `Sinov e'loni ${RUN} — <b>teg</b> ishlamaydi`;
  const RU = `Тестовое объявление ${RUN}`;
  const saved = (await (await put({ textUz: UZ, textRu: RU, tone: "warn", href: "/yordam", until: Date.now() + 3600_000 })).json()).data;
  ok(saved.banner.textUz === UZ && saved.banner.textRu === RU && saved.banner.tone === "warn" && saved.banner.href === "/yordam" && typeof saved.banner.version === "number", "e'lon saqlandi");
  const got = (await (await req("ad", "/api/admin/sayt-elon")).json()).data;
  ok(got.banner.version === saved.banner.version && got.active === true, "e'lon qayta o'qildi (round-trip)");

  const home = async (cookie = "") => (await fetch(`${BASE}/yordam`, { headers: cookie ? { cookie } : {} })).text();
  const htmlUz = await home();
  ok(htmlUz.includes('data-site-notice="banner"') && htmlUz.includes(`Sinov e&#x27;loni ${RUN}`), "tashrifchi e'lonni ko'radi (uz)");
  ok(!htmlUz.includes("<b>teg</b>"), "e'lon matni HTML sifatida chizilmaydi (ekranlanadi)");
  ok((await home("til=ru")).includes(RU), "rus tilida ruscha matn");
  ok(!(await home(`ke_banner=${saved.banner.version}`)).includes('data-site-notice="banner"'), "yopilgan versiya (cookie) chizilmaydi");
  ok((await home("ke_banner=1")).includes('data-site-notice="banner"'), "eski versiya cookie'si yangi e'lonni yashirmaydi");

  // Texnik ishlar
  const mPut = (body) => req("ad", "/api/admin/texnik-ishlar", { method: "PUT", body: json(body) });
  const MSG = `Baza ko'chirilmoqda ${RUN}`;
  const on = (await (await mPut({ on: true, messageUz: MSG, messageRu: "" })).json()).data;
  ok(on.on === true && on.messageUz === MSG && typeof on.since === "number", "texnik ishlar rejimi yoqildi");
  const htmlM = await home();
  ok(htmlM.includes('data-site-notice="maintenance"') && htmlM.includes(RUN) && !htmlM.includes('data-site-notice="banner"'), "tashrifchi texnik ishlar ogohlantirishini ko'radi (oddiy e'lon o'rnida)");
  // To'siq handler() ga ulangan bo'lsa: admin bo'lmaganlarning o'zgartirishi 503, admin va istisnolar ishlaydi
  const probe = () => req("cl", "/api/posts/yoq-post-e2e/view", { method: "POST" });
  const blocked = await probe();
  if (blocked.status === 503) {
    ok(((await blocked.json()).error ?? "").includes(RUN), "to'siq: mijoz o'zgartirishi 503 + admin yozgan xabar");
    ok((await req("ad", "/api/posts/yoq-post-e2e/view", { method: "POST" })).status !== 503, "to'siq: admin to'liq ishlaydi");
    ok((await req("guest", "/api/auth/login", { method: "POST", body: json({ email: "yoq@example.com", password: "noto'g'ri-parol-1" }) })).status !== 503, "to'siq: kirish (auth) ochiq qoladi");
    ok((await req("cl", "/api/admin/texnik-ishlar")).status === 403, "to'siq: o'qish (GET) ishlayveradi");
  } else {
    console.log(`   (texnik ishlar to'sig'i handler()ga hali ulanmagan — mutatsiya ${blocked.status}; ulangach bu yerda 503 tekshiriladi)`);
  }
  const off = (await (await mPut({ on: false })).json()).data;
  ok(off.on === false && off.messageUz === MSG && off.since === null, "o'chirildi — xabar matni saqlanib qoldi (qisman yangilash)");
  ok((await probe()).status !== 503, "o'chirilgach o'zgartirishlar yana ishlaydi");
  ok((await home()).includes('data-site-notice="banner"'), "texnik ishlar o'chgach oddiy e'lon qaytdi");

  ok((await req("ad", "/api/admin/sayt-elon", { method: "DELETE" })).status === 200, "e'lon olib tashlandi");
  ok((await (await req("ad", "/api/admin/sayt-elon")).json()).data.banner === null && !(await home()).includes('data-site-notice="banner"'), "olib tashlangan e'lon ko'rinmaydi");
  const auditNotice = (await sql("SELECT action FROM audit_logs WHERE target_type = 'platform_settings' AND created_at > ?", [Date.now() - 120_000])).rows.map((r) => r.action);
  ok(["admin_site_banner", "admin_site_banner_removed", "admin_maintenance_on", "admin_maintenance_off"].every((a) => auditNotice.includes(a)), "e'lon va texnik ishlar amallari audit jurnalida", auditNotice.join(","));

  /* ------------------------------------------------------------------ */
  /* 6. Audit ko'ruvchisi: filtr, kursor, CSV (formula himoyasi)          */
  /* ------------------------------------------------------------------ */
  const EVIL = [`=HYPERLINK("http://evil.example","${RUN}")`, `@SUM(1+1)${RUN}`, `+${RUN}`, `-${RUN}`];
  for (const ip of EVIL) {
    await req("ad", "/api/admin/tuzoq", { method: "POST", body: json({ action: "block", ip: ip.slice(0, 64), reason: "e2e" }) });
    await req("ad", "/api/admin/tuzoq", { method: "POST", body: json({ action: "unblock", ip: ip.slice(0, 64) }) });
  }
  const csvRes = await req("ad", "/api/admin/audit?format=csv&target=ip&limit=200");
  const csvBytes = new Uint8Array(await csvRes.arrayBuffer());
  const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(csvBytes);
  const cells = csv.split("\n").flatMap((l) => l.split(","));
  ok(csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csv.includes("harakat_kodi") && /attachment; filename="kasbegalari-audit-/.test(csvRes.headers.get("content-disposition") ?? ""), "CSV: UTF-8 BOM + sarlavha + fayl nomi");
  ok(cells.some((c) => c.startsWith(`"'=HYPERLINK`) || c.startsWith(`'=HYPERLINK`)), "CSV: «=» bilan boshlangan katak oldiga ' qo'yilgan");
  ok(cells.some((c) => c.startsWith(`'@SUM`)) && cells.some((c) => c === `'+${RUN}`) && cells.some((c) => c === `'-${RUN}`), "CSV: «@», «+», «-» kataklari ham zararsizlantirilgan");
  ok(!cells.some((c) => /^"?[=+\-@]/.test(c) && c.includes(RUN)), "CSV: xavfli belgi bilan boshlanadigan xom katak yo'q");
  ok((await sql("SELECT 1 FROM audit_logs WHERE action = 'admin_export' AND target_type = 'audit' AND created_at > ?", [Date.now() - 60_000])).rows.length > 0, "CSV eksportning o'zi audit jurnalida");

  const a1 = (await (await req("ad", "/api/admin/audit?target=ip&limit=3")).json()).data;
  ok(a1.items.length === 3 && a1.items.every((x) => x.targetType === "ip") && typeof a1.nextCursor === "string", "audit JSON: nishon turi filtri + kursor");
  const a2 = (await (await req("ad", `/api/admin/audit?target=ip&limit=3&before=${encodeURIComponent(a1.nextCursor)}`)).json()).data;
  ok(a2.items.length > 0 && !a2.items.some((x) => a1.items.some((y) => y.id === x.id)), "audit JSON: keyingi sahifa takrorlanmaydi");
  ok(a2.items.every((x) => x.createdAt <= a1.items[a1.items.length - 1].createdAt), "audit JSON: yozuvlar vaqt bo'yicha kamayib boradi");
  const a3 = (await (await req("ad", `/api/admin/audit?tid=${encodeURIComponent("@SUM")}&limit=50`)).json()).data;
  ok(a3.items.length >= 2 && a3.items.every((x) => String(x.targetId).startsWith("@SUM")), "audit JSON: nishon ID (boshidan) filtri");
  const page = await req("ad", "/admin/audit?target=ip");
  const pageHtml = await page.text();
  ok(page.status === 200 && pageHtml.includes("Nishon turi") && pageHtml.includes("Batafsil"), "audit sahifasi ochiladi: nishon filtri va «Batafsil» bor");
  const pageCur = await (await req("ad", `/admin/audit?target=ip&c=${encodeURIComponent(a1.nextCursor)}`)).text();
  ok(pageCur.includes("Eng yangilari") && !pageCur.includes(a1.items[0].id), "audit sahifasi: kursor bilan keyingi sahifa (eng yangi yozuv unda yo'q)");
  ok((await req("guest", "/admin/audit", { redirect: "manual" })).status !== 200, "audit sahifasi mehmonga ochilmaydi");

  /* ------------------------------------------------------------------ */
  /* 7. Cron holati                                                       */
  /* ------------------------------------------------------------------ */
  const cronSt = (await (await req("ad", "/api/admin/cron")).json()).data;
  ok(Array.isArray(cronSt.steps) && cronSt.steps.length >= 12 && cronSt.steps.every((x) => x.title && x.desc), "cron qadamlari ro'yxati", String(cronSt.steps?.length));
  const runsBefore = cronSt.runs.length ? cronSt.runs[0].at : 0;
  const dry = await req("ad", "/api/admin/cron", { method: "POST", body: json({ dry: true }) });
  const dryText = await dry.text();
  if (cronSt.configured) {
    const d = JSON.parse(dryText).data;
    ok(dry.status === 200 && d.result.dry === true && d.result.ok === true && typeof d.result.counts.slaReminded === "number", "cron sinov (dry) ishga tushdi", dryText.slice(0, 120));
    ok((d.status.runs[0]?.at ?? 0) === runsBefore, "sinov rejimi cron yozuvi qoldirmaydi (hech narsa o'zgarmagan)");
    ok((await sql("SELECT 1 FROM audit_logs WHERE action = 'admin_cron_run' AND actor_id = ? AND created_at > ?", [adId, Date.now() - 60_000])).rows.length > 0, "qo'lda ishga tushirish audit jurnalida");
  } else {
    ok(dry.status === 503, "CRON_SECRET yo'q (production) — qo'lda ishga tushirish 503", String(dry.status));
  }
  const cronSecret = secrets.get("CRON_SECRET");
  ok(!cronSecret || cronSecret.length < 6 || !dryText.includes(cronSecret), "cron javobida CRON_SECRET yo'q");

  /* ------------------------------------------------------------------ */
  /* 8. Tezlik cheklovlari                                                */
  /* ------------------------------------------------------------------ */
  const k1 = `login:198.51.100.250:${RUN}@example.com`;
  const k2 = `loginEmail:${RUN}@example.com`;
  const marker = `revoked:${RUN}:1700000000`;
  const totp = `totpUsed:${RUN}:57000000`;
  for (const [key, count] of [[k1, 5], [k2, 3], [marker, 1], [totp, 1]]) await sql("INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at", [key, count, Date.now() + 600_000]);
  const lim = (await (await req("ad", `/api/admin/limitlar?q=${RUN}`)).json()).data;
  const keys = lim.items.map((x) => x.key);
  ok(keys.includes(k1) && keys.includes(k2), "qidiruv limitlarni topdi");
  ok(!keys.includes(marker) && !keys.includes(totp), "sessiya/2FA belgilari ro'yxatda YO'Q");
  ok(lim.items.find((x) => x.key === k1)?.limited === true && lim.items.find((x) => x.key === k2)?.limited === false, "limitga yetgani to'g'ri belgilangan");
  ok((await (await req("ad", `/api/admin/limitlar?q=${RUN}&holat=limited`)).json()).data.items.every((x) => x.limited), "«faqat cheklanganlar» filtri");
  const del = (key) => req("ad", `/api/admin/limitlar?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  ok((await del(marker)).status === 400 && (await del(totp)).status === 400, "sessiya/2FA belgisini tozalab bo'lmaydi → 400");
  ok((await sql("SELECT 1 FROM rate_limits WHERE key IN (?, ?)", [marker, totp])).rows.length === 2, "belgilar joyida qoldi");
  ok((await del(k1)).status === 200 && (await sql("SELECT 1 FROM rate_limits WHERE key = ?", [k1])).rows.length === 0, "limit tozalandi");
  ok((await del(k1)).status === 404, "yo'q limit → 404");
  ok((await sql("SELECT 1 FROM audit_logs WHERE action = 'admin_rate_limit_cleared' AND target_id = ?", [k1])).rows.length === 1, "tozalash audit jurnalida");
  const bulk = (await (await req("ad", "/api/admin/limitlar", { method: "POST", body: json({ keys: [k2, marker, "noma'lum:kalit"] }) })).json()).data;
  ok(bulk.cleared === 1 && (await sql("SELECT 1 FROM rate_limits WHERE key = ?", [marker])).rows.length === 1, "ommaviy tozalash: faqat limit o'chdi, belgi qoldi");

  /* ------------------------------------------------------------------ */
  /* 9. Foydalanuvchi xavfsizlik vositalari                               */
  /* ------------------------------------------------------------------ */
  const sess = await req("ad", `/api/admin/users/${spId}/sessions`);
  const sessText = await sess.text();
  const sd = JSON.parse(sessText).data;
  ok(sd.user.id === spId && Array.isArray(sd.sessions) && sd.sessions.length >= 1 && sd.sessions.every((x) => x.label && typeof x.lastSeenAt === "number"), "sessiyalar ro'yxati (qurilma, oxirgi faollik)");
  ok(!/ipHash|ip_hash|userAgent|passwordHash|totpSecret/.test(sessText), "javobda IP xeshi, xom user-agent, parol xeshi yo'q");
  ok((await req("ad", "/api/admin/users/yoq-foydalanuvchi/sessions")).status === 404, "yo'q foydalanuvchi → 404");
  ok((await req("ad", `/api/admin/users/${adId}/sessions`, { method: "POST", body: json({ action: "revoke_all" }) })).status === 400, "admin o'z sessiyalarini bu yerdan tugata olmaydi → 400");
  ok((await req("ad", `/api/admin/users/${spId}/sessions`, { method: "POST", body: json({ action: "revoke", sessionId: "yoq-sessiya" }) })).status === 404, "yo'q sessiya → 404");
  ok((await req("ad", `/api/admin/users/${spId}/sessions`, { method: "POST", body: json({ action: "boshqa" }) })).status === 422, "noma'lum amal → 422");

  const reset = await req("ad", `/api/admin/users/${spId}/parol`, { method: "POST", body: json({}) });
  const resetText = await reset.text();
  ok([200, 502, 503].includes(reset.status), "parol tiklash havolasi: yuborildi yoki kanal sozlanmagani aytildi", String(reset.status));
  ok(!/parol-tiklash\/|"token"/.test(resetText), "javobda token/havola YO'Q");
  if (reset.status !== 503) ok((await sql("SELECT 1 FROM audit_logs WHERE action = 'admin_password_reset_sent' AND target_id = ? AND created_at > ?", [spId, Date.now() - 60_000])).rows.length > 0, "havola yuborish audit jurnalida");

  // Barcha sessiyalarni tugatish — mutaxassis cookie'si shu zahoti ishlamay qoladi
  ok((await req("sp", "/api/auth/sessions")).status === 200, "tugatishdan oldin mutaxassis sessiyasi tirik");
  const rev = await req("ad", `/api/admin/users/${spId}/sessions`, { method: "POST", body: json({ action: "revoke_all" }) });
  ok(rev.status === 200 && (await rev.json()).data.all === true, "barcha sessiyalar tugatildi");
  ok((await req("sp", "/api/auth/sessions")).status === 401, "eski cookie endi ishlamaydi (401)");
  ok((await (await req("ad", `/api/admin/users/${spId}/sessions`)).json()).data.sessions.length === 0, "faol sessiya qolmadi");
  ok((await sql("SELECT 1 FROM audit_logs WHERE action = 'admin_sessions_revoked' AND target_id = ? AND created_at > ?", [spId, Date.now() - 60_000])).rows.length > 0, "sessiyalarni tugatish audit jurnalida");
  ok((await sql("SELECT 1 FROM notifications WHERE user_id = ? AND title LIKE 'Barcha qurilmalardan%' AND created_at > ?", [spId, Date.now() - 60_000])).rows.length > 0, "egasiga bildirishnoma ketdi");
} finally {
  // Tozalash: sinov yozuvlari va sozlamalar
  await sql("DELETE FROM error_logs WHERE message LIKE ?", [`%${RUN}%`]);
  await sql("DELETE FROM rate_limits WHERE key LIKE ? OR key LIKE 'clientError:198.51.100.%' OR key LIKE 'adminCron:%' OR key LIKE 'adminReset:%'", [`%${RUN}%`]);
  await sql("DELETE FROM blocked_ips WHERE ip LIKE ?", [`%${RUN}%`]);
  await sql("DELETE FROM notifications WHERE title LIKE 'Barcha qurilmalardan%' AND created_at > ?", [Date.now() - 300_000]);
  await req("ad", "/api/admin/texnik-ishlar", { method: "PUT", body: json({ on: before.maintenance.on, messageUz: before.maintenance.messageUz, messageRu: before.maintenance.messageRu }) });
  if (before.banner) await req("ad", "/api/admin/sayt-elon", { method: "PUT", body: json({ textUz: before.banner.textUz, textRu: before.banner.textRu, tone: before.banner.tone, href: before.banner.href ?? "", until: before.banner.until && before.banner.until > Date.now() + 120_000 ? before.banner.until : null }) });
  else await req("ad", "/api/admin/sayt-elon", { method: "DELETE" });
  console.log("🧹 tozalandi");
}
finish();
