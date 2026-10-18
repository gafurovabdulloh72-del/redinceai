import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { validateUsername } from "@/lib/chat/username";
import { rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({ u: z.string().trim().max(40).default("") });

/**
 * Chat taxallusi bandligini jonli tekshirish (AccountForm, debounce): format → RESERVED → bazada bandlik (o'ziniki bo'sh hisoblanadi).
 * Javob: { available, value, reason } — reason faqat band/noto'g'ri bo'lsa. Limit: soatiga 120 (yozib turganda tez-tez chaqiriladi).
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const { u } = parseQuery(req.url, schema);
  await rateLimit(`usernameCheck:${session.sub}`, 120, 60 * 60_000);
  const v = validateUsername(u);
  if (!v.ok) return ok({ available: false, value: null, reason: v.error });
  const taken = await db.query.users.findFirst({ where: and(eq(users.username, v.value), ne(users.id, session.sub)), columns: { id: true } });
  return ok({ available: !taken, value: v.value, reason: taken ? "Bu taxallus band — boshqasini tanlang" : null }, { headers: { "Cache-Control": "no-store" } });
});
