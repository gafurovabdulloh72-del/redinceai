import { handler, ok, requireSession } from "@/lib/api";
import { declineCall } from "@/lib/call/service";

export const runtime = "nodejs";

/** Qo'ng'iroqni rad etish (chaqiriluvchi) */
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await declineCall(id, session.sub));
});
