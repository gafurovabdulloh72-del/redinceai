import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertActiveMember, setEventReminders, setMuted } from "@/lib/groups/service";
import { MUTE_OPTIONS } from "@/lib/groups/limits";
import { muteSchema } from "@/lib/groups/validators";
import { groupOr404 } from "../../_lib";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * POST {muted, duration?: 1h|8h|forever} — jamoa bildirishnomalarini jim qilish (a'zolik saqlanadi, rasmiy kanalda ham);
 * {eventReminders} — efir eslatmalarini yoqish/o'chirish. Ikkalasi bir so'rovda ham bo'lishi mumkin.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { slug } = await ctx.params;
  const input = await parseBody(req, muteSchema);
  if (input.muted === undefined && input.eventReminders === undefined) throw new ApiError(422, "O'zgarish yo'q");
  const group = await groupOr404(slug);
  await assertActiveMember(group, { id: session.sub, role: session.role });
  let mute: { muted: boolean; mutedUntil: number | null } | null = null;
  if (input.muted !== undefined) {
    const forMs = input.muted ? (MUTE_OPTIONS.find((o) => o.key === (input.duration ?? "forever"))?.ms ?? null) : null;
    mute = await setMuted(group, session.sub, input.muted, forMs);
  }
  if (input.eventReminders !== undefined) await setEventReminders(group, session.sub, input.eventReminders);
  return ok({ muted: mute?.muted ?? null, mutedUntil: mute?.mutedUntil ?? null, eventReminders: input.eventReminders ?? null });
});
