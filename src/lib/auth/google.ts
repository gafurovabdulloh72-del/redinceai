/**
 * Google OAuth 2.0 (Authorization Code oqimi) — «Google bilan kirish».
 * Tashqi kutubxonasiz: faqat fetch. Kalitlar env'dan: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 * Google Cloud Console → "Authorized redirect URI": <SITE_URL>/api/auth/google/callback
 */
import { SITE_URL } from "@/lib/site-url";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Callback manzili — Google Console'dagi "redirect URI" bilan BIR XIL bo'lishi shart */
export function googleRedirectUri(): string {
  return `${SITE_URL}/api/auth/google/callback`;
}

/** Rozilik (consent) sahifasiga yo'naltirish URL'i */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

/** Kodni token'ga almashtirib, foydalanuvchi ma'lumotini oladi. Xato bo'lsa null. */
export async function fetchGoogleProfile(code: string): Promise<GoogleProfile | null> {
  if (!isGoogleConfigured()) return null;
  try {
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return null;

    const userRes = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!userRes.ok) return null;
    const u = (await userRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string; picture?: string };
    if (!u.sub || !u.email) return null;
    return {
      sub: u.sub,
      email: u.email.toLowerCase().trim(),
      emailVerified: Boolean(u.email_verified),
      name: (u.name || u.given_name || u.email.split("@")[0] || "Foydalanuvchi").slice(0, 80),
      picture: u.picture ?? null,
    };
  } catch {
    return null;
  }
}
