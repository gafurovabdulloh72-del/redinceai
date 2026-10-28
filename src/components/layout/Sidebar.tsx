"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bookmark, Briefcase, BriefcaseBusiness, Clapperboard, Compass, CreditCard, GraduationCap, HelpCircle, Home, Info, LayoutDashboard, LogOut, Map, Menu, MessageCircle, PlusSquare, Search, UserRound, Users, UsersRound, type LucideIcon, Crown } from "lucide-react";
import { Avatar } from "@/components/ui";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { tr, type Tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS_UNREAD_EVENT } from "./notification-meta";
import { AppearancePanel } from "./Appearance";
import { CreateMenu } from "./CreateMenu";
import { Logo } from "./Logo";
import { routeActive } from "./nav-utils";
import type { NavUser } from "./NavbarClient";

interface Item {
  href: string;
  label: Tr;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  dot?: boolean;
  authOnly?: boolean;
  /** Ajratib ko'rsatiladigan band (to'q to'ldirilgan, «Yaratish» kabi) */
  emphasis?: boolean;
}

/**
 * Chap yon panel (ijtimoiy tarmoq qobig'i, md+): md'da faqat ikonkalar (76px, tooltip o'ngda), xl'da yorliqlar bilan (244px).
 * Asosiy: Bosh sahifa, Qidiruv, Lenta, Jamoalar, Xabarlar, Bildirishnomalar, Yaratish; ikkilamchi: Ijodkorlar, Xarita, Vakansiyalar, Ishlar.
 * Pastda: profil va «Yana» menyusi (kabinet, saqlanganlar, narxlar, yordam, haqida, til, ko'rinish paneli, chiqish).
 * Telefonda NavbarClient (yuqori panel + tab-bar) ishlaydi. `c` qisqartmasi (open-create) md+ da shu yerda qabul qilinadi.
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
  // Klaviatura qisqartmasi `c` — faqat yon panel ko'rinadigan kenglikda (telefonda NavbarClient ochadi)
  useEffect(() => {
    const on = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setCreateOpen(true);
    };
    window.addEventListener("open-create", on);
    return () => window.removeEventListener("open-create", on);
  }, []);

  // Jonli o'qilmagan son: bildirishnoma o'qilishi bilan badge darhol o'chadi (qo'ng'iroq/sahifa UNREAD hodisasini e'lon qiladi)
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<unknown>).detail;
      if (typeof n === "number") setLiveUnread(n);
    };
    window.addEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
    return () => window.removeEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
  }, []);
  const notifUnread = liveUnread ?? unread;

  const login = (next: string) => `/auth/kirish?next=${encodeURIComponent(next)}`;

  const primary: Item[] = [
    { href: "/", label: SHELL.nav.home, icon: Home, exact: true },
    { href: "/qidiruv", label: SHELL.nav.search, icon: Search },
    { href: "/lenta", label: SHELL.nav.lenta, icon: Clapperboard },
    { href: "/jamoalar", label: SHELL.nav.groups, icon: UsersRound, dot: groupsUnread > 0 },
    { href: "/kabinet/chat", label: SHELL.nav.messages, icon: MessageCircle, badge: dmUnread, authOnly: true },
    { href: "/kabinet/bildirishnomalar", label: SHELL.menu.notifications, icon: Bell, badge: notifUnread, authOnly: true },
  ];
  // Ikkilamchi bandlar; TOP reyting «Yana» menyusida (panel tinch qolsin).
  // Xarita — Mutaxassislardan OLDIN: hudud bo'yicha ijodkor izlash katalogga kirishdan oldingi qadam.
  const secondary: Item[] = [
    { href: "/mentorlik", label: SHELL.nav.mentorship, icon: GraduationCap, emphasis: true },
    { href: "/xarita", label: SHELL.nav.map, icon: Map },
    { href: "/mutaxassislar", label: SHELL.nav.specialists, icon: Users },
    { href: "/vakansiyalar", label: SHELL.nav.vacancies, icon: Briefcase },
    { href: "/ishlar", label: SHELL.nav.jobs, icon: BriefcaseBusiness },
  ];
  // Profil (/kabinet) faqat boshqa band faol bo'lmaganda faol — /kabinet/chat'da ikkita aria-current bo'lmasin
  const profileHref = user?.specialistSlug ? `/mutaxassislar/${user.specialistSlug}` : "/kabinet";
  const anyPrimaryActive = [...primary, ...secondary].some((it) => routeActive(pathname, it.href, it.exact));
  const profileActive = !anyPrimaryActive && routeActive(pathname, profileHref);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const row = "group/side relative flex h-10 shrink-0 cozy:h-9 short:h-9 items-center gap-3.5 rounded-lg px-3 text-[14.5px] text-fg-2 transition-colors duration-150 hover:bg-fg/[0.05] hover:text-fg md:justify-center xl:justify-start";
  const label = "hidden truncate xl:block";

  const renderItem = (it: Item) => {
    const active = routeActive(pathname, it.href, it.exact);
    const href = it.authOnly && !user ? login(it.href) : it.href;
    return (
      <li key={it.href}>
        <Link href={href} aria-current={active ? "page" : undefined} data-tip={tr(til, it.label)} data-tip-pos="right" className={cn(row, it.emphasis ? cn("btn-ink !bg-ink !text-ink-fg hover:!bg-ink hover:!text-ink-fg hover:![filter:none] justify-center font-semibold xl:!justify-center", active && "ring-2 ring-fg/25 ring-offset-2 ring-offset-bg") : active && "bg-fg/[0.06] font-semibold text-fg")}>
          <span className="relative shrink-0">
            <it.icon size={20} strokeWidth={active ? 2.2 : 1.75} />
            {it.badge ? (
              <span key={it.badge} className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] animate-badge-pop items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white">
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : it.dot ? (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pop rounded-full bg-accent ring-2 ring-surface" aria-hidden />
            ) : null}
          </span>
          <span className={label}>{tr(til, it.label)}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <aside className="side-rail fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-line bg-bg px-2.5 py-4 md:flex xl:w-[232px] xl:px-3" aria-label={tr(til, SHELL.nav.mainAria)} data-print-hide>
        <div className="flex h-12 items-center px-2 md:justify-center xl:justify-start">
          <Logo className="md:[&>span:last-child]:hidden xl:[&>span:last-child]:inline" />
        </div>

        <nav className="no-scrollbar mt-3 flex min-h-0 flex-1 flex-col cozy:mt-2 cozy:overflow-y-auto xl:overflow-y-auto" aria-label={tr(til, SHELL.nav.mainAria)}>
          <ul className="space-y-0.5">
            {primary.map(renderItem)}
            <li className="pt-2.5 cozy:pt-2">
              {/* Doimiy asosiy CTA (X "Post" tugmasi kabi): yaratish imkoni har doim ko'z oldida — odat sikli "amal" bosqichi */}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="btn-ink press flex h-10 items-center justify-center gap-2 rounded-lg text-[14px] font-semibold md:mx-auto md:w-10 xl:w-full"
                data-tip={tr(til, SHELL.nav.create)}
                data-tip-pos="right"
                aria-haspopup="dialog"
                aria-expanded={createOpen}
              >
                <PlusSquare size={18} strokeWidth={2} className="shrink-0" />
                <span className="hidden xl:block">{tr(til, SHELL.nav.create)}</span>
              </button>
            </li>
          </ul>
          <div className="my-2.5 h-px shrink-0 bg-line cozy:my-2" aria-hidden />
          <ul className="space-y-0.5">{secondary.map(renderItem)}</ul>
        </nav>

        <div className="mt-auto shrink-0 space-y-0.5 pt-2">
          {user ? (
            <Link href={profileHref} aria-current={profileActive ? "page" : undefined} className={cn(row, profileActive && "bg-fg/[0.06] font-semibold text-fg")} data-tip={tr(til, SHELL.nav.profile)} data-tip-pos="right">
              <Avatar name={user.name} src={user.avatarUrl} size={24} decorative />
              <span className={label}>{tr(til, SHELL.nav.profile)}</span>
            </Link>
          ) : (
            <>
              <Link href="/auth/royxat" className={cn(row, "btn-ink justify-center !text-ink-fg xl:!justify-center")} data-tip={tr(til, SHELL.nav.start)} data-tip-pos="right">
                <UserRound size={22} className="xl:hidden" />
                <span className="hidden text-[14px] font-semibold xl:block">{tr(til, SHELL.nav.start)}</span>
              </Link>
              <Link href="/auth/kirish" className={cn(row, "justify-center text-fg-2 xl:!justify-center")} data-tip={tr(til, SHELL.nav.login)} data-tip-pos="right">
                <Compass size={22} className="xl:hidden" />
                <span className="hidden text-[14px] font-semibold xl:block">{tr(til, SHELL.nav.login)}</span>
              </Link>
            </>
          )}

          <div className="relative" ref={moreRef}>
            <button type="button" onClick={() => setMoreOpen((v) => !v)} className={cn(row, "w-full")} data-tip={tr(til, SHELL.nav.more)} data-tip-pos="right" aria-haspopup="menu" aria-expanded={moreOpen}>
              <Menu size={20} strokeWidth={1.75} className="shrink-0" />
              <span className={label}>{tr(til, SHELL.nav.more)}</span>
            </button>
            {more.mounted && (
              <div
                role="menu"
                aria-label={tr(til, SHELL.nav.more)}
                style={{ ["--pop-origin" as string]: "bottom left" }}
                className={cn("card-floating absolute bottom-[calc(100%+8px)] left-0 w-72 overflow-hidden p-1.5", more.closing ? "pop-out" : "pop-in")}
              >
                {user && <MoreItem href="/kabinet" icon={LayoutDashboard} label={tr(til, SHELL.menu.cabinet)} />}
                {user && <MoreItem href="/kabinet/saqlanganlar" icon={Bookmark} label={tr(til, SHELL.menu.saved)} />}
                <MoreItem href="/top" icon={Crown} label={tr(til, SHELL.nav.top)} />
                <MoreItem href="/narxlar" icon={CreditCard} label={tr(til, SHELL.nav.prices)} />
                <MoreItem href="/yordam" icon={HelpCircle} label={tr(til, SHELL.footer.help)} />
                <MoreItem href="/haqida" icon={Info} label={tr(til, SHELL.nav.about)} />
                <div className="my-1 h-px bg-line" />
                <div className="px-3 py-2.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-3">{tr(til, SHELL.appearance.title)}</span>
                    <LocaleSwitch className="!h-8 !w-8 text-[11px]" />
                  </div>
                  <AppearancePanel />
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
    <Link href={href} role="menuitem" className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-fg transition hover:bg-fg/6">
      <Icon size={16} className="text-fg-3" /> {label}
    </Link>
  );
}
