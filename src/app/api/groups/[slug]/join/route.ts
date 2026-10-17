import { handler, ok, requireSession } from "@/lib/api";
import { joinGroup, leaveGroup } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/** POST: qo'shilish (ochiq — darhol, yopiq — so'rov; ?invite=KOD yoki {invite} bilan — darhol); DELETE: chiqish */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  const fromQuery = new URL(req.url).searchParams.get("invite");
  const body = (await req.json().catch(() => null)) as { invite?: unknown } | null;
  const invite = typeof body?.invite === "string" ? body.invite : fromQuery;
  const membership = await joinGroup(group, session.sub, invite?.slice(0, 40) ?? null);
  return ok({ membership });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  await enforceLimit("social", session.sub);
  const group = await groupOr404(slug);
  await leaveGroup(group, session.sub);
  return ok({ membership: null });
});
