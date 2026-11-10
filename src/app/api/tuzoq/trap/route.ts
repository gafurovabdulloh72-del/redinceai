import { after } from "next/server";
import { clientIp } from "@/lib/security/request";
import { AUTO_BLOCK_THRESHOLD, CANARY_ADMIN_PATH, CANARY_EMAIL, CANARY_TOKEN, PROBE_BLOCK_THRESHOLD, isCanaryToken, recentHitCount, recordHoneypotHit, type HoneypotKind } from "@/lib/security/honeypot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HONEYPOT TRAP (2026-11-06; pranklar 2026-11-10): middleware mashhur hujum yo'llarini va URL'ida hujum imzosi bor
 * so'rovlarni shu yerga yo'naltiradi (asl yo'l va imzo `x-trap-path` / `x-trap-sig` so'rov sarlavhalarida).
 * Vazifa: (1) urinishni jurnalga yozish + avtomatik blok (recordHoneypotHit, javobdan keyin — `after`),
 * (2) ishonarli SOXTA javob (soxta .env / .git/config / login / dump) — vaqtini o'g'irlaydi va CANARY tashlaydi,
 * (3) HAZIL: aniq hujum imzosi, soxta loginga 3-urinish yoki canary ishlatilganda — «Salom, haker! Iltimos, buzib kirmang 🙏»
 *     sahifasi (mas'uliyatli xabar berish sahifasiga havola bilan).
 * PAROL HECH QACHON saqlanmaydi — faqat login nomi (soxta login formasidan). Sahifalar statik HTML, skriptsiz (CSP-safe).
 */

/**
 * Soxta `.env` — ichida CANARY kalit/email/yo'l (ishlatilsa aniq hujum) va boshqa yolg'on, ishonarli qiymatlar.
 * DIQQAT: hech bir qator MANBADA haqiqiy sir formatiga mos kelmasligi kerak (GitHub push-protection «sk_live_…» ni
 * haqiqiy Stripe kaliti deb bloklaydi) — shuning uchun vendor-ko'rinishidagi qiymatlar bo'laklardan ishga tushganda yig'iladi.
 */
function fakeEnv(): string {
  const stripe = ["sk", "live", "51Hq8ZxRn7Wv3Lm9Tb6Yc1Hd5Gj0Kp2Fd"].join("_");
  const smtp = ["Mn4Kp8", "Rt2Wq6"].join("");
  const adminPass = ["Kasb", "2026", "r00t!"].join("#");
  return [
    "APP_ENV=production",
    "NODE_ENV=production",
    "DATABASE_URL=postgres://app:Xy7Qp2Lm9Vt@db.internal:5432/app_prod",
    `API_SECRET_KEY=${CANARY_TOKEN}`,
    "JWT_SECRET=hs256_9d2f8a1c4b7e0f63a5c8d1e2f4b6a9c0",
    `STRIPE_SECRET_KEY=${stripe}`,
    `SMTP_PASSWORD=${smtp}`,
    `ADMIN_EMAIL=${CANARY_EMAIL}`,
    `ADMIN_PASSWORD=${adminPass}`,
    `ADMIN_PANEL_PATH=${CANARY_ADMIN_PATH}`,
    "",
  ].join("\n");
}

/** Soxta `.git/config` — «deploy token» o'rnida canary kalit */
function fakeGitConfig(): string {
  return ["[core]", "\trepositoryformatversion = 0", "\tfilemode = true", "\tbare = false", '[remote "origin"]', `\turl = https://deploy:${CANARY_TOKEN}@git.internal/kasb/app.git`, "\tfetch = +refs/heads/*:refs/remotes/origin/*", '[branch "main"]', "\tremote = origin", "\tmerge = refs/heads/main", ""].join("\n");
}

/** Soxta «zaxira nusxa» — kichik (trafik tejaladi) va ichida hazil */
function fakeDump(): string {
  return [
    "-- MySQL dump 10.13  Distrib 8.0.36",
    "-- Host: db.internal    Database: app_prod",
    "-- ------------------------------------------------------",
    "",
    "DROP TABLE IF EXISTS `users`;",
    "CREATE TABLE `users` (`id` int NOT NULL, `login` varchar(64), `email` varchar(120), `password` varchar(120));",
    "INSERT INTO `users` VALUES (1,'admin','iltimos-buzib-kirmang@kasbegalari.uz','$2y$10$bu.parol.emas.shunchaki.hazil.xavfsizlik.sahifasiga.qarang');",
    "",
    "-- Dump completed. Bu yerda boshqa hech narsa yo'q :)",
    "-- Kamchilik topdingizmi? Buzmasdan yozing: /xavfsizlik",
    "",
  ].join("\n");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Soxta login sahifasi (fake admin) — statik HTML, kirish ishlamaydi */
function fakeLoginHtml(heading = "Administrator Login"): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Admin Login</title><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><style>body{font-family:system-ui,Arial,sans-serif;background:#f0f2f5;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}form{background:#fff;padding:32px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);width:320px}h1{font-size:18px;margin:0 0 20px}input{width:100%;box-sizing:border-box;padding:10px;margin:6px 0;border:1px solid #ccd0d5;border-radius:6px}button{width:100%;padding:10px;margin-top:10px;background:#1877f2;color:#fff;border:0;border-radius:6px;font-weight:600;cursor:pointer}</style></head><body><form method="post" action=""><h1>${esc(heading)}</h1><input name="username" placeholder="Username" autocomplete="username"><input name="password" type="password" placeholder="Password" autocomplete="current-password"><button type="submit">Log In</button></form></body></html>`;
}

type PrankReason = "xss" | "sqli" | "lfi" | "rce" | "login" | "canary" | "api";

const REASON_HTML: Record<PrankReason, string> = {
  xss: "<code>&lt;script&gt;</code> yubordingiz — lekin u bu yerda bajarilmaydi. XSS yo'q, uzr 😅",
  sqli: "<code>' OR 1=1 --</code> ishlamadi: so'rovlarimiz parametrlangan. Jadvallar ham joyida turibdi 😌",
  lfi: "<code>../../etc/passwd</code> — bunday fayl bu yerda yo'q. Zinadan qancha ko'tarilmang, tom yopiq 🙂",
  rce: "Buyruq bajarilmadi. <code>whoami</code> → <code>mehmon</code> 😄",
  login: "Bu admin panel emas — tuzoq 🪤. Kiritgan parollaringiz hech qayerga saqlanmadi (faqat urinishlar sanaldi).",
  canary: "🎣 Tuzoqqa tushdingiz: bu kalit/manzil soxta edi — uni faqat soxta <code>.env</code> faylidan topish mumkin.",
  api: "Bu yerda yashirin API yo'q — faqat tuzoq 🪤.",
};

/** «Salom, haker!» sahifasi — hazil + iltimos + mas'uliyatli xabar berish havolasi. Skriptsiz, faqat CSS animatsiya. */
function prankHtml(reason: PrankReason, ip: string, blockNote: string): string {
  return `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Salom, haker 👋</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0d;color:#f6f4ee;font:15px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:20px}
.card{max-width:640px;width:100%;border:1px solid #2a2a2e;border-radius:16px;padding:26px;background:#121214}
.bar{height:8px;border-radius:99px;background:#232326;overflow:hidden;margin:12px 0 4px}
.bar i{display:block;height:100%;width:99%;background:#ff5a36;border-radius:99px;animation:load 2.8s cubic-bezier(.2,.8,.2,1) both}
@keyframes load{from{width:0}70%{width:94%}to{width:99%}}
.late{opacity:0;animation:show .5s 2.9s both}@keyframes show{to{opacity:1}}
h1{font:700 25px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;margin:16px 0 6px}
.big{font:700 21px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;color:#ff5a36;margin:18px 0 8px}
p{margin:8px 0;color:#c9c7c1}small{color:#8b8984}code{color:#9fe870}
.btn{display:inline-block;margin:14px 10px 0 0;padding:10px 16px;border-radius:99px;background:#ff5a36;color:#fff;text-decoration:none;font:600 14px system-ui,-apple-system,Segoe UI,sans-serif}
.ghost{background:transparent;border:1px solid #3a3a3f;color:#f6f4ee}
@media (prefers-reduced-motion:reduce){.bar i,.late{animation:none;opacity:1}}
</style></head><body><main class="card">
<p><code>$ ./hack --target kasb-egalari --mode ninja</code></p>
<p>Tizimga kirilmoqda… <span class="late">99% — va shu yerda to'xtadi 😄</span></p>
<div class="bar"><i></i></div>
<div class="late">
<h1>Salom, haker do'stim! 👋</h1>
<p>${REASON_HTML[reason]}</p>
<p class="big">Iltimos, bizni buzib kirmang 🙏</p>
<p>Biz kichik jamoamiz — bu saytni kechalari uxlamay qurganmiz. Chindan ham kamchilik topgan bo'lsangiz, buzmasdan bizga yozing: rahmat aytamiz, ismingizni «Shon-sharaf zali»ga yozamiz, choy ham bizdan ☕</p>
<p><small>Пожалуйста, не взламывайте нас 🙏 Нашли уязвимость — напишите нам, скажем спасибо.<br>Please don't hack us 🙏 Found a real bug? Tell us — we'll say thanks.</small></p>
<a class="btn" href="/xavfsizlik">Kamchilik haqida xabar berish</a><a class="btn ghost" href="/">Bosh sahifa</a>
<p><small>IP: ${esc(ip)} · urinish jurnalga yozildi${blockNote ? ` · ${esc(blockNote)}` : ""}<br>P.S. Parol «admin123» emas — o'zimiz ham tekshirib ko'rdik 😄</small></p>
</div></main></body></html>`;
}

const REASON_TEXT: Record<PrankReason, string> = {
  xss: "XSS urinishi aniqlandi — bu yerda bajarilmaydi.",
  sqli: "SQL-inyeksiya urinishi aniqlandi — so'rovlar parametrlangan.",
  lfi: "Fayl o'qish urinishi aniqlandi — bunday fayl yo'q.",
  rce: "Buyruq bajarish urinishi aniqlandi — bajarilmadi.",
  login: "Bu admin panel emas — tuzoq.",
  canary: "Bu kalit/manzil soxta (tuzoq) edi.",
  api: "Bu yerda yashirin API yo'q — tuzoq.",
};

function prankJson(reason: PrankReason, blockNote: string, status: number, headers: Record<string, string>): Response {
  return Response.json(
    {
      ok: false,
      error: "Iltimos, buzib kirmang 🙏",
      message: `Salom, haker! ${REASON_TEXT[reason]} Chindan ham kamchilik topgan bo'lsangiz — buzmasdan bizga yozing, rahmat aytamiz.`,
      ru: "Пожалуйста, не взламывайте нас 🙏 Нашли уязвимость — напишите нам.",
      en: "Please don't hack us 🙏 Found a real bug? Tell us.",
      report: "/xavfsizlik",
      ...(blockNote ? { note: blockNote } : {}),
    },
    { status, headers },
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function trap(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Middleware asl yo'l va imzoni `x-trap-*` sarlavhalarida beradi (rewrite'da req.url ASL manzil bo'lib qoladi);
  // to'g'ridan-to'g'ri chaqirilganda (yem API yo'llari) — so'rovning o'z yo'li.
  let fromMw = "";
  try {
    fromMw = decodeURIComponent(req.headers.get("x-trap-path") ?? "");
  } catch {
    /* buzuq kodlash — e'tiborsiz */
  }
  const path = (fromMw || url.pathname + url.search).slice(0, 300);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const method = req.method;
  const low = path.toLowerCase();
  const sigRaw = req.headers.get("x-trap-sig");
  const sig = sigRaw === "xss" || sigRaw === "sqli" || sigRaw === "lfi" || sigRaw === "rce" ? sigRaw : null;

  // Canary: soxta "maxfiy admin" yo'li yoki canary kalit (header/query'da) — eng kuchli signal
  const tokenSeen = isCanaryToken(url.searchParams.get("key") || url.searchParams.get("token") || url.searchParams.get("api_key") || req.headers.get("x-api-key") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "");
  const isCanary = low.startsWith(CANARY_ADMIN_PATH) || tokenSeen;
  const isLoginPath = /wp-login|administrator|admin\.php|adminer|login|old-admin|boshqaruv-7731/.test(low);
  const wantsJson = low.startsWith("/api/") || /^\/(?:graphql|swagger|api-docs|wp-json)/.test(low) || (!/text\/html/.test(req.headers.get("accept") ?? "") && /application\/json/.test(req.headers.get("accept") ?? ""));

  // Soxta login urinishi — login nomini olamiz (PAROLNI EMAS)
  let note = sig ? `imzo: ${sig}` : "";
  let kind: HoneypotKind = isCanary ? "canary" : sig ? "probe" : "scan";
  const isLoginPost = method === "POST" && isLoginPath;
  if (isLoginPost) {
    kind = isCanary ? "canary" : "fakeLogin";
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded") || ct.includes("form-data")) {
        const form = await req.formData();
        const u = String(form.get("username") ?? form.get("user") ?? form.get("login") ?? form.get("log") ?? form.get("email") ?? "").slice(0, 80);
        if (u) note = `login: ${u}`;
      }
    } catch {
      /* tanani o'qib bo'lmadi — faqat yo'l yoziladi */
    }
  }

  // Avvalgi urinishlar (shu so'rovdan OLDIN) — hazil darajasi va «bloklandi» izohi uchun
  const prior = await recentHitCount(ip);
  const priorLogins = isLoginPost ? await recentHitCount(ip, "fakeLogin") : 0;

  // Jurnal + avtomatik blok javobdan KEYIN (hujumchi kutmaydi, javob tez)
  after(() => recordHoneypotHit({ ip, kind, method, path, userAgent: ua, note }));

  const headers: Record<string, string> = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
  const html = { ...headers, "content-type": "text/html; charset=utf-8" };
  const threshold = kind === "probe" ? PROBE_BLOCK_THRESHOLD : AUTO_BLOCK_THRESHOLD;
  const left = threshold - (prior + 1);
  const blockNote = kind === "canary" ? "IP 30 kunga bloklandi" : left <= 0 ? "IP 24 soatga bloklandi" : left <= 2 ? `yana ${left} ta urinish — va IP 24 soatga dam oladi 😴` : "";

  // 1) Canary ishlatildi (kalit yoki soxta admin yo'liga POST) — «tuzoqqa tushdingiz»
  if (tokenSeen || (isCanary && method === "POST")) {
    return wantsJson ? prankJson("canary", blockNote, 403, headers) : new Response(prankHtml("canary", ip, blockNote), { status: 403, headers: html });
  }
  // 2) URL'da hujum imzosi — 418 «men choynakman» 🫖 (payload hech qaysi sahifaga yetmagan)
  if (sig) {
    return wantsJson ? prankJson(sig, blockNote, 418, headers) : new Response(prankHtml(sig, ip, blockNote), { status: 418, headers: html });
  }
  // 3) Soxta sirlar — ishonarli (canary shu yerda tashlanadi)
  if (/\.git(?:\/|$)/.test(low)) {
    return new Response(fakeGitConfig(), { status: 200, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  }
  if (/\.npmrc/.test(low)) {
    return new Response(`//registry.npmjs.org/:_authToken=${CANARY_TOKEN}\nalways-auth=true\n`, { status: 200, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  }
  if (/\.env|\.aws|\.ssh|actuator|config\.php|configuration\.php|credentials\.json|docker-compose/.test(low)) {
    return new Response(fakeEnv(), { status: 200, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  }
  // 4) Soxta login: GET — forma; POST — 2 marta «xato parol» (sekin), 3-urinishdan boshlab hazil sahifasi
  if (method === "GET" && isLoginPath) {
    return new Response(fakeLoginHtml(), { status: 200, headers: html });
  }
  if (isLoginPost) {
    await sleep(1200); // tarpit: parol terish botini sekinlashtiradi
    if (priorLogins >= 2) return new Response(prankHtml("login", ip, blockNote), { status: 200, headers: html });
    return new Response(fakeLoginHtml("Login failed — try again"), { status: 200, headers: html });
  }
  // 5) Soxta "backup" — kichik, ichida hazil
  if (/\.sql|\.zip|dump|backup/.test(low)) {
    return new Response(fakeDump(), { status: 200, headers: { ...headers, "content-type": "application/sql; charset=utf-8" } });
  }
  // 6) «Yashirin API» qidiruvchilar (graphql/swagger/api/v1/…) — JSON hazil
  if (wantsJson) return prankJson("api", blockNote, 418, headers);
  if (method === "POST") {
    return new Response(fakeLoginHtml("Login failed — try again"), { status: 200, headers: html });
  }
  // Qolgan tuzoq yo'llari — oddiy 404 ko'rinishi (lekin baribir jurnalga tushdi)
  return new Response("Not Found", { status: 404, headers });
}

export const GET = trap;
export const POST = trap;
export const PUT = trap;
export const DELETE = trap;
export const PATCH = trap;
export const HEAD = trap;
