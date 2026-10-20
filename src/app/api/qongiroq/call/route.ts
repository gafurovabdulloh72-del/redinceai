import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { isCallEnabled } from "@/lib/rtc/livekit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { startCall } from "@/lib/call/service";

export const runtime = "nodejs";

const bodySchema = z.object({ conversationId: z.string().min(1) });

/** Chaqiruvni boshlash (DM): taklif yaratiladi, chaqiriluvchida jiringlash ekrani chiqadi (u /incoming polling qiladi). */
export const POST = handler(async (req) => {
  if (!isCallEnabled()) throw new ApiError(503, "Video qo'ng'iroq hozircha o'chirilgan");
  const session = await requireSession();
  await enforceLimit("upload", session.sub); // qo'ng'iroq boshlashga ham mo'tadil chegara (spam oldini olish)
  const { conversationId } = await parseBody(req, bodySchema);
  const res = await startCall(session.sub, session.name ?? "Mehmon", conversationId);
  return ok({ inviteId: res.invite.id, room: res.room, url: res.url, token: res.token, peer: res.peer });
});
