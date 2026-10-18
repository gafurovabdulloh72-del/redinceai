"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Briefcase, BriefcaseBusiness, Clapperboard, Compass, CreditCard, HelpCircle, Home, Info, LayoutDashboard, LogOut, Map, Menu, MessageCircle, PlusSquare, Search, UserRound, Users, UsersRound, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";
import { CreateMenu } from "./CreateMenu";
import { Logo } from "./Logo";
import type { NavUser } from "./NavbarClient";
import { ThemeToggle } from "./ThemeToggle";

interface Item {
  href: string;
  label: Tr;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  dot?: boolean;
  authOnly?: boolean;
}

/**
 * Chap yon panel (ijtimoiy tarmoq qobig'i, md+): md'da faqat ikonkalar (76px), xl'da yorliqlar bilan (244px).
 * Asosiy: Bosh sahifa, Qidiruv, Lenta, Jamoalar, Xabarlar, Bildirishnomalar, Yaratish; ikkilamchi: Ijodkorlar, Xarita, Vakansiyalar, Ishlar.
 * Pastda: profil va "Yana" menyusi (kabinet, narxlar, yordam, haqida, til, tema, chiqish). Telefonda NavbarClient (yuqori panel + tab-bar) ishlaydi.
 */
export function Sidebar({ user, unread = 0, dmUnread = 0, groupsUnread = 0 }: { user: NavUser | null; unread?: number; dmUnread?: number; groupsUnread?: number }) {
  const til = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const more = usePresence(moreOpen, 180);

  useEffect(() => {
    setMoreOpen(false);
    setCreateOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const login = (next: string) => `/auth/kirish?next=${encodeURIComponent(next)}`;

  const primary: Item[] = [
    { href: "/", label: SHELL.nav.home, icon: Home, exact: true },
    { href: "/qidiruv", label: SHELL.nav.search, icon: Search },
    { href: "/lenta", label: SHELL.nav.lenta, icon: Clapperboard },
    { href: "/jamoalar", label: SHELL.nav.groups, icon: UsersRound, dot: groupsUnread > 0 },
    { href: "/kabinet/chat", label: SHELL.nav.messages, icon: MessageCircle, badge: dmUnread, authOnly: true },
    { href: "/kabinet/bildirishnomalar", label: SHELL.menu.notifications, icon: Bell, badge: unread, authOnly: true },
  ];
  const secondary: Item[] = [
    { href: "/mutaxassislar", label: SHELL.nav.specialists, icon: Users },
    { href: "/xarita", label: SHELL.nav.map, icon: Map },
    { href: "/vakansiyalar", label: SHELL.nav.vacancies, icon: Briefcase },
    { href: "/ishlar", label: SHELL.nav.jobs, icon: BriefcaseBusiness },
  ];

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const row = "group/side relative flex h-12 items-center gap-4 rounded-[14px] px-3 text-[15px] text-fg transition-colors duration-200 hover:bg-fg/5 md:justify-center xl:justify-start";
  const label = "hidden truncate xl:block";

  const renderItem = (it: Item) => {
    const active = isActive(it.href, it.exact);
    const href = it.authOnly && !user ? login(it.href) : it.href;
    return (
      <li key={it.href}>
        <Link href={href} aria-current={active ? "page" : undefined} title={tr(til, it.label)} className={cn(row, active && "font-bold")}>
          <span className="relative shrink-0">
            <it.icon size={24} strokeWidth={active ? 2.5 : 1.9} className="transition-transform duration-200 group-hover/side:scale-105" />
            {it.badge ? (
              <span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] animate-badge-pop items-center justify-center rounded-full bg-accent px-1 text-[10.5px] font-bold leading-none text-white">{it.badge > 99 ? "99+" : it.badge}</span>
            ) : it.dot ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pop rounded-full bg-accent ring-2 ring-surface" aria-hidden />
            ) : null}
          </span>
          <span className={cn(label, active ? "font-bold" : "font-medium")}>{tr(til, it.label)}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <aside
        className="side-rail fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-line bg-surface/85 px-2.5 py-4 backdrop-blur-xl md:flex xl:w-[244px] xl:px-3.5"
        aria-label={tr(til, SHELL.nav.mainAria)}
      >
        <div className="flex h-12 items-center px-2 md:justify-center xl:justify-start">
          <Logo className="md:[&>span:last-child]:hidden xl:[&>span:last-child]:inline" />
        </div>

        <nav className="mt-4 flex min-h-0 flex-1 flex-col">
          <ul className="space-y-0.5">
            {primary.map(renderItem)}
            <li>
              <button type="button" onClick={() => setCreateOpen(true)} className={cn(row, "w-full")} title={tr(til, SHELL.nav.create)} aria-haspopup="dialog" aria-expanded={createOpen}>
                <PlusSquare size={24} strokeWidth={1.9} className="shrink-0 transition-transform duration-200 group-hover/side:scale-105" />
                <span className={cn(label, "font-medium")}>{tr(til, SHELL.nav.create)}</span>
              </button>
            </li>
          </ul>
          <div className="my-3 h-px bg-line" aria-hidden />
          <ul className="space-y-0.5">{secondary.map(renderItem)}</ul>
        </nav>

        <div className="mt-auto space-y-0.5">
          {user ? (
            <Link
              href={user.specialistSlug ? `/mutaxassislar/${user.specialistSlug}` : "/kabinet"}
              className={cn(row, (user.specialistSlug ? isActive(`/mutaxassislar/${user.specialistSlug}`) : isActive("/kabinet")) && "font-bold")}
              title={tr(til, SHELL.nav.profile)}
            >
              <span className="shrink-0 rounded-full ring-2 ring-transparent transition group-hover/side:ring-line-2">
                <Avatar name={user.name} src={user.avatarUrl} size={26} decorative />
              </span>
              <span className={cn(label, "font-medium")}>{tr(til, SHELL.nav.profile)}</span>
            </Link>
          ) : (
            <>
              <Link href="/auth/royxat" className={cn(row, "btn-ink justify-center !text-ink-fg xl:!justify-center")} title={tr(til, SHELL.nav.start)}>
                <UserRound size={22} className="xl:hidden" />
                <span className="hidden text-[14px] font-semibold xl:block">{tr(til, SHELL.nav.start)}</span>
              </Link>
              <Link href="/auth/kirish" className={cn(row, "justify-center text-fg-2 xl:!justify-center")} title={tr(til, SHELL.nav.login)}>
                <Compass size={22} className="xl:hidden" />
                <span className="hidden text-[14px] font-semibold xl:block">{tr(til, SHELL.nav.login)}</span>
              </Link>
            </>
          )}

          <div className="relative" ref={moreRef}>
            <button type="button" onClick={() => setMoreOpen((v) => !v)} className={cn(row, "w-full")} title={tr(til, SHELL.nav.more)} aria-haspopup="menu" aria-expanded={moreOpen}>
              <Menu size={24} strokeWidth={1.9} className="shrink-0" />
              <span className={cn(label, "font-medium")}>{tr(til, SHELL.nav.more)}</span>
            </button>
            {more.mounted && (
              <div role="menu" aria-label={tr(til, SHELL.nav.more)} className={cn("card-floating absolute bottom-[calc(100%+8px)] left-0 w-64 overflow-hidden p-1.5", more.closing ? "animate-modal-out" : "animate-modal-in")}>
                {user && <MoreItem href="/kabinet" icon={LayoutDashboard} label={tr(til, SHELL.menu.cabinet)} />}
                <MoreItem href="/narxlar" icon={CreditCard} label={tr(til, SHELL.nav.prices)} />
                <MoreItem href="/yordam" icon={HelpCircle} label={tr(til, SHELL.footer.help)} />
                <MoreItem href="/haqida" icon={Info} label={tr(til, SHELL.nav.about)} />
                <div className="my-1 h-px bg-line" />
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <LocaleSwitch />
                  <ThemeToggle />
                </div>
                {user && (
                  <>
                    <div className="my-1 h-px bg-line" />
                    <button type="button" role="menuitem" onClick={logout} className="flex min-h-11 w-full items-center gap-2.5 rounded-tile px-3 py-2.5 text-left text-[14px] font-medium text-danger-text transition hover:bg-danger-soft">
                      <LogOut size={16} /> {tr(til, SHELL.menu.logout)}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
      <CreateMenu open={createOpen} onClose={() => setCreateOpen(false)} user={user ? { id: user.id, role: user.role, specialistSlug: user.specialistSlug } : null} />
    </>
  );
}

function MoreItem({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} role="menuitem" className="flex min-h-11 items-center gap-2.5 rounded-tile px-3 py-2.5 text-[14px] font-medium text-fg transition hover:bg-fg/6">
      <Icon size={16} className="text-fg-3" /> {label}
    </Link>
  );
}
