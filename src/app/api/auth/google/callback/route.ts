import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, createTwoFactorTicket } from "@/lib/auth";
import { fetchGoogleProfile, isGoogleConfigured } from "@/lib/auth/google";
import { generateUsername } from "@/lib/chat/username";
import { hashPassword } from "@/lib/security/password";
import { joinOfficialChannels } from "@/lib/groups/service";
import { TERMS_VERSION } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { uid } from "@/lib/utils";

const STATE_COOKIE = "g_oauth";

/** Xatolik bilan kirish sahifasiga qaytaradi va state cookie'ni tozalaydi */
function fail(req: NextRequest, reason: string) {
  const res = NextResponse.redirect(new URL(`/auth/kirish?reason=${reason}`, req.nextUrl.origin));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

/**
 * GET /api/auth/google/callback — Google rozilikdan keyin qaytadi.
 * 1) state'ni cookie bilan solishtiradi (CSRF), 2) kodni profilga almashtiradi,
 * 3) googleId yoki email bo'yicha hisobni topadi/bog'laydi/yaratadi, 4) sessiya ochadi.
 */
export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) return fail(req, "google_off");

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return fail(req, "google_cancel");
  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) return fail(req, "google_err");

  // state cookie tekshiruvi
  const raw = req.cookies.get(STATE_COOKIE)?.value;
  if (!raw) return fail(req, "google_err");
  let saved: { s: string; n: string | null };
  try {
    saved = JSON.parse(raw) as { s: string; n: string | null };
  } catch {
    return fail(req, "google_err");
  }
  if (saved.s !== state) return fail(req, "google_err");

  const profile = await fetchGoogleProfile(code);
  if (!profile) return fail(req, "google_err");
  if (!profile.emailVerified) return fail(req, "google_unverified");

  // 1) googleId bo'yicha
  let user = await db.query.users.findFirst({ where: eq(users.googleId, profile.sub), columns: { id: true, role: true, name: true, isBanned: true } });

  // 2) email bo'yicha — mavjud hisobni bog'lash (Google emailni tasdiqlagan, xavfsiz)
  if (!user) {
    const byEmail = await db.query.users.findFirst({ where: eq(users.email, profile.email), columns: { id: true, role: true, name: true, isBanned: true, avatarUrl: true } });
    if (byEmail) {
      const patch: { googleId: string; emailVerified: boolean; lastLoginAt: Date; avatarUrl?: string } = { googleId: profile.sub, emailVerified: true, lastLoginAt: new Date() };
      if (!byEmail.avatarUrl && profile.picture) patch.avatarUrl = profile.picture;
      await db.update(users).set(patch).where(eq(users.id, byEmail.id));
      user = { id: byEmail.id, role: byEmail.role, name: byEmail.name, isBanned: byEmail.isBanned };
      await audit(byEmail.id, "google_link", { targetType: "user", targetId: byEmail.id }, req).catch(() => undefined);
    }
  }

  // 3) yangi hisob — rol: mijoz (keyin profildan mutaxassis bo'ladi)
  let isNew = false;
  if (!user) {
    const id = uid();
    await db.insert(users).values({
      id,
      username: await generateUsername(profile.name),
      name: profile.name,
      email: profile.email,
      googleId: profile.sub,
      avatarUrl: profile.picture,
      emailVerified: true,
      role: "client",
      // Parol bilan kirish yo'q — tasodifiy kuchli hash (keyin «parolni tiklash» orqali o'rnatiladi)
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      lastLoginAt: new Date(),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
    });
    await joinOfficialChannels(id).catch(() => undefined);
    await audit(id, "register", { targetType: "user", targetId: id, meta: { provider: "google", role: "client" } }, req).catch(() => undefined);
    user = { id, role: "client", name: profile.name, isBanned: false };
    isNew = true;
  }

  if (user.isBanned) return fail(req, "banned");

  // 2FA yoqilgan hisob: Google faqat BIRINCHI bosqich — TOTP baribir so'raladi (3-audit: aks holda Google orqali
  // 2FA chetlab o'tilardi). Chipta URL fragmentida (#t2=) — serverga, logga va Referer'ga ketmaydi; 5 daqiqa, bir martalik.
  if (!isNew) {
    const tf = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { totpEnabled: true, sessionVersion: true } });
    if (tf?.totpEnabled) {
      const ticket = await createTwoFactorTicket({ id: user.id, sessionVersion: tf.sessionVersion }, true);
      const nextQ = saved.n ? `?next=${encodeURIComponent(saved.n)}` : "";
      const res2 = NextResponse.redirect(new URL(`/auth/kirish${nextQ}#t2=${ticket}`, req.nextUrl.origin));
      res2.cookies.delete(STATE_COOKIE);
      return res2;
    }
  }

  if (!isNew) await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).catch(() => undefined);
  await createSession({ id: user.id, role: user.role, name: user.name }, { remember: true });

  // Yangi foydalanuvchi → tanishuv (onboarding); aks holda next yoki kabinet
  const dest = isNew ? "/xush-kelibsiz" : saved.n || "/kabinet";
  const res = NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

