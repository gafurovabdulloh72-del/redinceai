import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { blockIp, honeypotStats, unblockIp } from "@/lib/security/honeypot";

/** Admin: honeypot (tuzoq) statistikasi — so'nggi urinishlar, eng faol IP'lar, bloklanganlar */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(await honeypotStats());
});

const schema = z.object({
  action: z.enum(["block", "unblock"]),
  ip: z.string().trim().min(3).max(64),
  reason: z.string().trim().max(200).optional(),
});

/** Admin: IP'ni qo'lda bloklash (doimiy) yoki blokdan chiqarish */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const { action, ip, reason } = await parseBody(req, schema);
  if (action === "block") await blockIp(ip, reason || "Admin qo'lda blokladi", { manual: true });
  else await unblockIp(ip);
  await audit(session.sub, action === "block" ? "admin_ip_block" : "admin_ip_unblock", { targetType: "ip", targetId: ip }, req);
  return ok({ ip, action });
});
