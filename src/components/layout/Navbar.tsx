import { and, count, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { chatUnreadSummary } from "@/lib/chat/unread";
import { ChatTitleUnread } from "@/components/chat/ChatTitleUnread";
import { NavbarClient } from "./NavbarClient";
import { Sidebar } from "./Sidebar";

/**
 * Qobiq navigatsiyasi: telefonda yuqori panel + pastki tab-bar (NavbarClient), md+ da chap yon panel (Sidebar).
 * Sonlar bir marta hisoblanadi: o'qilmagan bildirishnomalar va «Chat» nishoni (DM + guruh/kanal + buyurtma chati — xato bo'lsa 0).
 * Chat nishoni shundan keyin JONLI yangilanadi (components/chat/unread-store.ts — o'sha yig'indini `/api/chat/unread` beradi).
 */
export async function Navbar() {
  const user = await getCurrentUser();
  let unread = 0;
  let chatUnread = 0;
  if (user) {
    [unread, chatUnread] = await Promise.all([
      db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
        .then((rows) => rows[0]?.n ?? 0)
        .catch(() => 0),
      chatUnreadSummary(user.id)
        .then((s) => s.total)
        .catch(() => 0),
    ]);
  }
  const navUser = user ? { id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl, specialistSlug: user.specialist?.slug ?? null } : null;
  return (
    <>
      {/* Telegram inbox: Chat badge = DM + guruh/kanal yangiliklari + buyurtma chati (jonli) */}
      <NavbarClient unread={unread} dmUnread={chatUnread} user={navUser} />
      <Sidebar user={navUser} unread={unread} dmUnread={chatUnread} />
      {/* Brauzer sarlavhasida «(n)» — o'qilmagan bildirishnoma + xabarlar (jonli); mehmonda yo'q */}
      {user && <ChatTitleUnread notifications={unread} chat={chatUnread} />}
    </>
  );
}
