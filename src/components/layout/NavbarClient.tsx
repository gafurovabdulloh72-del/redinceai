"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Compass, Home, LayoutDashboard, LogOut, MapPin, ShieldCheck, Users, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

export interface NavUser {
  id: string;
  name: string;
  role: "client" | "specialist" | "admin";
  avatarUrl: string | null;
  specialistSlug?: string | null;
}

const NAV = [
  { href: "/", label: "Bosh sahifa", icon: Home, exact: true, desktopOnly: false },
  { href: "/mutaxassislar", label: "Mutaxassislar", icon: Users, exact: false, desktopOnly: false },
  { href: "/#hududlar", label: "Hududlar", icon: MapPin, exact: true, desktopOnly: true },
];

const ROLE_LABEL = { admin: "Administrator", specialist: "Mutaxassis", client: "Mijoz" } as const;

export function NavbarClient({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    // Birinchi menyu bandiga fokus
    const t = window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), 20);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  /** Menyu ichida ↑/↓ bilan yurish, Home/End */
  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const isActive = (href: string, exact?: boolean) => {
    if (href.includes("#")) return false;
    return exact ? pathname === href : pathname.startsWith(href);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* ---------- Yuqori panel ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
        <nav
          className={cn(
            "nav-bar container-x flex h-16 items-center justify-between gap-3 !rounded-full pl-4 pr-2 transition-shadow duration-500 sm:pl-5",
            scrolled && "shadow-[var(--shadow-2)]",
          )}
          aria-label="Asosiy navigatsiya"
        >
          <Logo />

          <div className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = isActive(n.href, n.exact);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-[14px] font-semibold transition",
                    active ? "text-fg" : "text-fg-3 hover:text-fg",
                  )}
                >
                  {n.label}
                  {active && <span className="absolute inset-x-4 -bottom-0.5 h-[2px] rounded-full bg-accent" />}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <div className="relative" ref={menuRef} onKeyDown={onMenuKey}>
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="card card-hover flex h-10 items-center gap-2 !rounded-full pl-1 pr-1 sm:h-11 sm:pr-3"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={`${user.name} — hisob menyusi`}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size={32} decorative />
                  <span className="hidden max-w-[120px] truncate text-[14px] font-semibold text-fg sm:block">{user.name.split(" ")[0]}</span>
                </button>

                {open && (
                  <div
                    role="menu"
                    aria-label="Hisob"
                    className="card-elevated absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right overflow-hidden !rounded-[20px] p-1.5 animate-fade-up"
                    style={{ animationDuration: "0.22s" }}
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
                      <p className="text-xs text-fg-3">{ROLE_LABEL[user.role]}</p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <MenuItem href="/kabinet" icon={LayoutDashboard}>Kabinet</MenuItem>
                    {user.role === "specialist" && user.specialistSlug && (
                      <MenuItem href={`/mutaxassislar/${user.specialistSlug}`} icon={UserRound}>Ommaviy profil</MenuItem>
                    )}
                    <MenuItem href="/kabinet/profil" icon={UserRound}>Profil</MenuItem>
                    {user.role === "admin" && <MenuItem href="/admin" icon={ShieldCheck}>Admin panel</MenuItem>}
                    <div className="my-1 h-px bg-line" />
                    <button
                      type="button"
                      onClick={logout}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[14px] font-medium text-ios-red transition hover:bg-ios-red/10"
                    >
                      <LogOut size={16} /> Chiqish
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/kirish" className="hidden h-11 items-center rounded-full px-4 text-[14px] font-semibold text-fg-2 transition hover:text-fg sm:inline-flex">
                  Kirish
                </Link>
                <Link href="/auth/royxat" className="btn-ink inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold sm:h-11 sm:px-5">
                  Boshlash
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Pastki tab-bar (mobil) ---------- */}
      <nav
        className="nav-bar fixed inset-x-3 bottom-3 z-50 flex items-center justify-around !rounded-full px-2 py-1.5 shadow-[var(--shadow-2)] md:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
        aria-label="Mobil navigatsiya"
      >
        {[
          ...NAV.filter((n) => !n.desktopOnly),
          { href: user ? "/kabinet" : "/auth/kirish", label: user ? "Kabinet" : "Kirish", icon: user ? Compass : UserRound, exact: false, desktopOnly: false },
        ].map((n) => {
          const active = isActive(n.href, n.exact);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[72px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition",
                active ? "btn-ink" : "text-fg-3",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {n.label}
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
      className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-[14px] font-medium text-fg transition hover:bg-fg/6"
    >
      <Icon size={16} className="text-fg-3" /> {children}
    </Link>
  );
}
