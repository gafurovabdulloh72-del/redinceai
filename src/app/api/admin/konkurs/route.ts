import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { createChallenge } from "@/lib/challenges/service";
import { audit } from "@/lib/security/audit";

const schema = z.object({
  title: z.string().trim().min(4, "Sarlavha kamida 4 ta belgi").max(120),
  description: z.string().trim().max(2000).optional().default(""),
  days: z.coerce.number().int().min(1).max(60).optional().default(7),
  coverUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

/** POST — yangi konkurs (faqat admin); Telegram admin botida ham /konkurs buyrug'i bor */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, schema);
  const c = await createChallenge(session.sub, { title: input.title, description: input.description, days: input.days, coverUrl: input.coverUrl || null });
  await audit(session.sub, "admin_settings", { targetType: "challenge", targetId: c.id, meta: { title: c.title, days: input.days } }, req);
  return ok({ id: c.id }, { status: 201 });
});
