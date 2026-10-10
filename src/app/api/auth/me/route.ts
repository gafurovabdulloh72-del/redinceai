import { getCurrentUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

/** Joriy foydalanuvchi (parolsiz). Sessiya versiyasi mos kelmasa null (cookie tozalanadi). */
export const GET = handler(async () => {
  const user = await getCurrentUser();
  return ok(user, { headers: { "Cache-Control": "no-store" } });
});
