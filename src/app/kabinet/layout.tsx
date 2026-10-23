import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { TermsBanner } from "@/components/auth/TermsBanner";
import { KabinetNav, type KabinetNavDot, type KabinetNavItem } from "@/components/kabinet/KabinetNav";
import { KabinetShell } from "@/components/kabinet/KabinetShell";
import { TelegramNudge } from "@/components/kabinet/TelegramNudge";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import { unreadDmCount } from "@/lib/chat/dm";
import { BANNER_DAYS } from "@/components/subscription/SubscriptionBanner";
import { getCurrentUser, loginRedirectPath } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { ownCompleteness } from "@/lib/profile/own-completeness";
import { ProfileMeter } from "@/components/feed/ProfileMeter";
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
      // Doimiy banner: role="alert" har navigatsiyada avtomatik silkinardi — status (o'qiladi, lekin shovqinsiz)
      role="status"
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
  const [newOrders, unread, settings, pendingProposals, unreadDm, own, til] = await Promise.all([
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
    // Profil to'ldirilganlik (maqsad gradienti) — telefon «Menyu»sida tepada ko'rinadi; 100% bo'lsa null
    ownCompleteness(user).catch(() => null),
    getLocale(),
  ]);
  // Obuna holati (yagona qoida — subscriptions/access.ts): navigatsiya nuqtasi va banner
  const subState = user.specialist ? subscriptionState(user.specialist, settings) : null;
  const subDot = subState ? subscriptionDot(subState) : null;

  // Profil to'ldirilganlik nuqtasi: mutaxassis profili yetarlicha to'ldirilmagan bo'lsa (sarlavha/bio/narx/ko'nikma/rasm/aloqa — 6 ta mezon)
  const sp = user.specialist;
  const profileScore = sp ? [sp.title.trim().length >= 5, sp.bio.trim().length >= 80, sp.priceFrom > 0, sp.skills.length >= 3, Boolean(sp.coverUrl || user.avatarUrl), Boolean(sp.telegram || sp.instagram)].filter(Boolean).length : 6;
  const profileDot = sp && profileScore < 4 ? { dot: "warning" as const, dotLabel: `profil ${Math.round((profileScore / 6) * 100)}% to'ldirilgan` } : {};

  /*
   * Menyu guruhlangan (chunking — Hick/Miller qonunlari): kundalik 4 band tepada guruhsiz,
   * qolgani mazmuniy bo'limlarga ajratilgan. Telefonda faqat tepa 4 pill + «Ko'proq» varaq,
   * desktopda bo'lim sarlavhalari bilan. Guruhsiz band = birlamchi (telefon pill).
   */
  const items: KabinetNavItem[] = [
    // Birlamchi (kundalik) — telefonda pill, desktopda sarlavhasiz tepa blok
    { href: "/kabinet", label: "Umumiy", icon: "overview", exact: true },
    { href: "/kabinet/buyurtmalar", label: "Buyurtmalar", icon: "orders", badge: newOrders },
    { href: "/kabinet/chat", label: "Chat", icon: "chat", badge: unreadDm },
    { href: "/kabinet/bildirishnomalar", label: "Bildirishnomalar", icon: "notifications", badge: unread },
  ];

  // Mutaxassis: ijod bo'limi (profil/portfolio/postlar) — eng muhim ikkilamchi blok tepada
  if (user.role === "specialist" || user.specialist) {
    items.push({ href: "/kabinet/profil", label: "Profil", icon: "profile", group: "Ijodim", ...profileDot });
    items.push({ href: "/kabinet/portfolio", label: "Portfolio", icon: "portfolio", group: "Ijodim" });
    items.push({ href: "/kabinet/postlar", label: "Postlarim", icon: "posts", group: "Ijodim" });
    items.push({ href: "/kabinet/rejalashtirilgan", label: "Rejalashtirilgan", icon: "scheduled", group: "Ijodim" });
    if (user.specialist) items.push({ href: `/mutaxassislar/${user.specialist.slug}`, label: "Ommaviy profilim", icon: "public", group: "Ijodim" });
  }

  // Faoliyat — rolga qarab
  if (user.role === "client") {
    items.push({ href: "/kabinet/elonlar", label: "E'lonlarim", icon: "jobs", badge: pendingProposals, group: "Faoliyat" });
    items.push({ href: "/kabinet/mutaxassislarim", label: "Mutaxassislarim", icon: "partners", group: "Faoliyat" });
    items.push({ href: "/kabinet/qidiruvlar", label: "Saqlangan qidiruvlar", icon: "searches", group: "Faoliyat" });
  }
  if (user.role === "specialist") {
    items.push({ href: "/kabinet/takliflar", label: "Takliflarim", icon: "proposals", group: "Faoliyat" });
    items.push({ href: "/kabinet/obuna", label: "Obuna", icon: "subscription", group: "Faoliyat", ...(subDot ?? {}) });
    if (user.specialist) items.push({ href: "/kabinet/hisobot", label: "Hisobot", icon: "report", group: "Faoliyat" });
  }

  // Mentorlik (barcha rollar: talaba sifatida o'qish, mutaxassis sifatida dars berish)
  items.push({ href: "/kabinet/mentorlik", label: "Mentorlik", icon: "mentorship", group: "Faoliyat" });

  // Vakansiyalar bo'limi (barcha rollar, to'lovsiz)
  items.push({ href: "/kabinet/vakansiyalar", label: "Vakansiyalar", icon: "vacancies", group: "Vakansiyalar" });
  items.push({ href: "/kabinet/arizalarim", label: "Arizalarim", icon: "applications", group: "Vakansiyalar" });
  items.push({ href: "/kabinet/rezyume", label: "Rezyume", icon: "resume", group: "Vakansiyalar" });

  // Saqlangan / kuzatuv
  items.push({ href: "/kabinet/sevimlilar", label: "Sevimlilar", icon: "favorites", group: "Saqlangan" });
  items.push({ href: "/kabinet/saqlanganlar", label: "Saqlangan postlar", icon: "saved", group: "Saqlangan" });
  items.push({ href: "/kabinet/obunalar", label: "Obunalar", icon: "follows", group: "Saqlangan" });
  // Kutubxona: ko'rish tarixi, keyinroq ko'rish navbati va to'plamlar (pleylist)
  items.push({ href: "/kabinet/tarix", label: "Ko'rish tarixi", icon: "history", group: "Saqlangan" });
  items.push({ href: "/kabinet/keyinroq", label: "Keyinroq ko'rish", icon: "later", group: "Saqlangan" });
  items.push({ href: "/kabinet/toplamlar", label: "To'plamlar", icon: "collections", group: "Saqlangan" });
  items.push({ href: "/kabinet/yaqin-doslar", label: "Yaqin do'stlar", icon: "closeFriends", group: "Saqlangan" });


  // Hisob (sozlamalar)
  if (user.role === "client") items.push({ href: "/kabinet/profil", label: "Profil", icon: "profile", group: "Hisob" });
  items.push({ href: "/kabinet/tolovlar", label: "To'lovlar", icon: "payments", group: "Hisob" });
  // Xavfsizlik nuqtasi: email tasdiqlanmagan (parol tiklash ishlamaydi)
  items.push({ href: "/kabinet/xavfsizlik", label: "Xavfsizlik", icon: "security", group: "Hisob", ...(!user.emailVerified ? { dot: "warning" as const, dotLabel: "email tasdiqlanmagan" } : {}) });
  if (user.role === "admin") {
    items.push({ href: "/admin", label: "Admin panel", icon: "admin", group: "Hisob" });
  }

  return (
    /*
     * 390px'da gorizontal siljish bo'lmasligi uchun: grid bolalari min-w-0, rasmlar max-w-full (KabinetShell).
     * Chat sahifasida kabinet yon menyusi desktopda yashiriladi (KabinetShell) — suhbatga butun kenglik.
     */
    <KabinetShell aside={<KabinetNav items={items} user={{ name: user.name, avatarUrl: user.avatarUrl, roleLabel: ROLE_LABEL[user.role], email: user.email }} meter={own ? <ProfileMeter data={own} til={til} /> : null} />}>
      {/* Bloklamaydigan bannerlar: shartlar (G1) va ixcham obuna pill'i (G6/#74) — chop etishda ko'rinmaydi.
          To'liq obuna banneri faqat umumiy sahifada (kabinet/page.tsx) — boshqa sahifalarda kontent pastga surilmasin */}
      <div className="print:hidden">
        <TermsBanner />
        {subState && <SubscriptionPill st={subState} />}
        {/* Telegram ulanmagan bo'lsa — buyurtma/javob/e'lon xabarini o'tkazib yubormaslik uchun eslatma (admindan tashqari hammaga) */}
        {user.role !== "admin" && isTelegramEnabled() && telegramBotUsername() && !user.telegramChatId && <TelegramNudge forClient={user.role === "client"} />}
        <InstallPrompt />
      </div>
      {children}
    </KabinetShell>
  );
}
