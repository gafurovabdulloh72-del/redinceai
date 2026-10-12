"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Bell, ClipboardList, ExternalLink, Heart, Images, LayoutDashboard, LockKeyhole, LogOut, ShieldCheck, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { NOTIFICATIONS_UNREAD_EVENT } from "@/components/layout/notification-meta";
import { cn } from "@/lib/utils";

export type KabinetNavIcon = "overview" | "orders" | "notifications" | "partners" | "favorites" | "profile" | "portfolio" | "public" | "admin" | "payments" | "security";

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
  notifications: Bell,
  partners: Users,
  favorites: Heart,
  profile: UserRound,
  portfolio: Images,
  public: ExternalLink,
  admin: ShieldCheck,
  payments: Wallet,
  security: LockKeyhole,
};

/** Gorizontal qator haqiqatan aylanadimi (scroll-fade faqat shunda) */
function useOverflowing(ref: RefObject<HTMLElement | null>) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOver(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return over;
}

export function KabinetNav({ items, user }: { items: KabinetNavItem[]; user: KabinetNavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const rowOver = useOverflowing(rowRef);
  // Qo'ng'iroq e'lon qilgan jonli son (layout klient navigatsiyada qayta chizilmaydi — badge eskirmasin)
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<unknown>).detail;
      if (typeof n === "number") setLiveUnread(n);
    };
    window.addEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
    return () => window.removeEventListener(NOTIFICATIONS_UNREAD_EVENT, on);
  }, []);
  const badgeOf = (item: KabinetNavItem) => (item.icon === "notifications" && liveUnread !== null ? liveUnread : item.badge);

  const isActive = (item: KabinetNavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Mobil: faol pill ko'rinadigan joyga aylantiriladi
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const active = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    // Qator -mx-4/px-4 bilan: pill o'ng chetdan 16px gutter bilan (scroll-fade ostida emas) ko'rinishi kerak
    const left = active.offsetLeft - 16;
    if (active.offsetLeft + active.offsetWidth > row.scrollLeft + row.clientWidth - 16 || left < row.scrollLeft) {
      row.scrollTo({ left: Math.max(0, left), behavior: "auto" });
    }
  }, [pathname]);

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
        <div className="card-elevated p-2.5">
          <div className="flex items-center gap-3 px-2.5 py-3">
            <Avatar name={user.name} src={user.avatarUrl} size={46} decorative />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-fg">{user.name}</p>
              <p className="truncate text-[12px] text-fg-3">{user.roleLabel}</p>
              <p className="truncate text-[11px] text-fg-4">{user.email}</p>
            </div>
          </div>

          <div className="mx-2 my-1 h-px bg-line" />

          <nav aria-label="Kabinet bo'limlari" className="space-y-1 py-1">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              const badge = badgeOf(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-[var(--r-sm)] px-3 py-2.5 text-[14px] font-semibold transition",
                    active ? "btn-ink" : "text-fg-2 hover:bg-fg/5 hover:text-fg active:scale-[0.99]",
                  )}
                >
                  <Icon size={18} className={active ? undefined : "text-fg-3"} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums leading-none",
                        active ? "bg-ink-fg/20 text-ink-fg" : "bg-accent text-white",
                      )}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mx-2 my-1 h-px bg-line" />

          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="flex min-h-11 w-full items-center gap-3 rounded-[var(--r-sm)] px-3 py-2.5 text-left text-[14px] font-semibold text-danger-text transition hover:bg-danger-soft disabled:opacity-60"
          >
            {leaving ? <Spinner /> : <LogOut size={18} />} Chiqish
          </button>
        </div>
      </div>

      {/* ---------- Mobil / planshet: sarlavha + gorizontal pill'lar ---------- */}
      <div className="min-w-0 lg:hidden">
        <div className="card-elevated flex items-center gap-3 py-2.5 pl-3 pr-2">
          <Avatar name={user.name} src={user.avatarUrl} size={40} decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight text-fg">{user.name}</p>
            <p className="truncate text-[12px] text-fg-3">{user.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            aria-label="Chiqish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-danger-text transition hover:bg-danger-soft active:scale-95 disabled:opacity-60"
          >
            {leaving ? <Spinner /> : <LogOut size={17} />}
          </button>
        </div>

        <div ref={rowRef} className={cn("no-scrollbar -mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6", rowOver && "scroll-fade")}>
          <nav aria-label="Kabinet bo'limlari" className="flex w-max gap-2">
            {items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              const badge = badgeOf(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-semibold transition active:scale-[0.97]",
                    active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
                  )}
                >
                  <Icon size={15} className={active ? undefined : "text-fg-3"} />
                  {item.label}
                  {badge ? (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none", active ? "bg-ink-fg/20 text-ink-fg" : "bg-accent text-white")}>
                      {badge > 99 ? "99+" : badge}
                    </span>
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
