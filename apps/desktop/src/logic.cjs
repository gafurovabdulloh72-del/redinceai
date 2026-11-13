"use strict";
/**
 * Sof mantiq (Electron'siz) — unit testlar shu faylni tekshiradi (test/logic.test.cjs).
 */
const crypto = require("node:crypto");

/** PKCE juftligi: verifier ilovada qoladi, brauzerga faqat challenge (SHA-256, base64url, 43 belgi) */
function pkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** `kasbegalari://auth?code=…` → kod; boshqa har qanday narsa → null */
function parseDeepLink(raw) {
  if (typeof raw !== "string" || !raw.startsWith("kasbegalari:")) return null;
  try {
    const u = new URL(raw);
    const kind = (u.hostname || u.pathname.replace(/^\/+/, "")).replace(/\/+$/, "");
    if (kind === "auth") {
      const code = u.searchParams.get("code");
      return code && code.length >= 20 && code.length <= 2000 ? { kind: "auth", code } : null;
    }
    if (kind === "open") {
      // kasbegalari://open?path=/kabinet — saytning ichki sahifasini ochish
      const p = u.searchParams.get("path") || "/";
      return /^\/(?!\/)[^\s\\]*$/.test(p) ? { kind: "open", path: p } : null;
    }
  } catch {
    /* noto'g'ri URL */
  }
  return null;
}

/** argv ichidan deep link (Windows/Linux — ikkinchi nusxa yoki birinchi ishga tushish) */
function deepLinkFromArgv(argv) {
  return (argv || []).find((a) => typeof a === "string" && a.startsWith("kasbegalari:")) || null;
}

/**
 * Navigatsiya qaroriga: `app` — ilova oynasida ochiladi, `google` — Google kirishi (tizim brauzerida PKCE oqimi),
 * `external` — tizim brauzerida, `block` — umuman ochilmaydi.
 */
function classifyUrl(raw, siteUrl, extraHosts = []) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return "block";
  }
  const site = new URL(siteUrl);
  if (u.protocol === "about:" || u.protocol === "data:" || u.protocol === "blob:") return "app";
  if (u.protocol === "mailto:" || u.protocol === "tel:" || u.protocol === "tg:") return "external";
  if (u.protocol !== "https:" && u.protocol !== "http:") return "block";
  const own = u.host === site.host || extraHosts.includes(u.host);
  if (own) {
    if (u.pathname === "/api/auth/google" || u.pathname.startsWith("/api/auth/google/")) return "google";
    return "app";
  }
  if (u.hostname === "accounts.google.com") return "google";
  // Video qo'ng'iroq/efir ichki manzillari va to'lov oynalari ham tizim brauzerida emas — faqat sayt ichida ishlaydi;
  // boshqa barcha tashqi havolalar (t.me, instagram, payme…) — tizim brauzerida
  return "external";
}

/** Sahifa sarlavhasidagi o'qilmaganlar soni: «(3) Chat · Kasb Egalari» → 3, «(99+) …» → 99 */
function unreadFromTitle(title) {
  const m = /^\((\d+)\+?\)\s/.exec(title || "");
  return m ? Math.min(Number(m[1]), 999) : 0;
}

module.exports = { pkcePair, parseDeepLink, deepLinkFromArgv, classifyUrl, unreadFromTitle };
