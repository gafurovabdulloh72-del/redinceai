import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { TermsBanner } from "@/components/auth/TermsBanner";
import { KabinetNav, type KabinetNavDot, type KabinetNavItem } from "@/components/kabinet/KabinetNav";
import { unreadDmCount } from "@/lib/chat/dm";
import { BANNER_DAYS } from "@/components/subscription/SubscriptionBanner";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { jobs, notifications, orders, proposals } from "@/lib/db/schema";
import { getSettings } from "@/lib/payments/settings";
import { subscriptionState, type SubscriptionState } from "@/lib/subscriptions/access";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kabinet", template: "%s · Kabinet · Kasb Egalari" },
  robots: { index: false, follow: false },
};

const ROLE_LABEL = {
  client: "Mijoz",
  specialist: "Mutaxassis",
  admin: "Administrator",
} as const;

/** Shu kundan kam qolsa — "tugayapti" (sariq): SubscriptionBanner bilan bir xil chegara */
const EXPIRING_DAYS = BANNER_DAYS;

/** Ixcham pill shu kundan kam qolganda (yoki tugaganda) chiqadi */
const PILL_DAYS = 5;

/**
 * Ixcham obuna pill'i (G6/#74): to'liq banner faqat kabinetning umumiy sahifasida (kabinet/page.tsx),
 * qolgan sahifalarda kontentni pastga surmaydigan bir qatorlik eslatma — faqat ≤5 kun qolganda yoki tugaganda.
 */
function SubscriptionPill({ st }: { st: SubscriptionState }) {
  if (st.status === "off" || st.status === "exempt") return null;
  const urgent = st.status === "expired" || st.status === "grace";
  if (!urgent && st.daysLeft > PILL_DAYS) return null;
  const expired = st.status === "expired";
  const label = expired
    ? "Obuna faol emas — profil katalogda ko'rinmaydi"
    : st.status === "grace"
      ? `Obuna tugadi — muhlat: ${st.daysLeft} kun`
      : st.status === "trial"
        ? `Sinov tugashiga ${st.daysLeft} kun qoldi`
        : `Obuna tugashiga ${st.daysLeft} kun qoldi`;
  return (
    <div
      role={expired ? "alert" : "status"}
      className={cn(
        "mb-5 flex min-h-10 items-center justify-between gap-3 rounded-full border px-4 py-1.5",
        expired ? "border-danger/30 bg-danger-soft" : "border-warning/30 bg-warning-soft",
      )}
    >
      <p className={cn("truncate text-[13px] font-semibold", expired ? "text-danger-text" : "text-warning-text")}>{label}</p>
      <Link href="/kabinet/obuna#rejalar" className="shrink-0 text-[13px] font-semibold text-fg underline underline-offset-2 transition hover:opacity-80">
        Uzaytirish
      </Link>
    </div>
  );
}

/** Navigatsiyadagi obuna nuqtasi: faol — yashil, tugayapti / imtiyozli muddat — sariq, faol emas — qizil; talab o'chiq — nuqtasiz */
function subscriptionDot(st: SubscriptionState): { dot: KabinetNavDot; dotLabel: string } | null {
  switch (st.status) {
    case "off":
      return null;
    case "expired":
      return { dot: "danger", dotLabel: "obuna faol emas" };
    case "grace":
      return { dot: "warning", dotLabel: `imtiyozli muddat: ${st.daysLeft} kun qoldi` };
    default:
      return st.daysLeft <= EXPIRING_DAYS
        ? { dot: "warning", dotLabel: `${st.status === "trial" ? "sinov muddati" : "obuna"} tugashiga ${st.daysLeft} kun qoldi` }
        : { dot: "success", dotLabel: st.status === "trial" ? "sinov muddati faol" : "obuna faol" };
  }
}

export default async function KabinetLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Middleware allaqachon himoya qiladi; bu ehtiyot chorasi
  if (!user) redirect(await loginRedirectPath("/kabinet"));

  // Yangi (hali ko'rilmagan) buyurtmalar soni — navigatsiyadagi hisoblagich uchun
  // + o'qilmagan bildirishnomalar soni (F1) — har ikkisi parallel
  const specialistId = user.specialist?.id;
  // + mijoz: ochiq e'lonlaridagi ko'rib chiqilmagan (pending) takliflar soni
  const [newOrders, unread, settings, pendingProposals, unreadDm] = await Promise.all([
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
    getSettings(),
    user.role === "client"
      ? db
          .select({ n: count() })
          .from(proposals)
          .innerJoin(jobs, eq(jobs.id, proposals.jobId))
          .where(and(eq(jobs.clientId, user.id), eq(jobs.status, "open"), eq(proposals.status, "pending")))
          .then((r) => r[0]?.n ?? 0)
          .catch(() => 0)
      : Promise.resolve(0),
    unreadDmCount(user.id).catch(() => 0),
  ]);
  // Obuna holati (yagona qoida — subscriptions/access.ts): navigatsiya nuqtasi va banner
  const subState = user.specialist ? subscriptionState(user.specialist, settings) : null;
  const subDot = subState ? subscriptionDot(subState) : null;

  const items: KabinetNavItem[] = [
    { href: "/kabinet", label: "Umumiy", icon: "overview", exact: true },
    { href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: "orders", badge: newOrders },
    { href: "/kabinet/chat", label: "Chat", icon: "chat", badge: unreadDm },
    { href: "/kabinet/bildirishnomalar", label: "Bildirishnomalar", icon: "notifications", badge: unread },
  ];
  // Mijoz: e'lonlari, ishlagan mutaxassislari (F48), saqlangan qidiruvlari
  if (user.role === "client") {
    items.push({ href: "/kabinet/elonlar", label: "E'lonlarim", icon: "jobs", badge: pendingProposals });
    items.push({ href: "/kabinet/mutaxassislarim", label: "Mutaxassislarim", icon: "partners" });
    items.push({ href: "/kabinet/qidiruvlar", label: "Saqlangan qidiruvlar", icon: "searches" });
  }
  // Mutaxassis: takliflari, obunasi (holat nuqtasi bilan) va oylik hisoboti
  if (user.role === "specialist") {
    items.push({ href: "/kabinet/takliflar", label: "Takliflarim", icon: "proposals" });
    items.push({ href: "/kabinet/obuna", label: "Obuna", icon: "subscription", ...(subDot ?? {}) });
    if (user.specialist) items.push({ href: "/kabinet/hisobot", label: "Hisobot", icon: "report" });
  }
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
        <aside className="min-w-0 print:hidden lg:col-span-3">
          <KabinetNav
            items={items}
            user={{ name: user.name, avatarUrl: user.avatarUrl, roleLabel: ROLE_LABEL[user.role], email: user.email }}
          />
        </aside>
        <div className="min-w-0 lg:col-span-9 print:col-span-12">
          {/* Bloklamaydigan bannerlar: shartlar (G1) va ixcham obuna pill'i (G6/#74) — chop etishda ko'rinmaydi.
              To'liq obuna banneri faqat umumiy sahifada (kabinet/page.tsx) — boshqa sahifalarda kontent pastga surilmasin */}
          <div className="print:hidden">
            <TermsBanner />
            {subState && <SubscriptionPill st={subState} />}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
