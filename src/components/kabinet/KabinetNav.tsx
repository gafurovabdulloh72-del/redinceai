"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList, ExternalLink, Images, LayoutDashboard, LogOut, ShieldCheck, UserRound, type LucideIcon, Wallet, LockKeyhole } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

export type KabinetNavIcon = "overview" | "orders" | "profile" | "portfolio" | "public" | "admin" | "payments" | "security";

export interface KabinetNavItem {
  href: string;
  label: string;
  icon: KabinetNavIcon;
  /** Faqat aynan shu yo'l aktiv hisoblanadi (/kabinet uchun) */
  exact?: boolean;
  /** Kichik hisoblagich (masalan, yangi buyurtmalar soni) */
  badge?: number;
}

export interface KabinetNavUser {
  name: string;
  avatarUrl: string | null;
  roleLabel: string;
  email: string;
}

const ICONS: Record<KabinetNavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  orders: ClipboardList,
  profile: UserRound,
  portfolio: Images,
  public: ExternalLink,
  admin: ShieldCheck,
  payments: Wallet,
  security: LockKeyhole,
};

export function KabinetNav({ items, user }: { items: KabinetNavItem[]; user: KabinetNavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const isActive = (item: KabinetNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const logout = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <>
      {/* ---------- Desktop: yopishqoq yon panel ---------- */}
      <div className="hidden lg:sticky lg:top-28 lg:block">
        <div className="glass-strong p-2.5">
          <div className="flex items-center gap-3 px-2.5 py-3">
            <Avatar name={user.name} src={user.avatarUrl} size={46} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
              <p className="truncate text-[12px] text-fg-3">{user.roleLabel}</p>
              <p className="truncate text-[11px] text-fg-4">{user.email}</p>
            </div>
          </div>

          <div className="mx-2 my-1 h-px bg-hairline" />

          <nav aria-label="Kabinet bo'limlari" className="space-y-1 py-1">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[14px] font-semibold transition",
                    active ? "glass-tint" : "text-fg-2 hover:bg-fg/5 hover:text-fg active:scale-[0.99]",
                  )}
                >
                  <Icon size={18} className={active ? undefined : "text-fg-3"} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums leading-none",
                        active ? "bg-white/25 text-white" : "bg-tint-soft text-tint",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mx-2 my-1 h-px bg-hairline" />

          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left text-[14px] font-semibold text-ios-red transition hover:bg-ios-red/10 disabled:opacity-60"
          >
            {leaving ? <Spinner /> : <LogOut size={18} />} Chiqish
          </button>
        </div>
      </div>

      {/* ---------- Mobil / planshet: sarlavha + gorizontal pill'lar ---------- */}
      <div className="lg:hidden">
        <div className="glass-strong flex items-center gap-3 !rounded-[22px] py-2.5 pl-3 pr-2">
          <Avatar name={user.name} src={user.avatarUrl} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-fg">{user.name}</p>
            <p className="truncate text-[12px] text-fg-3">{user.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            aria-label="Chiqish"
            className="glass glass-pill flex h-9 w-9 shrink-0 items-center justify-center text-ios-red transition active:scale-95 disabled:opacity-60"
          >
            {leaving ? <Spinner /> : <LogOut size={16} />}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <nav aria-label="Kabinet bo'limlari" className="segment">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="segment-item inline-flex items-center gap-1.5"
                  data-active={active}
                >
                  <Icon size={14} className={active ? "text-tint" : "text-fg-3"} />
                  {item.label}
                  {item.badge ? (
                    <span className="rounded-full bg-tint-soft px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-tint">{item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
