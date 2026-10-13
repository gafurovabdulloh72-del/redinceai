import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { recordOrderEvent } from "@/lib/payments/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { loadOrderForParty } from "../../_lib/access";
import { notifyNewMessage, postSystemMessage } from "../../_lib/messages";

/** Ruxsat etilgan video qo'ng'iroq xostlari: Google Meet, Zoom (shu jumladan us02web.zoom.us), Telegram */
const MEETING_HOSTS = ["meet.google.com", "zoom.us", "t.me", "telegram.me"];
const MEETING_MSG = "Faqat https:// bilan boshlanuvchi Google Meet, Zoom yoki Telegram havolasi";

function isMeetingUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    const host = u.hostname.toLowerCase();
    return MEETING_HOSTS.some((h) => host === h || (h === "zoom.us" && host.endsWith(".zoom.us")));
  } catch {
    return false;
  }
}

const schema = z.object({
  meetingUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || isMeetingUrl(v), MEETING_MSG),
});

/** Video qo'ng'iroq havolasi (F40): istalgan tomon qo'yadi / almashtiradi / olib tashlaydi ("" yuborilsa) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { meetingUrl } = await parseBody(req, schema);
  const { order, role } = await loadOrderForParty(id, session, { write: true });
  await enforceLimit("messages", session.sub);
  if (order.status === "cancelled" || (order.status === "done" && order.completedAt)) throw new ApiError(400, "Yopilgan buyurtmaga havola qo'shib bo'lmaydi");

  const next = meetingUrl || null;
  if (next === order.meetingUrl) return ok({ meetingUrl: next });
  await db.update(orders).set({ meetingUrl: next, updatedAt: new Date() }).where(eq(orders.id, id));
  const who = role === "client" ? "Mijoz" : "Mutaxassis";
  const text = next ? `${who} video qo'ng'iroq havolasini ${order.meetingUrl ? "yangiladi" : "qo'shdi"}` : `${who} video qo'ng'iroq havolasini olib tashladi`;
  await recordOrderEvent(id, session.sub, "note", { note: text });
  await postSystemMessage(id, next ? `${text}: ${next}` : text);
  if (next) await notifyNewMessage(order, role, "video qo'ng'iroq havolasini yubordi");
  return ok({ meetingUrl: next });
});
