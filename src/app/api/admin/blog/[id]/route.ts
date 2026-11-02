import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { articleInputSchema, deleteArticle, updateArticle } from "@/lib/blog";
import { audit } from "@/lib/security/audit";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — maqolani tahrirlash (faqat admin) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, articleInputSchema);
  await updateArticle(id, input);
  await audit(session.sub, "admin_settings", { targetType: "article", targetId: id }, req);
  return ok({ saved: true });
});

/** DELETE — maqolani o'chirish (faqat admin) */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  await deleteArticle(id);
  await audit(session.sub, "admin_settings", { targetType: "article", targetId: id }, req);
  return ok({ removed: true });
});
