import { handler, ok, requireSession } from "@/lib/api";
import { getStatus } from "@/lib/call/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Qo'ng'iroq holati (chaqiruvchi/chaqiriluvchi polling): ringing/accepted/declined/cancelled/missed/ended */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const status = await getStatus(id, session.sub);
  return ok(status, { headers: { "cache-control": "no-store, max-age=0" } });
});
