import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { isCallEnabled, LIVEKIT_WS_URL, mintCallToken } from "@/lib/rtc/livekit";
import { liveAccess, recordingAvailable } from "@/lib/live/service";
import { touchAttendance } from "@/lib/live/zoom";

export const runtime = "nodejs";

const bodySchema = z.object({ passcode: z.string().max(32).optional() });

/**
 * POST — efirga kirish tokeni: boshlovchi/hammuallif publish qiladi, tomoshabin faqat ko'radi.
 * Kutish xonasi yoki efir kodi yoqilgan bo'lsa token berilmaydi: javobda `gate` qaytadi
 * (`code` — kod kerak, `waiting` — navbatda, `denied` — rad etilgan).
 * Kichik xonalar ochiq bo'lsa token o'z xonasiga beriladi.
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  if (!isCallEnabled()) throw new ApiError(503, "Jonli efir hozircha o'chirilgan");
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema).catch(() => ({ passcode: undefined }));
  const { stream, host, staged, moderator, gate, room, breakout } = await liveAccess(id, { id: session.sub, role: session.role }, { passcode: input.passcode, enroll: true });
  if (gate !== "open") return ok({ gate, title: stream.title });
  void touchAttendance(id, session.sub).catch(() => undefined);
  const token = await mintCallToken({ identity: session.sub, name: session.name ?? "Mehmon", room, publish: moderator || staged, live: true });
  return ok({
    gate: "open" as const,
    url: LIVEKIT_WS_URL,
    token,
    host,
    moderator,
    hostId: stream.hostId,
    title: stream.title,
    recording: stream.recordingStatus,
    canRecord: host && recordingAvailable(),
    breakout,
    waitingRoom: stream.waitingRoom,
    hasPasscode: Boolean(stream.passcode),
    passcode: moderator ? stream.passcode : undefined,
    breakoutOpen: stream.breakoutOpen,
    startedAt: stream.startedAt.getTime(),
  });
});
