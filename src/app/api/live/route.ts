import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { isCallEnabled } from "@/lib/rtc/livekit";
import { getVerifiedSession } from "@/lib/auth";
import { getMembership, loadGroupByAnySlug } from "@/lib/groups/service";
import { runEventReminders } from "@/lib/events/reminders";
import { canWatchPaid } from "@/lib/mentorship/purchases";
import { activeLive, startLive } from "@/lib/live/service";

export const runtime = "nodejs";

/** GET ?slug= — jamoadagi hozirgi efir (ommaviy, faqat id/sarlavha) */
export const GET = handler(async (req) => {
  void runEventReminders().catch(() => undefined);
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const group = slug ? await loadGroupByAnySlug(slug) : null;
  if (!group || !isCallEnabled()) return ok({ live: null });
  if (group.isPrivate) {
    const me = await getVerifiedSession();
    const m = me ? await getMembership(group.id, me.sub) : null;
    if (me?.role !== "admin" && m?.status !== "active") return ok({ live: null });
  }
  const s = await activeLive(group.id);
  if (!s) return ok({ live: null });
  const me = await getVerifiedSession();
  const access = s.priceSom <= 0 || (me ? await canWatchPaid(me.sub, s, me.role === "admin") || s.hostId === me.sub : false);
  return ok({ live: { id: s.id, title: s.title, startedAt: s.startedAt.getTime(), price: s.priceSom, access } });
});

const bodySchema = z.object({ slug: z.string().min(1), title: z.string().max(100).default(""), price: z.number().int().min(0).max(1_000_000).default(0) });

/** POST — efir boshlash (egasi/moderator) */
export const POST = handler(async (req) => {
  if (!isCallEnabled()) throw new ApiError(503, "Jonli efir hozircha o'chirilgan");
  const session = await requireSession();
  const input = await parseBody(req, bodySchema);
  const group = await loadGroupByAnySlug(input.slug);
  if (!group) throw new ApiError(404, "Jamoa topilmadi");
  const s = await startLive(group, { id: session.sub, role: session.role }, input.title, input.price);
  return ok({ id: s.id, title: s.title });
});
