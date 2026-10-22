import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { isCallEnabled, LIVEKIT_WS_URL, mintCallToken } from "@/lib/rtc/livekit";
import { liveAccess } from "@/lib/live/service";

export const runtime = "nodejs";

/** POST — efirga kirish tokeni: boshlovchi publish qiladi, tomoshabin faqat ko'radi (canPublish=false) */
export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  if (!isCallEnabled()) throw new ApiError(503, "Jonli efir hozircha o'chirilgan");
  const session = await requireSession();
  const { id } = await ctx.params;
  const { stream, host } = await liveAccess(id, { id: session.sub, role: session.role });
  const token = await mintCallToken({ identity: session.sub, name: session.name ?? "Mehmon", room: stream.room, publish: host, live: true });
  return ok({ url: LIVEKIT_WS_URL, token, host, hostId: stream.hostId, title: stream.title });
});
