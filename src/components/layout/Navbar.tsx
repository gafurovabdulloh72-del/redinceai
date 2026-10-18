import { and, count, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { unreadDmCount } from "@/lib/chat/dm";
import { unreadGroupsCount } from "@/lib/groups/service";
import { NavbarClient } from "./NavbarClient";
import { Sidebar } from "./Sidebar";

/**
 * Qobiq navigatsiyasi: telefonda yuqori panel + pastki tab-bar (NavbarClient), md+ da chap yon panel (Sidebar).
 * Sonlar bir marta hisoblanadi: o'qilmagan bildirishnomalar, o'qilmagan DM, jamoalardagi yangiliklar (xato bo'lsa 0).
 */
export async function Navbar() {
  const user = await getCurrentUser();
  let unread = 0;
  let groupsUnread = 0;
  let dmUnread = 0;
  if (user) {
    [unread, groupsUnread, dmUnread] = await Promise.all([
      db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
        .then((rows) => rows[0]?.n ?? 0)
        .catch(() => 0),
      unreadGroupsCount(user.id).catch(() => 0),
      unreadDmCount(user.id).catch(() => 0),
    ]);
  }
  const navUser = user ? { id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl, specialistSlug: user.specialist?.slug ?? null } : null;
  return (
    <>
      <NavbarClient unread={unread} groupsUnread={groupsUnread} user={navUser} />
      <Sidebar user={navUser} unread={unread} dmUnread={dmUnread} groupsUnread={groupsUnread} />
    </>
  );
}
