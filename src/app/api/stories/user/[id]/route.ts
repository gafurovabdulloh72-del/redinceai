import { ApiError, handler, ok } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { authorStories } from "@/lib/stories/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET: muallifning faol story'lari (ko'rilgan belgisi bilan; ko'rishlar soni — faqat egasiga) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const res = await authorStories(id, await optionalViewer());
  if (!res) throw new ApiError(404, "Faol story yo'q");
  return ok(res);
});
