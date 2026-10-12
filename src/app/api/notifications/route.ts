import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";

/** O'qilmaganlar birinchi — 20 ta, + o'qilmaganlar soni */
export const GET = handler(async () => {
  const session = await requireSession();
  const { items, unread } = await listNotifications(session.sub, 20);
  return ok(
    {
      unread,
      items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, readAt: n.readAt?.getTime() ?? null, createdAt: n.createdAt.getTime() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

const schema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
  all: z.boolean().optional(),
});

/** O'qilgan deb belgilash: {ids:[...]} yoki {all:true} */
export const PATCH = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  // Bo'sh so'rov ({} yoki {ids:[]}) hech narsani belgilamaydi — markNotificationsRead bo'sh ro'yxatni "hammasi" deb tushunadi
  if (!input.all && !input.ids?.length) return ok({ marked: 0 });
  const n = await markNotificationsRead(session.sub, input.all ? undefined : input.ids);
  return ok({ marked: n });
});
