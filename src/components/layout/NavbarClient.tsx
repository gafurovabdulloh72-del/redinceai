"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Compass, Home, LayoutDashboard, LogOut, Map, Settings, ShieldCheck, Users, UserRound } from "lucide-react";
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
  { href: "/", label: "Bosh sahifa", icon: Home, exact: true },
  { href: "/xarita", label: "Xarita", icon: Map },
  { href: "/mutaxassislar", label: "Mutaxassislar", icon: Users },
];

export function NavbarClient({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
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
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* ---------- Yuqori suzuvchi kapsula ---------- */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-6 sm:pt-4">
        <nav
          className={cn(
            "glass-strong flex w-full max-w-6xl items-center justify-between gap-3 !rounded-full py-2 pl-3 pr-2 transition-all duration-500 sm:pl-4",
            scrolled ? "shadow-[0_18px_50px_-18px_var(--glass-shadow-strong)]" : "",
          )}
          aria-label="Asosiy navigatsiya"
        >
          <Logo />

          {/* Markaziy segment (desktop) */}
          <div className="segment hidden md:inline-flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="segment-item" data-active={isActive(n.href, n.exact)}>
                {n.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:flex" />
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="glass glass-pill glass-hover flex h-10 items-center gap-2 pl-1 pr-3"
                  aria-haspopup="menu"
                  aria-expanded={open}
                >
                  <Avatar name={user.name} src={user.avatarUrl} size={32} />
                  <span className="hidden max-w-[120px] truncate text-[14px] font-semibold text-fg sm:block">{user.name.split(" ")[0]}</span>
                </button>

                {open && (
                  <div
                    role="menu"
                    className="glass-strong absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right overflow-hidden !rounded-[22px] p-1.5 animate-fade-up"
                    style={{ animationDuration: "0.25s" }}
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
                      <p className="text-xs text-fg-3">
                        {user.role === "admin" ? "Administrator" : user.role === "specialist" ? "Mutaxassis" : "Mijoz"}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-hairline" />
                    <MenuItem href="/kabinet" icon={LayoutDashboard}>Kabinet</MenuItem>
                    {user.role === "specialist" && user.specialistSlug && (
                      <MenuItem href={`/mutaxassislar/${user.specialistSlug}`} icon={UserRound}>Mening profilim</MenuItem>
                    )}
                    <MenuItem href="/kabinet/profil" icon={Settings}>Sozlamalar</MenuItem>
                    {user.role === "admin" && <MenuItem href="/admin" icon={ShieldCheck}>Admin panel</MenuItem>}
                    <div className="my-1 h-px bg-hairline" />
                    <button
                      type="button"
                      onClick={logout}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-left text-[14px] font-medium text-ios-red transition hover:bg-ios-red/10"
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
                <Link href="/auth/royxat" className="glass-tint inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold">
                  Boshlash
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Pastki suzuvchi tab-bar (mobil) ---------- */}
      <nav
        className="glass-strong fixed inset-x-3 bottom-3 z-50 flex items-center justify-around !rounded-full px-2 py-1.5 md:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
        aria-label="Mobil navigatsiya"
      >
        {[...NAV, { href: user ? "/kabinet" : "/auth/kirish", label: user ? "Kabinet" : "Kirish", icon: user ? Compass : UserRound, exact: false }].map((n) => {
          const active = isActive(n.href, n.exact);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex min-w-[64px] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition",
                active ? "glass-tint" : "text-fg-3",
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
      className="flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[14px] font-medium text-fg transition hover:bg-fg/6"
    >
      <Icon size={16} className="text-fg-3" /> {children}
    </Link>
  );
}
