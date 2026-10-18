"use client";

import { usePresence } from "@/components/motion/usePresence";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronLeft, Clapperboard, Compass, CreditCard, Heart, Home, LayoutDashboard, LogOut, PlusSquare, ShieldCheck, UserCog, UserRound, UsersRound, Briefcase, Search } from "lucide-react";
import { CreateMenu } from "./CreateMenu";
import { Avatar, Kbd } from "@/components/ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsBell } from "./NotificationsBell";
import { parentPath, routeActive } from "./nav-utils";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { setFavoritesViewer } from "@/components/specialists/favorites-store";
import { SearchButton } from "@/components/search/SearchButton";
import { cn } from "@/lib/utils";

export interface NavUser {
  id: string;
  name: string;
  role: "client" | "specialist" | "admin";
  avatarUrl: string | null;
  specialistSlug?: string | null;
}

/** Tab-bar ildizlari — bu sahifalarda «Orqaga» tugmasi ko'rsatilmaydi */
const TAB_ROOTS = new Set(["/", "/qidiruv", "/lenta", "/kabinet", "/auth/kirish"]);

/**
 * Telefon qobig'i (md'gacha): yuqori kapsula (orqaga · logo · qidiruv · til · ko'rinish · qo'ng'iroq · hisob) + pastki 5 ta tab.
 * md+ da butunlay yashirin — u yerda Sidebar ishlaydi (shuning uchun desktop havolalar bu yerda yo'q).
 * «Orqaga»: ichki sahifalarda; ilova ichida tarix bo'lsa router.back(), aks holda (to'g'ridan-to'g'ri kirilgan) ota yo'lga.
 */
export function NavbarClient({ user, unread = 0, groupsUnread = 0 }: { user: NavUser | null; unread?: number; groupsUnread?: number }) {
  const til = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navDepth = useRef(0);
  // Menyu yopilganda chiqish animatsiyasi o'ynab bo'lguncha DOM'da qoladi
  const { mounted: menuMounted, closing: menuClosing } = usePresence(open, 200);

  useEffect(() => {
    setOpen(false);
    navDepth.current += 1;
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

  useEffect(() => {
    if (!open) return;
    // Menyu ochilganda fokus birinchi bandga o'tadi (role="menu" klaviatura talabi)
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Yopilganda fokus ochgan tugmaga qaytadi
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* Menyu ichida strelkalar bilan yurish: Down/Up aylanadi, Home/End chetlariga o'tadi */
  const onMenuKey = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Home") items[0].focus();
    else if (e.key === "End") items[items.length - 1].focus();
    else if (e.key === "ArrowDown") items[(i + 1) % items.length].focus();
    else items[(i - 1 + items.length) % items.length].focus();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // Ijtimoiy tarmoq tab-bar'i: Bosh sahifa · Qidiruv · Yaratish · Lenta · Profil (mehmon — Kirish)
  const profileHref = user ? (user.specialistSlug ? `/mutaxassislar/${user.specialistSlug}` : "/kabinet") : "/auth/kirish";
  const tabs: Array<{ href: string; short: Tr; icon: typeof Home; exact?: boolean }> = [
    { href: "/", short: SHELL.nav.homeShort, icon: Home, exact: true },
    { href: "/qidiruv", short: SHELL.nav.search, icon: Search },
    { href: "#yaratish", short: SHELL.nav.create, icon: PlusSquare },
    { href: "/lenta", short: SHELL.nav.lenta, icon: Clapperboard },
    { href: profileHref, short: user ? SHELL.nav.profile : SHELL.nav.loginShort, icon: user ? UserRound : Compass },
  ];
  const showBack = !TAB_ROOTS.has(pathname) && pathname !== profileHref;
  const goBack = () => {
    if (navDepth.current > 1) router.back();
    else router.push(parentPath(pathname));
  };

  return (
    <>
      {/* ---------- Yuqori panel (telefon) ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4 md:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }} data-print-hide>
        <nav className="nav-bar relative mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 !rounded-full pl-2 pr-2 sm:h-16 sm:pl-3" aria-label={tr(til, SHELL.nav.mainAria)}>
          <div className="flex min-w-0 items-center gap-1">
            {showBack && (
              <button type="button" onClick={goBack} aria-label={tr(til, SHELL.common.back)} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-2 transition hover:bg-fg/6 hover:text-fg">
                <ChevronLeft size={22} />
              </button>
            )}
            {/* Juda tor ekranlarda so'z belgisi sig'maydi — faqat ikonka qoladi */}
            <Logo className={cn("pl-1", showBack ? "max-[480px]:[&>span:last-child]:hidden" : "max-[430px]:[&>span:last-child]:hidden")} />
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <SearchButton />
            <LocaleSwitch />
            <ThemeToggle />
            {user && <NotificationsBell initialUnread={unread} />}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button ref={triggerRef} type="button" onClick={() => setOpen((v) => !v)} className="card card-hover ml-1 flex h-10 shrink-0 items-center !rounded-full p-1" aria-haspopup="menu" aria-expanded={open} aria-label={SHELL.menu.aria[til](user.name)}>
                  <Avatar name={user.name} src={user.avatarUrl} size={30} decorative />
                </button>

                {menuMounted && (
                  <div
                    role="menu"
                    aria-label={SHELL.menu.aria[til](user.name)}
                    onKeyDown={onMenuKey}
                    className={cn(
                      "card-floating absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right overflow-hidden p-1.5 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] max-sm:top-auto max-sm:w-auto max-sm:origin-bottom max-sm:p-2",
                      menuClosing ? "pop-out max-sm:animate-sheet-down" : "pop-in max-sm:animate-slide-up",
                    )}
                    style={{ ["--pop-origin" as string]: "top right" }}
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
                      <p className="text-xs text-fg-3">{tr(til, user.role === "admin" ? SHELL.menu.roleAdmin : user.role === "specialist" ? SHELL.menu.roleSpecialist : SHELL.menu.roleClient)}</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <MenuItem href="/kabinet" icon={LayoutDashboard}>
                      {tr(til, SHELL.menu.cabinet)}
                    </MenuItem>
                    {user.role === "specialist" && user.specialistSlug && (
                      <MenuItem href={`/mutaxassislar/${user.specialistSlug}`} icon={UserRound}>
                        {tr(til, SHELL.menu.myProfile)}
                      </MenuItem>
                    )}
                    {(user.role === "specialist" || user.role === "admin") && (
                      <MenuItem href="/kabinet/obuna" icon={CreditCard}>
                        {tr(til, SHELL.menu.subscription)}
                      </MenuItem>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(new Event("open-search"));
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-tile px-3 py-2.5 text-left text-[14px] font-medium text-fg transition hover:bg-fg/6"
                    >
                      <Search size={16} className="text-fg-3" /> {tr(til, SHELL.nav.search)} <Kbd className="ml-auto">⌘K</Kbd>
                    </button>
                    <MenuItem href="/jamoalar?mine=1" icon={UsersRound}>
                      {tr(til, SHELL.menu.groups)}
                      {groupsUnread > 0 && <span className="ml-auto inline-flex h-5 min-w-5 animate-badge-pop items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{groupsUnread}</span>}
                    </MenuItem>
                    <MenuItem href="/vakansiyalar" icon={Briefcase}>
                      {tr(til, SHELL.menu.vacancies)}
                    </MenuItem>
                    <MenuItem href="/kabinet/bildirishnomalar" icon={Bell}>
                      {tr(til, SHELL.menu.notifications)}
                    </MenuItem>
                    <MenuItem href="/kabinet/sevimlilar" icon={Heart}>
                      {tr(til, SHELL.menu.favorites)}
                    </MenuItem>
                    <MenuItem href="/kabinet/profil" icon={UserCog}>
                      {tr(til, SHELL.menu.profile)}
                    </MenuItem>
                    {user.role === "admin" && (
                      <MenuItem href="/admin" icon={ShieldCheck}>
                        {tr(til, SHELL.menu.admin)}
                      </MenuItem>
                    )}
                    <div className="my-1 h-px bg-line" />
                    <button type="button" onClick={logout} role="menuitem" className="flex min-h-11 w-full items-center gap-2.5 rounded-tile px-3 py-2.5 text-left text-[14px] font-medium text-danger-text transition hover:bg-danger-soft">
                      <LogOut size={16} /> {tr(til, SHELL.menu.logout)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/royxat" className="btn-ink ml-1 inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold">
                {tr(til, SHELL.nav.start)}
              </Link>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Pastki tab-bar (telefon): 5 ta teng ustun, safe-area ---------- */}
      <nav className="nav-bar fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 items-stretch !rounded-full p-1.5 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }} aria-label={tr(til, SHELL.nav.mobileAria)} data-print-hide>
        {tabs.map((n) => {
          const Icon = n.icon;
          // Yorliq kamida 12px — kichik shrift o'qilishi qiyin (a11y)
          const cls = "press flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[12px] font-semibold transition-[background-color,color] duration-300";
          if (n.href === "#yaratish") {
            return (
              <button key={n.href} type="button" onClick={() => setCreateOpen(true)} aria-haspopup="dialog" aria-expanded={createOpen} className={cn(cls, "text-fg-3")}>
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent text-white">
                  <Icon size={18} strokeWidth={2.4} />
                </span>
                <span className="max-w-full truncate">{tr(til, n.short)}</span>
              </button>
            );
          }
          const active = routeActive(pathname, n.href, n.exact);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn(cls, active ? "btn-ink" : "text-fg-3")}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} className={cn("transition-transform duration-300 ease-[var(--ease-spring)]", active && "scale-110")} />
              <span className="max-w-full truncate">{tr(til, n.short)}</span>
            </Link>
          );
        })}
      </nav>
      <CreateMenu open={createOpen} onClose={() => setCreateOpen(false)} user={user ? { id: user.id, role: user.role, specialistSlug: user.specialistSlug } : null} />
    </>
  );
}

function MenuItem({ href, icon: Icon, children }: { href: string; icon: typeof Home; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" className="flex min-h-11 items-center gap-2.5 rounded-tile px-3 py-2.5 text-[14px] font-medium text-fg transition hover:bg-fg/6">
      <Icon size={16} className="text-fg-3" /> {children}
    </Link>
  );
}
