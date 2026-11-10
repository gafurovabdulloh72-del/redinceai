import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { isCallEnabled } from "@/lib/rtc/livekit";
import { getVerifiedSession } from "@/lib/auth";
import { getMembership, loadGroupByAnySlug } from "@/lib/groups/service";
import { runEventReminders } from "@/lib/events/reminders";
import { canWatchPaid } from "@/lib/mentorship/purchases";
import { activeLive, endLive, startLive } from "@/lib/live/service";
import { PASSCODE_RE, setEntryRules } from "@/lib/live/zoom";

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

const bodySchema = z.object({
  slug: z.string().min(1),
  title: z.string().max(100).default(""),
  price: z.number().int().min(0).max(1_000_000).default(0),
  /** Kutish xonasi: har bir yangi odamni boshlovchi qo'shadi */
  waitingRoom: z.boolean().default(false),
  /** Efir kodi (6–12 belgi, harf/raqam) yoki bo'sh — kodsiz. Efir BOSHLANISHIDAN OLDIN tekshiriladi (pastga qarang) */
  passcode: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === "" || PASSCODE_RE.test(v), { error: "Kod 6–12 belgi, faqat harf va raqam" })
    .optional(),
});

/** POST — efir boshlash (egasi/moderator) */
export const POST = handler(async (req) => {
  if (!isCallEnabled()) throw new ApiError(503, "Jonli efir hozircha o'chirilgan");
  const session = await requireSession();
  const input = await parseBody(req, bodySchema);
  const group = await loadGroupByAnySlug(input.slug);
  if (!group) throw new ApiError(404, "Jamoa topilmadi");
  const actor = { id: session.sub, role: session.role };
  const s = await startLive(group, actor, input.title, input.price);
  if (input.waitingRoom || input.passcode) {
    // Ilgari kod shu yerda (efir allaqachon boshlangach) tekshirilardi: noto'g'ri kod 422 qaytarar, efir esa HIMOYASIZ ochiq
    // qolardi (boshlovchi «kod qo'ydim» deb o'ylardi). Endi kod sxemada oldindan tekshiriladi; qoidani o'rnatib bo'lmasa —
    // efir darhol yopiladi (ochiq holda qoldirilmaydi).
    try {
      await setEntryRules(s.id, actor, { waitingRoom: input.waitingRoom, passcode: input.passcode || null });
    } catch (e) {
      await endLive(s.id, actor).catch(() => undefined);
      throw e;
    }
  }
  return ok({ id: s.id, title: s.title });
});
