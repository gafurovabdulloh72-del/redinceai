"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Clapperboard, Compass, Home, MessageCircle, PlusSquare, Search } from "lucide-react";
import { CreateMenu } from "./CreateMenu";
import { Avatar } from "@/components/ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsBell } from "./NotificationsBell";
import { parentPath } from "./nav-utils";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { setFavoritesViewer } from "@/components/specialists/favorites-store";
import { cn } from "@/lib/utils";

export interface NavUser {
  id: string;
  name: string;
  role: "client" | "specialist" | "admin";
  avatarUrl: string | null;
  specialistSlug?: string | null;
}

/** Tab-bar ildizlari — bu sahifalarda «Orqaga» tugmasi ko'rsatilmaydi */
const TAB_ROOTS = new Set(["/", "/qidiruv", "/lenta", "/kabinet/chat", "/kabinet/menyu", "/auth/kirish"]);

const isChatPath = (p: string) => p === "/kabinet/chat" || p.startsWith("/kabinet/chat/");

/**
 * Telefon qobig'i (md'gacha) — oddiy va tushunarli, Telegram/Instagram mantiqida:
 *  · Yuqori panel: yassi, past (56px) — faqat «orqaga»/logo va qo'ng'iroqcha (mehmonda til + «Boshlash»).
 *    Til, ko'rinish, qidiruv, hisob menyusi bu yerda YO'Q — ular tab'da va «Profil → Menyu»da.
 *  · Pastki tab: yassi, 5 ta aniq bo'lim — Asosiy · Qidiruv · Yaratish · Xabarlar · Profil (mehmonda Reels · Kirish).
 *  · Suhbat ochiq bo'lsa (DmChat `html[data-chat-open]` qo'yadi) ikkala panel yashirinadi — chat to'liq ekran.
 * md+ da butunlay yashirin — u yerda Sidebar ishlaydi.
 */
export function NavbarClient({ user, unread = 0, dmUnread = 0 }: { user: NavUser | null; unread?: number; dmUnread?: number }) {
  const til = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  // Ilova ichidagi navigatsiyalar soni: faqat pathname HAQIQATAN o'zgarganda ortadi (StrictMode'da effekt ikki marta
  // ishlaganda ham 0 qoladi) — «Orqaga» router.back() yoki ota yo'lni tanlashi uchun
  const navDepth = useRef(0);
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (prevPath.current !== null && prevPath.current !== pathname) navDepth.current += 1;
    prevPath.current = pathname;
  }, [pathname]);

  // Sevimlilar do'koniga ko'ruvchini e'lon qilamiz — kirish/chiqishdan so'ng yurak tugmalari yangilanadi
  const userId = user?.id ?? null;
  useEffect(() => setFavoritesViewer(userId), [userId]);

  // Klaviatura qisqartmasi `c` — telefon kengligida shu yerda (md+ da Sidebar)
  useEffect(() => {
    const on = () => {
      if (!window.matchMedia("(min-width: 768px)").matches) setCreateOpen(true);
    };
    window.addEventListener("open-create", on);
    return () => window.removeEventListener("open-create", on);
  }, []);

  /*
   * Tab'lar. Kirgan foydalanuvchi: Xabarlar (o'qilmagan soni bilan) va Profil (→ Menyu sahifasi).
   * Mehmon: Reels va Kirish. `match` — qaysi sahifalarda tab faol ko'rinadi.
   */
  const tabs: Array<{ key: string; href: string; label: Tr; icon: typeof Home; match: (p: string) => boolean; badge?: number; avatar?: boolean }> = [
    { key: "home", href: "/", label: SHELL.nav.homeShort, icon: Home, match: (p) => p === "/" },
    { key: "search", href: "/qidiruv", label: SHELL.nav.search, icon: Search, match: (p) => p === "/qidiruv" || p.startsWith("/qidiruv/") },
    { key: "create", href: "#yaratish", label: SHELL.nav.create, icon: PlusSquare, match: () => false },
    user
      ? { key: "chat", href: "/kabinet/chat", label: SHELL.nav.messages, icon: MessageCircle, match: isChatPath, badge: dmUnread }
      : { key: "lenta", href: "/lenta", label: SHELL.nav.lenta, icon: Clapperboard, match: (p) => p === "/lenta" || p.startsWith("/lenta/") },
    user
      ? { key: "profile", href: "/kabinet/menyu", label: SHELL.nav.profile, icon: Home, match: (p) => p.startsWith("/kabinet") && !isChatPath(p), avatar: true }
      : { key: "login", href: "/auth/kirish", label: SHELL.nav.loginShort, icon: Compass, match: (p) => p.startsWith("/auth") },
  ];

  const showBack = !TAB_ROOTS.has(pathname);
  const goBack = () => {
    if (navDepth.current > 0) router.back();
    else router.push(parentPath(pathname));
  };

  return (
    <>
      {/* ---------- Yuqori panel (telefon): yassi, 56px ---------- */}
      <header className="m-topbar glass fixed inset-x-0 top-0 z-50 border-b border-line md:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }} data-print-hide>
        <nav className="flex h-14 items-center justify-between gap-2 px-2" aria-label={tr(til, SHELL.nav.mainAria)}>
          <div className="flex min-w-0 items-center gap-0.5">
            {showBack && (
              <button type="button" onClick={goBack} aria-label={tr(til, SHELL.common.back)} className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition hover:bg-fg/6">
                <ChevronLeft size={26} />
              </button>
            )}
            {/* So'z belgisi faqat kirgan foydalanuvchida (joy bor) — mehmonda til/tema/«Boshlash» bilan sig'maydi, faqat belgi */}
            <Logo className={cn("pl-1", (showBack || !user) && "[&>span:last-child]:hidden")} />
          </div>
          <div className="flex items-center gap-1">
            {user ? (
              <NotificationsBell initialUnread={unread} />
            ) : (
              <>
                <LocaleSwitch />
                <ThemeToggle />
                <Link href="/auth/royxat" className="btn-ink ml-1 inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold">
                  {tr(til, SHELL.nav.start)}
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Pastki tab-bar (telefon): yassi, 5 ta teng ustun ---------- */}
      <nav className="m-tabbar glass fixed inset-x-0 bottom-0 z-50 border-t border-line md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label={tr(til, SHELL.nav.mobileAria)} data-print-hide>
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            // Yorliq kamida 12px — kichik shrift o'qilishi qiyin (a11y)
            const cls = "press relative flex h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 text-[12px] font-medium";
            const label = <span className="max-w-full truncate">{tr(til, t.label)}</span>;
            if (t.href === "#yaratish") {
              return (
                <button key={t.key} type="button" onClick={() => setCreateOpen(true)} aria-haspopup="dialog" aria-expanded={createOpen} className={cn(cls, "text-fg-3")}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink text-ink-fg">
                    <Icon size={20} strokeWidth={2.4} />
                  </span>
                  {label}
                </button>
              );
            }
            const active = t.match(pathname);
            return (
              <Link key={t.key} href={t.href} aria-current={active ? "page" : undefined} className={cn(cls, active ? "text-fg" : "text-fg-3")}>
                {active && <span aria-hidden="true" className="absolute inset-x-7 top-0 h-0.5 rounded-full bg-ink" />}
                <span className="relative">
                  {t.avatar && user ? (
                    <span className={cn("block rounded-full", active && "ring-2 ring-ink ring-offset-2 ring-offset-bg")}>
                      <Avatar name={user.name} src={user.avatarUrl} size={26} decorative />
                    </span>
                  ) : (
                    <Icon size={25} strokeWidth={active ? 2.4 : 1.9} />
                  )}
                  {t.badge ? (
                    <span className="absolute -right-2.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-strong px-1 text-[11px] font-bold leading-none text-white">
                      {t.badge > 99 ? "99+" : t.badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      <CreateMenu open={createOpen} onClose={() => setCreateOpen(false)} user={user ? { id: user.id, role: user.role, specialistSlug: user.specialistSlug } : null} />
    </>
  );
}
