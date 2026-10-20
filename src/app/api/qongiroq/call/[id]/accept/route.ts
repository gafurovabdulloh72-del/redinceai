import { handler, ok, requireSession } from "@/lib/api";
import { acceptCall } from "@/lib/call/service";

export const runtime = "nodejs";

/** Qo'ng'iroqni qabul qilish (chaqiriluvchi): token olib, xonaga qo'shiladi */
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const res = await acceptCall(id, session.sub, session.name ?? "Mehmon");
  return ok(res);
});
