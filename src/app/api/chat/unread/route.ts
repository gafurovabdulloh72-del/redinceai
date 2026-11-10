import { handler, ok, requireSession } from "@/lib/api";
import { chatUnreadSummary } from "@/lib/chat/unread";

/**
 * GET — «Chat» nishoni uchun yengil so'rov (yon panel, pastki tab, brauzer sarlavhasi, PWA badge, buyurtma kartalari).
 * `count` — eski mijozlar uchun (faqat DM); yangi mijoz `total` (DM + guruh/kanal + buyurtma chati) va `orderUnread` ni o'qiydi.
 * Hech narsa YOZMAYDI (o'qildi belgisi, oxirgi faollik) — fon so'rovi foydalanuvchini «onlayn» qilib qo'ymasin.
 */
export const GET = handler(async () => {
  const session = await requireSession();
  const s = await chatUnreadSummary(session.sub);
  return ok({ count: s.dm, ...s });
});
