import { ApiError, handler, ok } from "@/lib/api";
import { clientIp } from "@/lib/security/request";
import { optionalViewer } from "@/app/api/groups/_lib";
import { bumpApplyClick, loadVacancy } from "@/lib/vacancies/service";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST: tashqi ariza havolasi bosildi (sendBeacon) — faqat hisoblagich, egasi va mehmon ham yuboradi; IP bo'yicha limit */
export const POST = handler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await loadVacancy(id);
  if (!v || !v.applyUrl) throw new ApiError(404, "Vakansiya topilmadi");
  const viewer = await optionalViewer();
  const ip = clientIp(req);
  await enforceLimit("views", viewer?.id ?? ip);
  // Egasining o'z bosishlari statistikani buzmasin
  if (!viewer || viewer.id !== v.authorId) await bumpApplyClick(v.id);
  return ok({ counted: true });
});
