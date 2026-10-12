"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Compass, Home, LayoutDashboard, LogOut, Map, ShieldCheck, UserCog, Users, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsBell } from "./NotificationsBell";
import { setFavoritesViewer } from "@/components/specialists/favorites-store";
import { cn } from "@/lib/utils";

export interface NavUser {
  id: string;
  name: string;
  role: "client" | "specialist" | "admin";
  avatarUrl: string | null;
  specialistSlug?: string | null;
}

const NAV = [
  { href: "/", label: "Bosh sahifa", icon: Home, exact: true },
  { href: "/xarita", label: "Xarita", icon: Map },
  { href: "/mutaxassislar", label: "Mutaxassislar", icon: Users },
];

export function NavbarClient({ user, unread = 0 }: { user: NavUser | null; unread?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const tabs = [...NAV, { href: user ? "/kabinet" : "/auth/kirish", label: user ? "Kabinet" : "Kirish", icon: user ? Compass : UserRound, exact: false }];

  return (
    <>
      {/* ---------- Yuqori panel: max-w-5xl kapsula, scroll'da biroz ixchamlashadi ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <nav
          className={cn(
            "nav-bar relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 !rounded-full pl-3 pr-2 transition-[height,box-shadow] duration-300 sm:pl-4",
            scrolled ? "h-14 shadow-[var(--shadow-2)]" : "h-14 sm:h-16",
          )}
          aria-label="Asosiy navigatsiya"
        >
          <Logo />

          <div className="hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => {
              const active = isActive(n.href, n.exact);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 items-center rounded-full px-4 text-[14px] font-semibold transition",
                    active ? "text-fg" : "text-fg-3 hover:text-fg",
                  )}
                >
                  {n.label}
                  {active && <span aria-hidden className="absolute inset-x-4 bottom-1 h-[3px] rounded-full bg-accent" />}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {user && <NotificationsBell initialUnread={unread} />}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="card card-hover flex h-10 items-center gap-2 !rounded-full pl-1 pr-1.5 sm:pr-3"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={`Hisob menyusi: ${user.name}`}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size={30} decorative />
                  <span className="hidden max-w-[120px] truncate text-[14px] font-semibold text-fg sm:block">{user.name.split(" ")[0]}</span>
                </button>

                {open && (
                  <div
                    role="menu"
                    className="card-floating absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right overflow-hidden p-1.5 animate-fade-up"
                    style={{ animationDuration: "0.22s" }}
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
                      <p className="text-xs text-fg-3">
                        {user.role === "admin" ? "Administrator" : user.role === "specialist" ? "Mutaxassis" : "Mijoz"}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <MenuItem href="/kabinet" icon={LayoutDashboard}>Kabinet</MenuItem>
                    {user.role === "specialist" && user.specialistSlug && (
                      <MenuItem href={`/mutaxassislar/${user.specialistSlug}`} icon={UserRound}>Mening profilim</MenuItem>
                    )}
                    <MenuItem href="/kabinet/profil" icon={UserCog}>Profil</MenuItem>
                    {user.role === "admin" && <MenuItem href="/admin" icon={ShieldCheck}>Admin panel</MenuItem>}
                    <div className="my-1 h-px bg-line" />
                    <button
                      type="button"
                      onClick={logout}
                      role="menuitem"
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-tile px-3 py-2.5 text-left text-[14px] font-medium text-danger transition hover:bg-danger-soft"
                    >
                      <LogOut size={16} /> Chiqish
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/kirish" className="hidden h-10 items-center rounded-full px-4 text-[14px] font-semibold text-fg-2 transition hover:text-fg sm:inline-flex">
                  Kirish
                </Link>
                <Link href="/auth/royxat" className="btn-ink inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold sm:px-5">
                  Boshlash
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Pastki tab-bar (mobil): teng kenglikdagi 4 ta element, safe-area ---------- */}
      <nav
        className="nav-bar fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 items-stretch !rounded-full p-1.5 shadow-[var(--shadow-2)] md:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Mobil navigatsiya"
      >
        {tabs.map((n) => {
          const active = isActive(n.href, n.exact);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10.5px] font-semibold transition",
                active ? "btn-ink" : "text-fg-3",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
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
