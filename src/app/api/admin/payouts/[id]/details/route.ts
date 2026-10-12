import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payouts } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { decryptSecret } from "@/lib/payments/crypto";

/**
 * Admin: payout so'rovining TO'LIQ rekvizitini ochish (E55). Bazada shifrlangan (AES-256-GCM), har bir ochish
 * audit jurnaliga yoziladi. Eski (shifrlanmagan) so'rovlarda faqat maskalangan ko'rinish bor — details:null.
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const row = await db.query.payouts.findFirst({ where: eq(payouts.id, id), columns: { id: true, details: true, detailsEnc: true, method: true, specialistId: true } });
  if (!row) throw new ApiError(404, "So'rov topilmadi");
  const details = decryptSecret(row.detailsEnc);
  await audit(session.sub, "admin_payout_details", { targetType: "payout", targetId: id, meta: { specialistId: row.specialistId, method: row.method, available: Boolean(details) } }, req);
  return ok({ id: row.id, method: row.method, masked: row.details, details }, { headers: { "Cache-Control": "no-store" } });
});
