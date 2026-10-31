import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";

/**
 * PATCH {contactMode: "paid"|"hidden"} — mutaxassisning O'Z kontakt rejimi:
 *  paid   — kontakt platformaga to'lab ochiladi (standart);
 *  hidden — «faqat portfolio»: kontakt umuman sotilmaydi (mijoz faqat ishlarni ko'radi, chat orqali yozadi).
 * Narxni faqat admin belgilaydi (umumiy daraja narxi yoki maxsus narx).
 */
export const PATCH = handler(async (req) => {
  const session = await requireSession(["specialist", "admin"]);
  const input = await parseBody(req, z.object({ contactMode: z.enum(["paid", "hidden"]) }));
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true, contactMode: true } });
  if (!sp) throw new ApiError(404, "Mutaxassis profili topilmadi");
  if (sp.contactMode !== input.contactMode) {
    await db.update(specialists).set({ contactMode: input.contactMode, updatedAt: new Date() }).where(eq(specialists.id, sp.id));
    await audit(session.sub, "contact_mode_changed", { targetType: "specialist", targetId: sp.id, meta: { from: sp.contactMode, to: input.contactMode } }, req);
  }
  return ok({ contactMode: input.contactMode });
});
