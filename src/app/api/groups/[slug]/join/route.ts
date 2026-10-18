import { handler, ok, requireSession } from "@/lib/api";
import { joinGroup, leaveGroup } from "@/lib/groups/service";
import { joinBodySchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST: qo'shilish (ochiq — darhol, yopiq — so'rov; ?invite=KOD yoki {invite} bilan — darhol; {note} — so'rov izohi);
 * DELETE: chiqish / so'rovni qaytarib olish. Javobda `welcome` — egasi yozgan xush kelibsiz matni (a'zo bo'lganda).
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  const fromQuery = new URL(req.url).searchParams.get("invite");
  const raw = (await req.json().catch(() => null)) as unknown;
  const parsed = joinBodySchema.safeParse(raw ?? {});
  const body = parsed.success ? parsed.data : {};
  const invite = (body.invite ?? fromQuery)?.slice(0, 40) ?? null;
  const membership = await joinGroup(group, session.sub, invite, body.note ?? null);
  return ok({ membership, welcome: membership === "member" ? group.welcomeText?.trim() || null : null });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  await leaveGroup(group, session.sub);
  return ok({ membership: null });
});
