import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, verifyDesktopCode } from "@/lib/auth";
import { redirectTo } from "@/lib/http/redirect";
import { audit } from "@/lib/security/audit";
import { tryConsume } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/ilova/kirish?code=&v= — kompyuter ilovasi brauzerdan olgan kodni o'z oynasida ochadi va sessiya oladi.
 * Faqat ilovaning o'zidan (User-Agent'da `KasbEgalariDesktop`) — oddiy brauzerga begona hisob bilan «kiritib qo'yish»
 * (login CSRF) havolasi sifatida ishlatilmasin. Kod bir martalik (`desktopUsed:<jti>`).
 */
export async function GET(req: NextRequest) {
  const fail = () => redirectTo("/auth/kirish?reason=ilova");
  if (!/KasbEgalariDesktop\//.test(req.headers.get("user-agent") ?? "")) return fail();
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code") ?? "";
  const verifier = sp.get("v") ?? "";
  if (code.length < 20 || code.length > 2000 || verifier.length < 32 || verifier.length > 200) return fail();
  const c = await verifyDesktopCode(code, verifier);
  if (!c) return fail();
  if (!(await tryConsume(`desktopUsed:${c.jti}`, 10 * 60 * 1000))) return fail();
  const user = await db.query.users.findFirst({ where: eq(users.id, c.sub), columns: { id: true, role: true, name: true, sessionVersion: true, isBanned: true } });
  if (!user || user.isBanned || user.sessionVersion !== c.sv) return fail();
  await createSession(user, { remember: true });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit(user.id, "login_success", { targetType: "user", targetId: user.id, meta: { via: "desktop" } }, req);
  return redirectTo("/");
}
