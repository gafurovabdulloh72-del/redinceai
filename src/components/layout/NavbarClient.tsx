"use client";

import { usePresence } from "@/components/motion/usePresence";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, BriefcaseBusiness, Clapperboard, Compass, CreditCard, Heart, Home, Info, LayoutDashboard, LogOut, Map, PlusSquare, ShieldCheck, UserCog, Users, UserRound, UsersRound, Briefcase, Search } from "lucide-react";
import { CreateMenu } from "./CreateMenu";
import { Avatar } from "@/components/ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsBell } from "./NotificationsBell";
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

/**
 * short — mobil tab-bar yorlig'i (5 ustun, 390px'da ~70px: uzun so'z kesilmasin).
 * "Mutaxassislar" 12px'da ham tabga sig'maydi (~78px > ~67px), shuning uchun ikkala joyda
 * bir xil "Ijodkorlar" ishlatiladi — nom desktop va mobilda mos keladi.
 * desktop: "lg" — faqat lg+ da (md'da kapsula torayadi; logo baribir bosh sahifaga olib boradi).
 * mobile: false — pastki tab-bar'da yo'q; md+ da tab-bar yashirin, shuning uchun "Narxlar" yuqori panelda md'dan boshlab ko'rinadi.
 */
const NAV: Array<{ href: string; label: Tr; short: Tr; icon: typeof Home; exact?: boolean; desktop?: "lg" | "2xl"; mobile?: false }> = [
  // "Bosh sahifa" faqat 2xl'da — logo baribir bosh sahifaga olib boradi; mobil tab-barda "Asosiy" qoladi
  { href: "/", label: SHELL.nav.home, short: SHELL.nav.homeShort, icon: Home, exact: true, desktop: "2xl" },
  { href: "/xarita", label: SHELL.nav.map, short: SHELL.nav.map, icon: Map },
  { href: "/lenta", label: SHELL.nav.lenta, short: SHELL.nav.lenta, icon: Clapperboard },
  { href: "/mutaxassislar", label: SHELL.nav.specialists, short: SHELL.nav.specialistsShort, icon: Users },
  // Jamoalar — ijodkorlar hamjamiyati. md'da (768px) 5-havola sig'maydi, mobil tab-bar 7 ustun bo'lib ketadi —
  // shuning uchun lg+ da; kichik ekranlarda foydalanuvchi menyusi, footer va bosh sahifa orqali
  { href: "/jamoalar", label: SHELL.nav.groups, short: SHELL.nav.groups, icon: UsersRound, mobile: false, desktop: "lg" },
  { href: "/ishlar", label: SHELL.nav.jobs, short: SHELL.nav.jobs, icon: BriefcaseBusiness },
  // Vakansiyalar — barcha onlayn kasblar uchun ish o'rinlari (lg+; mobilda menyu/footer orqali)
  { href: "/vakansiyalar", label: SHELL.nav.vacancies, short: SHELL.nav.vacancies, icon: Briefcase, mobile: false, desktop: "lg" },
  // Narxlar — footer va kabinetda ham bor; kapsulaga sig'ishi uchun faqat 2xl'da
  { href: "/narxlar", label: SHELL.nav.prices, short: SHELL.nav.prices, icon: CreditCard, mobile: false, desktop: "2xl" },
  { href: "/haqida", label: SHELL.nav.about, short: SHELL.nav.about, icon: Info, mobile: false, desktop: "lg" },
];

export function NavbarClient({ user, unread = 0, groupsUnread = 0 }: { user: NavUser | null; unread?: number; groupsUnread?: number }) {
  const til = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Menyu yopilganda chiqish animatsiyasi o'ynab bo'lguncha DOM'da qoladi
  const { mounted: menuMounted, closing: menuClosing } = usePresence(open, 200);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  // Sevimlilar do'koniga ko'ruvchini e'lon qilamiz — kirish/chiqishdan so'ng yurak tugmalari yangilanadi
  const userId = user?.id ?? null;
  useEffect(() => setFavoritesViewer(userId), [userId]);

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

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

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

  return (
    <>
      {/* ---------- Yuqori panel: max-w-5xl (xl: 6xl, 2xl: 7xl) kapsula, scroll'da biroz ixchamlashadi ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4 md:hidden" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <nav
          className={cn(
            "nav-bar relative mx-auto flex w-full max-w-5xl items-center xl:max-w-6xl 2xl:max-w-7xl justify-between gap-3 !rounded-full pl-3 pr-2 transition-[height,box-shadow] duration-300 sm:pl-4",
            scrolled ? "h-14 shadow-[var(--shadow-2)]" : "h-14 sm:h-16",
          )}
          aria-label={tr(til, SHELL.nav.mainAria)}
        >
          {/* Juda tor ekranlarda (til tugmasi qo'shilgach) so'z belgisi sig'maydi — faqat ikonka qoladi */}
          <Logo className="max-[430px]:[&>span:last-child]:hidden" />

          <div className="hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => {
              const active = isActive(n.href, n.exact);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative h-10 items-center whitespace-nowrap rounded-full px-3 text-[14px] font-semibold transition-[color,background-color] duration-200 hover:bg-fg/5 xl:px-3.5",
                    n.desktop === "lg" ? "hidden lg:flex" : n.desktop === "2xl" ? "hidden 2xl:flex" : "flex",
                    active ? "text-fg" : "text-fg-3 hover:text-fg",
                  )}
                >
                  {tr(til, n.label)}
                  {/* Jamoalarda o'qilmagan faollik — kichik nuqta (Telegram'dagi kabi) */}
                  {n.href === "/jamoalar" && groupsUnread > 0 && (
                    <>
                      <span aria-hidden className="absolute right-1 top-1.5 h-2 w-2 animate-pop rounded-full bg-accent" />
                      <span className="sr-only"> ({groupsUnread})</span>
                    </>
                  )}
                  {active && <span aria-hidden className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-accent xl:inset-x-3.5" />}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Qidiruv: mobil va xl+ da tugma (md/lg kapsula tor — ⌘K va menyu orqali) */}
            <SearchButton className="md:hidden xl:flex" />
            <LocaleSwitch />
            <ThemeToggle />
            {user && <NotificationsBell initialUnread={unread} />}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="card card-hover flex h-10 shrink-0 items-center gap-2 !rounded-full pl-1 pr-1.5 xl:pr-3"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={SHELL.menu.aria[til](user.name)}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size={30} decorative />
                  <span className="hidden max-w-[120px] truncate text-[14px] font-semibold text-fg xl:block">{user.name.split(" ")[0]}</span>
                </button>

                {menuMounted && (
                  <div
                    role="menu"
                    aria-label={SHELL.menu.aria[til](user.name)}
                    onKeyDown={onMenuKey}
                    className={cn(
                      "card-floating absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right overflow-hidden p-1.5 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] max-sm:top-auto max-sm:w-auto max-sm:origin-bottom max-sm:p-2",
                      menuClosing ? "animate-modal-out max-sm:animate-sheet-down" : "animate-scale-in max-sm:animate-slide-up",
                    )}
                    style={{ animationDuration: menuClosing ? "0.2s" : "0.26s" }}
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
                      <p className="text-xs text-fg-3">
                        {tr(til, user.role === "admin" ? SHELL.menu.roleAdmin : user.role === "specialist" ? SHELL.menu.roleSpecialist : SHELL.menu.roleClient)}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <MenuItem href="/kabinet" icon={LayoutDashboard}>{tr(til, SHELL.menu.cabinet)}</MenuItem>
                    {user.role === "specialist" && user.specialistSlug && (
                      <MenuItem href={`/mutaxassislar/${user.specialistSlug}`} icon={UserRound}>{tr(til, SHELL.menu.myProfile)}</MenuItem>
                    )}
                    {(user.role === "specialist" || user.role === "admin") && <MenuItem href="/kabinet/obuna" icon={CreditCard}>{tr(til, SHELL.menu.subscription)}</MenuItem>}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(new Event("open-search"));
                      }}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-tile px-3 py-2.5 text-left text-[14px] font-medium text-fg transition hover:bg-fg/6 xl:hidden"
                    >
                      <Search size={16} /> Qidiruv <kbd className="ml-auto rounded-md border border-line px-1.5 text-[11px] text-fg-3">⌘K</kbd>
                    </button>
                    <MenuItem href="/jamoalar?mine=1" icon={UsersRound}>
                      {tr(til, SHELL.menu.groups)}
                      {groupsUnread > 0 && <span className="ml-auto inline-flex h-5 min-w-5 animate-badge-pop items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">{groupsUnread}</span>}
                    </MenuItem>
                    <MenuItem href="/vakansiyalar" icon={Briefcase}>{tr(til, SHELL.menu.vacancies)}</MenuItem>
                    <MenuItem href="/kabinet/bildirishnomalar" icon={Bell}>{tr(til, SHELL.menu.notifications)}</MenuItem>
                    <MenuItem href="/kabinet/sevimlilar" icon={Heart}>{tr(til, SHELL.menu.favorites)}</MenuItem>
                    <MenuItem href="/kabinet/profil" icon={UserCog}>{tr(til, SHELL.menu.profile)}</MenuItem>
                    {user.role === "admin" && <MenuItem href="/admin" icon={ShieldCheck}>{tr(til, SHELL.menu.admin)}</MenuItem>}
                    <div className="my-1 h-px bg-line" />
                    <button
                      type="button"
                      onClick={logout}
                      role="menuitem"
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-tile px-3 py-2.5 text-left text-[14px] font-medium text-danger-text transition hover:bg-danger-soft"
                    >
                      <LogOut size={16} /> {tr(til, SHELL.menu.logout)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/kirish" className="hidden h-10 items-center rounded-full px-4 text-[14px] font-semibold text-fg-2 transition hover:text-fg sm:inline-flex">
                  {tr(til, SHELL.nav.login)}
                </Link>
                <Link href="/auth/royxat" className="btn-ink inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold sm:px-5">
                  {tr(til, SHELL.nav.start)}
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Pastki tab-bar (mobil): teng kenglikdagi 4 ta element, safe-area ---------- */}
      <nav
        className={cn(
          "nav-bar fixed inset-x-3 bottom-3 z-50 grid items-stretch !rounded-full p-1.5 shadow-[var(--shadow-2)] md:hidden",
          // "Lenta" qo'shilgach 6 ustun; kimdir band olib tashlasa 5 ga qaytadi
          tabs.length >= 6 ? "grid-cols-6" : "grid-cols-5",
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label={tr(til, SHELL.nav.mobileAria)}
      >
        {tabs.map((n) => {
          const Icon = n.icon;
          // Yorliq kamida 12px — kichik shrift o'qilishi qiyin (a11y)
          const cls = "press flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[12px] font-semibold transition-all duration-300";
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
          const active = isActive(n.href, n.exact);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn(cls, active ? "btn-ink" : "text-fg-3")}>
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
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
    <Link
      href={href}
      role="menuitem"
      className="flex min-h-11 items-center gap-2.5 rounded-tile px-3 py-2.5 text-[14px] font-medium text-fg transition hover:bg-fg/6"
    >
      <Icon size={16} className="text-fg-3" /> {children}
    </Link>
  );
}
