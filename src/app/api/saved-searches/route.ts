import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { savedSearchCreateSchema } from "@/lib/validators";
import { MAX_SAVED_SEARCHES, canonicalSavedQuery, listSavedSearches } from "@/lib/saved-searches";
import { describeSavedQuery } from "@/components/specialists/saved-search-label";
import { rateLimit } from "@/lib/security/rate-limit";
import { uid } from "@/lib/utils";

/** Saqlangan qidiruvlar (F53) — faqat o'ziniki */
export const GET = handler(async () => {
  const session = await requireSession();
  const items = await listSavedSearches(session.sub);
  return ok({ items, max: MAX_SAVED_SEARCHES });
});

/** Joriy /mutaxassislar filtrlarini nom bilan saqlash. Querystring kanonik ko'rinishga keltiriladi; bir xil qidiruv takror saqlanmaydi */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, savedSearchCreateSchema);
  await rateLimit(`savedSearches:${session.sub}`, 30, 60 * 60_000);

  const { query } = canonicalSavedQuery(input.query);
  const existing = await db.query.savedSearches.findMany({ where: eq(savedSearches.userId, session.sub), columns: { id: true, query: true } });
  const dup = existing.find((r) => r.query === query);
  if (dup) throw new ApiError(409, "Bu qidiruv allaqachon saqlangan", { query: "Bu qidiruv allaqachon saqlangan" });
  const [{ n }] = await db.select({ n: count() }).from(savedSearches).where(eq(savedSearches.userId, session.sub));
  if (n >= MAX_SAVED_SEARCHES) throw new ApiError(400, `Ko'pi bilan ${MAX_SAVED_SEARCHES} ta qidiruv saqlash mumkin — keraksizlarini o'chiring`);

  const id = uid();
  const now = new Date();
  // lastNotifiedAt = hozir: saqlash paytidagi mavjud mutaxassislar "yangi" deb xabar qilinmaydi
  await db.insert(savedSearches).values({ id, userId: session.sub, name: input.name, query, notify: input.notify ?? true, lastNotifiedAt: now, createdAt: now });
  return ok({ id, name: input.name, query, summary: describeSavedQuery(query), notify: input.notify ?? true }, { status: 201 });
});
