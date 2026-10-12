import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { KabinetNav, type KabinetNavItem } from "@/components/kabinet/KabinetNav";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications, orders } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kabinet", template: "%s · Kabinet · Redince" },
  robots: { index: false, follow: false },
};

const ROLE_LABEL = {
  client: "Mijoz",
  specialist: "Mutaxassis",
  admin: "Administrator",
} as const;

export default async function KabinetLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Middleware allaqachon himoya qiladi; bu ehtiyot chorasi
  if (!user) redirect(await loginRedirectPath("/kabinet"));

  // Yangi (hali ko'rilmagan) buyurtmalar soni — navigatsiyadagi hisoblagich uchun
  // + o'qilmagan bildirishnomalar soni (F1) — har ikkisi parallel
  const specialistId = user.specialist?.id;
  const [newOrders, unread] = await Promise.all([
    specialistId
      ? db
          .select({ n: count() })
          .from(orders)
          .where(and(eq(orders.specialistId, specialistId), eq(orders.status, "new")))
          .then((r) => r[0]?.n ?? 0)
      : Promise.resolve(0),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
      .then((r) => r[0]?.n ?? 0)
      .catch(() => 0),
  ]);

  const items: KabinetNavItem[] = [
    { href: "/kabinet", label: "Umumiy", icon: "overview", exact: true },
    { href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: "orders", badge: newOrders },
    { href: "/kabinet/bildirishnomalar", label: "Bildirishnomalar", icon: "notifications", badge: unread },
  ];
  // Mijoz: ishlagan mutaxassislari (F48)
  if (user.role === "client") items.push({ href: "/kabinet/mutaxassislarim", label: "Mutaxassislarim", icon: "partners" });
  items.push({ href: "/kabinet/sevimlilar", label: "Sevimlilar", icon: "favorites" });
  items.push({ href: "/kabinet/profil", label: "Profil", icon: "profile" });
  if (user.specialist || user.role === "specialist") {
    items.push({ href: "/kabinet/portfolio", label: "Portfolio", icon: "portfolio" });
  }
  items.push({ href: "/kabinet/tolovlar", label: "To'lovlar", icon: "payments" });
  items.push({ href: "/kabinet/xavfsizlik", label: "Xavfsizlik", icon: "security" });
  if (user.specialist) {
    items.push({ href: `/mutaxassislar/${user.specialist.slug}`, label: "Ommaviy profil", icon: "public" });
  }
  if (user.role === "admin") {
    items.push({ href: "/admin", label: "Admin panel", icon: "admin" });
  }

  return (
    /*
     * 390px'da gorizontal siljish bo'lmasligi uchun: grid bolalari min-w-0, rasmlar max-w-full,
     * gorizontal qatorlar (nav pill'lari) o'z ichida aylanadi (overflow-x-auto).
     */
    <div className="container-x min-w-0 max-w-full [&_img]:max-w-full [&_table]:max-w-full">
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-8">
        <aside className="min-w-0 lg:col-span-3">
          <KabinetNav
            items={items}
            user={{ name: user.name, avatarUrl: user.avatarUrl, roleLabel: ROLE_LABEL[user.role], email: user.email }}
          />
        </aside>
        <div className="min-w-0 lg:col-span-9">{children}</div>
      </div>
    </div>
  );
}
