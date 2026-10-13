import { z } from "zod";
import { clearSession } from "@/lib/auth";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { revokeUserSession } from "@/lib/security/sessions";

const idSchema = z.string().trim().min(8).max(64).regex(/^[\w-]+$/);

/**
 * Bitta sessiyani (qurilmani) yopish — faqat o'z sessiyasi (userId tekshiriladi). Joriy sessiya bo'lsa
 * cookie ham o'chiriladi (`current: true` — UI bosh sahifaga o'tadi). Rate limit: 30 / soat.
 */
export const DELETE = handler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("sessions", session.sub);
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) throw new ApiError(404, "Sessiya topilmadi");
  const id = parsed.data;

  const revoked = await revokeUserSession(session.sub, id);
  if (!revoked) throw new ApiError(404, "Sessiya topilmadi yoki allaqachon yopilgan");

  const current = session.jti === id;
  if (current) await clearSession();
  await audit(session.sub, "session_revoked", { targetType: "session", targetId: id.slice(0, 8), meta: { current } }, req);
  return ok({ revoked: true, current });
});
