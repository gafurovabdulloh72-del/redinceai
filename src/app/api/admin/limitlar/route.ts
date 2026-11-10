import { z } from "zod";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { clearRateLimit, listRateLimits } from "@/lib/admin/rate-limits";
import { audit } from "@/lib/security/audit";

const listSchema = z.object({
  /** Foydalanuvchi (ism/email/@taxallus), IP yoki kalit bo'lagi */
  q: z.string().trim().max(80).optional(),
  holat: z.enum(["limited", "all"]).default("all"),
});

/** Admin: faol tezlik cheklovlari (faqat ma'lum limit oilalari — sessiya/2FA belgilari ko'rsatilmaydi) */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const { q, holat } = parseQuery(req.url, listSchema);
  return ok({ ...(await listRateLimits({ q, onlyLimited: holat === "limited" })), ts: Date.now() });
});

const keySchema = z.object({ key: z.string().min(3).max(300) });

/** Admin: bitta limitni tozalash (`?key=`) — foydalanuvchi darhol qayta urinib ko'ra oladi */
export const DELETE = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { key } = parseQuery(req.url, keySchema);
  const res = await clearRateLimit(key);
  if (res === "forbidden") throw new ApiError(400, "Bu kalit limit emas — tozalab bo'lmaydi");
  if (res === "not_found") throw new ApiError(404, "Limit topilmadi (muddati tugagan bo'lishi mumkin)");
  await audit(session.sub, "admin_rate_limit_cleared", { targetType: "rate_limit", targetId: key.slice(0, 200) }, req);
  return ok({ cleared: 1 });
});

const bulkSchema = z.object({ keys: z.array(z.string().min(3).max(300)).min(1, { error: "Kalit tanlanmagan" }).max(50, { error: "Bir yo'la ko'pi bilan 50 ta" }) });

/** Admin: bir nechta limitni birga tozalash (qidiruv natijasi — bitta foydalanuvchining barcha cheklovlari) */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { keys } = await parseBody(req, bulkSchema);
  let cleared = 0;
  const done: string[] = [];
  for (const key of [...new Set(keys)]) {
    if ((await clearRateLimit(key)) === "cleared") {
      cleared += 1;
      done.push(key.slice(0, 120));
    }
  }
  if (cleared) await audit(session.sub, "admin_rate_limit_cleared", { targetType: "rate_limit", meta: { count: cleared, keys: done.slice(0, 20) } }, req);
  return ok({ cleared });
});
