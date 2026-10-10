import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { KabinetNav, type KabinetNavItem } from "@/components/kabinet/KabinetNav";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";

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
  if (!user) redirect("/auth/kirish?next=%2Fkabinet");

  // Yangi (hali ko'rilmagan) buyurtmalar soni — navigatsiyadagi hisoblagich uchun
  let newOrders = 0;
  if (user.specialist) {
    const [row] = await db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.specialistId, user.specialist.id), eq(orders.status, "new")));
    newOrders = row?.n ?? 0;
  }

  const items: KabinetNavItem[] = [
    { href: "/kabinet", label: "Umumiy", icon: "overview", exact: true },
    { href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: "orders", badge: newOrders },
    { href: "/kabinet/profil", label: "Profil", icon: "profile" },
  ];
  if (user.specialist || user.role === "specialist") {
    items.push({ href: "/kabinet/portfolio", label: "Portfolio", icon: "portfolio" });
  }
  if (user.specialist) {
    items.push({ href: `/mutaxassislar/${user.specialist.slug}`, label: "Ommaviy profil", icon: "public" });
  }
  if (user.role === "admin") {
    items.push({ href: "/admin", label: "Admin panel", icon: "admin" });
  }

  return (
    <div className="container-x">
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
        <aside className="lg:col-span-3">
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
