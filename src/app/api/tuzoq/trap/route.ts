import { after } from "next/server";
import { clientIp } from "@/lib/security/request";
import { CANARY_ADMIN_PATH, CANARY_TOKEN, isCanaryToken, recordHoneypotHit } from "@/lib/security/honeypot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HONEYPOT TRAP (2026-11-06): middleware mashhur hujum yo'llarini shu yerga yo'naltiradi (`?p=<asl yo'l>`).
 * Vazifa: (1) urinishni jurnalga yozish + avtomatik blok (recordHoneypotHit, javobdan keyin — `after`),
 * (2) ishonarli SOXTA javob berib hujumchi vaqtini o'g'irlash va CANARY (tuzoq) kalit tashlash.
 * PAROL HECH QACHON saqlanmaydi — faqat login nomi (soxta login formasidan).
 */

/**
 * Soxta `.env` — ichida CANARY kalit (ishlatilsa aniq hujum) va boshqa yolg'on, ishonarli qiymatlar.
 * DIQQAT: hech bir qator MANBADA haqiqiy sir formatiga mos kelmasligi kerak (GitHub push-protection «sk_live_…» ni
 * haqiqiy Stripe kaliti deb bloklaydi) — shuning uchun vendor-ko'rinishidagi qiymatlar bo'laklardan ishga tushganda yig'iladi.
 * Hujumchi javobni ko'radi (haqiqiydek), manba esa hech qanday skanerni tripga tushirmaydi.
 */
function fakeEnv(): string {
  const stripe = ["sk", "live", "51Hq8ZxRn7Wv3Lm9Tb6Yc1Hd5Gj0Kp2Fd"].join("_");
  const smtp = ["Mn4Kp8", "Rt2Wq6"].join("");
  return [
    "APP_ENV=production",
    "NODE_ENV=production",
    "DATABASE_URL=postgres://app:Xy7Qp2Lm9Vt@db.internal:5432/app_prod",
    `API_SECRET_KEY=${CANARY_TOKEN}`,
    "JWT_SECRET=hs256_9d2f8a1c4b7e0f63a5c8d1e2f4b6a9c0",
    `STRIPE_SECRET_KEY=${stripe}`,
    `SMTP_PASSWORD=${smtp}`,
    "ADMIN_PANEL_URL=https://admin.internal/login",
    "",
  ].join("\n");
}

/** Soxta login sahifasi (fake admin) — statik HTML, hech qanday skript yo'q (CSP-safe), kirish ishlamaydi */
function fakeLoginHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Admin Login</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,Arial,sans-serif;background:#f0f2f5;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}form{background:#fff;padding:32px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);width:320px}h1{font-size:18px;margin:0 0 20px}input{width:100%;box-sizing:border-box;padding:10px;margin:6px 0;border:1px solid #ccd0d5;border-radius:6px}button{width:100%;padding:10px;margin-top:10px;background:#1877f2;color:#fff;border:0;border-radius:6px;font-weight:600;cursor:pointer}</style></head><body><form method="post" action=""><h1>Administrator Login</h1><input name="username" placeholder="Username" autocomplete="username"><input name="password" type="password" placeholder="Password" autocomplete="current-password"><button type="submit">Log In</button></form></body></html>`;
}

async function trap(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = (url.searchParams.get("p") || url.pathname).slice(0, 300);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  const method = req.method;
  const low = path.toLowerCase();

  // Canary: soxta "maxfiy admin" yo'li yoki canary kalit (header/query'da) — eng kuchli signal
  const tokenSeen = isCanaryToken(url.searchParams.get("key") || url.searchParams.get("token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "");
  const isCanary = low.startsWith(CANARY_ADMIN_PATH) || tokenSeen;

  // Soxta login urinishi — login nomini olamiz (PAROLNI EMAS)
  let note = "";
  let kind: "scan" | "fakeLogin" | "canary" = isCanary ? "canary" : "scan";
  if (method === "POST" && /wp-login|administrator|admin\.php|adminer|login/.test(low)) {
    kind = isCanary ? "canary" : "fakeLogin";
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded") || ct.includes("form-data")) {
        const form = await req.formData();
        const u = String(form.get("username") ?? form.get("user") ?? form.get("login") ?? form.get("email") ?? "").slice(0, 80);
        if (u) note = `login: ${u}`;
      }
    } catch {
      /* tanani o'qib bo'lmadi — faqat yo'l yoziladi */
    }
  }

  // Jurnal + avtomatik blok javobdan KEYIN (hujumchi kutmaydi, javob tez)
  after(() => recordHoneypotHit({ ip, kind, method, path, userAgent: ua, note }));

  // Ishonarli soxta javob — hujumchi "topdim" deb vaqt sarflaydi
  const headers: Record<string, string> = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
  if (/\.env/.test(low) || /\.aws|\.ssh|actuator|config\.php|configuration\.php/.test(low)) {
    return new Response(fakeEnv(), { status: 200, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  }
  if (method === "GET" && /wp-login|administrator|admin\.php|adminer|boshqaruv-7731/.test(low)) {
    return new Response(fakeLoginHtml(), { status: 200, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  }
  if (/\.sql|\.zip|dump/.test(low)) {
    // Soxta "backup" — kichik, befoyda matn (katta fayl bermaymiz, trafik tejaladi)
    return new Response("-- MySQL dump\n-- (empty)\n", { status: 200, headers: { ...headers, "content-type": "application/sql" } });
  }
  if (method === "POST") {
    // Soxta login POST — "noto'g'ri parol" sahifasi (bot qayta urinaveradi, biz sanaymiz)
    return new Response(fakeLoginHtml().replace("Administrator Login", "Login failed — try again"), { status: 200, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
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
