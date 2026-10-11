import { and, count, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { NavbarClient } from "./NavbarClient";

export async function Navbar() {
  const user = await getCurrentUser();

  // O'qilmagan bildirishnomalar soni — qo'ng'iroq birinchi chizilishdayoq to'g'ri raqam bilan chiqsin
  let unread = 0;
  if (user) {
    try {
      const [row] = await db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
      unread = row?.n ?? 0;
    } catch {
      unread = 0;
    }
  }

  return (
    <NavbarClient
      unread={unread}
      user={
        user
          ? { id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl, specialistSlug: user.specialist?.slug ?? null }
          : null
      }
    />
  );
}
