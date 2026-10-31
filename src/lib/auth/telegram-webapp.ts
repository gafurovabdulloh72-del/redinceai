import "server-only";
import { createHmac } from "node:crypto";
import { secretEquals } from "@/lib/security/secret-box";

/**
 * Telegram Mini App (`/tg`): `window.Telegram.WebApp.initData` ni tekshirish.
 * Qoida (Telegram hujjati): secret = HMAC_SHA256(key="WebAppData", bot_token);
 * data_check_string = "hash"dan boshqa maydonlar `k=v` ko'rinishida, kalit bo'yicha saralangan, "\n" bilan;
 * hash = hex(HMAC_SHA256(secret, data_check_string)). `auth_date` 24 soatdan eski bo'lsa rad etiladi.
 */
const MAX_AGE_S = 24 * 3600;

export interface WebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export function verifyWebAppInitData(initData: string, now = Date.now()): { user: WebAppUser; authDate: number } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || typeof initData !== "string" || initData.length < 10 || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");
  const pairs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort();
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  if (!secretEquals(expected, hash)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > MAX_AGE_S || authDate > now / 1000 + 300) return null;
  let user: WebAppUser | null = null;
  try {
    const raw = params.get("user");
    user = raw ? (JSON.parse(raw) as WebAppUser) : null;
  } catch {
    user = null;
  }
  if (!user || typeof user.id !== "number") return null;
  return { user, authDate };
}
