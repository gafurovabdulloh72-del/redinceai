import { z } from "zod";
import { ApiError, handler, ok, parseQuery, requireSession } from "@/lib/api";
import { DM_SEARCH_MIN } from "@/lib/chat/constants";
import { loadConversationFor, searchDm } from "@/lib/chat/dm";

const schema = z.object({ q: z.string().trim().min(DM_SEARCH_MIN, `Kamida ${DM_SEARCH_MIN} belgi`).max(80) });

/** GET ?q= — suhbat ichida matn qidiruvi (yangi → eski, 30 tagacha). Javob: { items: [{ id, at, mine, snippet }] } */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { q } = parseQuery(req.url, schema);
  const found = await loadConversationFor(session.sub, id);
  if (!found) throw new ApiError(404, "Suhbat topilmadi");
  const rows = await searchDm(id, session.sub, q);
  const needle = q.toLowerCase();
  return ok({
    q,
    items: rows.map((m) => {
      // Parcha: topilgan so'z atrofidan ~90 belgi
      const text = m.body.replace(/\s+/g, " ");
      const i = Math.max(0, text.toLowerCase().indexOf(needle));
      const start = Math.max(0, i - 40);
      const snippet = `${start > 0 ? "…" : ""}${text.slice(start, start + 110)}${start + 110 < text.length ? "…" : ""}`;
      return { id: m.id, at: m.createdAt.getTime(), mine: m.senderId === session.sub, snippet };
    }),
  });
});
