import { z } from "zod";
import { and, eq, isNotNull, like, ne, or, sql } from "drizzle-orm";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists, users } from "@/lib/db/schema";
import { enforceLimit } from "@/lib/security/rate-limit";

const querySchema = z.object({ q: z.string().trim().min(1).max(32) });
/** LIKE naqsh belgilari olib tashlanadi (SQLite'da ESCAPE'siz backslash ishlamaydi); `_` qoldiriladi — bitta belgi sifatida mos keladi, zarari yo'q */
const cleanNeedle = (s: string) => s.replace(/[%\\]/g, "");

/**
 * GET ?q= — @eslatma uchun foydalanuvchi taklifi (kompozitor/izoh): username prefiksi yoki ism bo'yicha, 8 tagacha.
 * Faqat kirganlarga; taxallusi bo'lmaganlar (eslatib bo'lmaydi) va bloklanganlar chiqmaydi. Kontakt ma'lumotlari YO'Q.
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("mention", session.sub);
  const { q } = parseQuery(req.url, querySchema);
  const needle = cleanNeedle(q.toLowerCase().replace(/^@/, ""));
  if (!needle) return ok({ items: [] });
  const rows = await db
    .select({ id: users.id, name: users.name, username: users.username, avatarUrl: users.avatarUrl, slug: specialists.slug })
    .from(users)
    .leftJoin(specialists, eq(specialists.userId, users.id))
    .where(
      and(
        eq(users.isBanned, false),
        isNotNull(users.username),
        ne(users.id, session.sub),
        or(like(sql`lower(${users.username})`, `${needle}%`), like(sql`lower(${users.name})`, `%${needle}%`)),
      ),
    )
    .orderBy(sql`case when lower(${users.username}) like ${`${needle}%`} then 0 else 1 end`, users.name)
    .limit(8);
  return ok({ items: rows.map((r) => ({ id: r.id, name: r.name, username: r.username as string, avatarUrl: r.avatarUrl, slug: r.slug ?? null })) });
});
