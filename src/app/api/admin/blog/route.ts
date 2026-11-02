import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { articleInputSchema, createArticle, getArticleById, listAllArticles } from "@/lib/blog";
import { audit } from "@/lib/security/audit";

/** GET — barcha maqolalar (qoralamalar bilan); ?id= bilan bitta maqola to'liq (body) — faqat admin */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const id = new URL(req.url).searchParams.get("id");
  if (id) return ok({ item: await getArticleById(id) });
  return ok({ items: await listAllArticles() });
});

/** POST — yangi maqola (faqat admin) */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, articleInputSchema);
  const r = await createArticle(session.sub, input);
  await audit(session.sub, "admin_settings", { targetType: "article", targetId: r.id }, req);
  return ok(r, { status: 201 });
});
