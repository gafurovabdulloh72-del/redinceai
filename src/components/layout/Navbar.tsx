import { and, count, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { unreadGroupsCount } from "@/lib/groups/service";
import { NavbarClient } from "./NavbarClient";

export async function Navbar() {
  const user = await getCurrentUser();

  // O'qilmagan bildirishnomalar soni — qo'ng'iroq birinchi chizilishdayoq to'g'ri raqam bilan chiqsin;
  // jamoalardagi yangiliklar — "Jamoalar" havolasidagi nuqta uchun. Ikkalasi parallel, xato bo'lsa 0.
  let unread = 0;
  let groupsUnread = 0;
  if (user) {
    [unread, groupsUnread] = await Promise.all([
      db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
        .then((rows) => rows[0]?.n ?? 0)
        .catch(() => 0),
      unreadGroupsCount(user.id).catch(() => 0),
    ]);
  }

  return (
    <NavbarClient
      unread={unread}
      groupsUnread={groupsUnread}
      user={
        user
          ? { id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl, specialistSlug: user.specialist?.slug ?? null }
          : null
      }
    />
  );
}
