import { handler, ok, requireSession } from "@/lib/api";
import { cancelCall, endCall } from "@/lib/call/service";

export const runtime = "nodejs";

/** Qo'ng'iroqni bekor qilish (chaqiruvchi, javobdan oldin) yoki tugatish (?end=1, suhbatdan chiqilganda) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const end = new URL(req.url).searchParams.get("end") === "1";
  return ok(end ? await endCall(id, session.sub) : await cancelCall(id, session.sub));
});
