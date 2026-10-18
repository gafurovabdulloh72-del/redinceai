import { ApiError, handler, requireSession } from "@/lib/api";
import { SITE } from "@/lib/constants";
import { loadOrderForParty } from "@/app/api/orders/_lib/access";

type Ctx = { params: Promise<{ id: string }> };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * GET: buyurtma topshirish muddati — kalendar fayli (.ics, butun kun). Faqat tomonlar yoki admin (loadOrderForParty).
 * Pul holatiga tegmaydi — faqat o'qish.
 */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { order } = await loadOrderForParty(id, session);
  if (!order.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(order.dueDate)) throw new ApiError(404, "Buyurtmada topshirish sanasi belgilanmagan");
  const d = order.dueDate.replace(/-/g, "");
  const next = new Date(`${order.dueDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dEnd = next.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const url = new URL(req.url);
  const href = `${url.origin}/kabinet/buyurtmalar?id=${order.id}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Buyurtma//UZ`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:order-${order.id}@kasbegalari`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${dEnd}`,
    `SUMMARY:${esc(`Topshirish: ${order.title}`)}`,
    `DESCRIPTION:${esc(`${SITE.name} buyurtmasi — ${order.specialist.user.name}. ${href}`)}`,
    `URL:${href}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`Ertaga topshirish: ${order.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="buyurtma-${order.id.slice(0, 8)}.ics"`, "Cache-Control": "no-store" },
  });
});
