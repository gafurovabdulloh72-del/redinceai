/**
 * Telegram Mini App `startapp` parametri ↔ sayt yo'li (klient va server uchun umumiy, sof funksiya).
 * `t.me/<bot>?startapp=<param>` — ruxsat etilgan belgilar [A-Za-z0-9_-], ≤64. Yo'l base64url bilan
 * kodlanadi; sig'masa (uzun yo'l) null — ulashish oddiy havola bilan davom etadi.
 */
const MAX = 64;

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): string | null {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Yo'l → startapp (null — sig'maydi yoki ichki yo'l emas) */
export function encodeStartParam(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const p = b64url(path);
  return p.length <= MAX ? p : null;
}

/** startapp → ichki yo'l (null — noto'g'ri) */
export function decodeStartParam(param: string | null | undefined): string | null {
  if (!param || !/^[A-Za-z0-9_-]{1,64}$/.test(param)) return null;
  const path = unb64url(param);
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\s<>"']/.test(path)) return null;
  return path.slice(0, 300);
}

/** Bot ochiladigan ulashish havolasi: `t.me/<bot>?startapp=…` (ichki yo'l sig'masa null) */
export function tgAppShareLink(bot: string | null | undefined, path: string): string | null {
  if (!bot) return null;
  const p = encodeStartParam(path);
  return p ? `https://t.me/${bot}?startapp=${p}` : null;
}
