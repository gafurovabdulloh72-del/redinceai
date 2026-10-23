"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { LayoutGrid, MessageCircle, Bell, Bookmark, Clock, History, ListVideo, BookmarkCheck, ClipboardList, CreditCard, ExternalLink, FileChartColumn, GraduationCap, Heart, Images, LayoutDashboard, LockKeyhole, LogOut, Megaphone, Send, ShieldCheck, UserRound, Users, UsersRound, Wallet, type LucideIcon, Briefcase, FileUser, SendHorizontal, MoreHorizontal, ChevronRight, Globe, Palette } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Sheet } from "@/components/ui/Sheet";
import { NOTIFICATIONS_UNREAD_EVENT } from "@/components/layout/notification-meta";
import { cn } from "@/lib/utils";

export type KabinetNavIcon =
  | "overview"
  | "posts"
  | "saved"
  | "follows"
  | "orders"
  | "chat"
  | "notifications"
  | "partners"
  | "favorites"
  | "vacancies"
  | "applications"
  | "resume"
  | "profile"
  | "portfolio"
  | "public"
  | "admin"
  | "payments"
  | "security"
  | "jobs"
  | "searches"
  | "proposals"
  | "subscription"
  | "mentorship"
  | "report"
  | "history"
  | "later"
  | "collections";

/** Holat nuqtasi (masalan, obuna): faol — yashil, tugayapti — sariq, tugagan — qizil */
export type KabinetNavDot = "success" | "warning" | "danger";

export interface KabinetNavItem {
  href: string;
  label: string;
  icon: KabinetNavIcon;
  /** Faqat aynan shu yo'l aktiv hisoblanadi (/kabinet uchun) */
  exact?: boolean;
  /** Kichik hisoblagich (masalan, yangi buyurtmalar soni) */
  badge?: number;
  /** Holat nuqtasi + uning matni (ekran o'quvchi uchun; rang yolg'iz ma'no tashimasin) */
  dot?: KabinetNavDot;
  dotLabel?: string;
  /** Bo'lim sarlavhasi (chunking); guruhsiz = birlamchi (telefonda pill, desktopda tepa blok) */
  group?: string;
}

const DOT_CLASS: Record<KabinetNavDot, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

function StatusDot({ dot, label, active }: { dot: KabinetNavDot; label?: string; active: boolean }) {
  return (
    // relative: sr-only (absolute) matn aylanadigan pill qatori ichida qolsin — aks holda 390px sahifani kengaytiradi
    <span className="relative inline-flex shrink-0 items-center" title={label}>
      <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", DOT_CLASS[dot], active && "ring-2 ring-ink-fg/40")} />
      {label && <span className="sr-only">{` — ${label}`}</span>}
    </span>
  );
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
  chat: MessageCircle,
  notifications: Bell,
  partners: Users,
  favorites: Heart,
  profile: UserRound,
  portfolio: Images,
  public: ExternalLink,
  admin: ShieldCheck,
  payments: Wallet,
  security: LockKeyhole,
  jobs: Megaphone,
  searches: BookmarkCheck,
  proposals: Send,
  subscription: CreditCard,
  mentorship: GraduationCap,
  report: FileChartColumn,
  vacancies: Briefcase,
  applications: SendHorizontal,
  resume: FileUser,
  posts: LayoutGrid,
  saved: Bookmark,
  follows: UsersRound,
  history: History,
  later: Clock,
  collections: ListVideo,
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

export function KabinetNav({ items, user, meter }: { items: KabinetNavItem[]; user: KabinetNavUser; /** Telefon menyusida profil kartasi ostida ko'rinadigan progress kartasi (server komponent) */ meter?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const rowOver = useOverflowing(rowRef);

  // Guruhlash (chunking): birlamchi (guruhsiz) bandlar + mazmuniy bo'limlar — tartib saqlanadi
  const primary = items.filter((i) => !i.group);
  const groups: { name: string; items: KabinetNavItem[] }[] = [];
  for (const it of items) {
    if (!it.group) continue;
    let g = groups.find((x) => x.name === it.group);
    if (!g) {
      g = { name: it.group, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
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

  // «Ko'proq» ustida ko'rsatkich: yashirilgan (guruhli) bandlardan birortasida hisoblagich/nuqta bo'lsa
  const moreBadge = items.some((i) => i.group && (i.badge || i.dot));
  // Faol sahifa guruhli bo'lsa — telefonda uni ham pill qilib ko'rsatamiz (joriy joy ko'rinib tursin)
  const activeGrouped = items.find((i) => i.group && isActive(i)) ?? null;

  /*
   * Telefon «Menyu» (Profil tabi): iOS sozlamalaridek aniq ro'yxat — profil kartasi, bo'limlar (guruhlangan),
   * sozlamalar (til, ko'rinish), chiqish. Gorizontal siljiydigan tugmalar o'rniga: hammasi ko'rinib turadi.
   */
  const menuRow = (item: KabinetNavItem) => {
    const Icon = ICONS[item.icon];
    const badge = badgeOf(item);
    return (
      <Link key={`${item.href}:${item.group ?? ""}`} href={item.href} className="press flex min-h-14 items-center gap-3.5 px-4 py-2 transition active:bg-fg/6">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-fg/6 text-fg-2">
          <Icon size={19} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium text-fg">{item.label}</span>
        {item.dot && <StatusDot dot={item.dot} label={item.dotLabel} active={false} />}
        {badge ? <span className="rounded-full bg-accent-strong px-2 py-0.5 text-[12px] font-bold tabular-nums leading-none text-white">{badge > 99 ? "99+" : badge}</span> : null}
        <ChevronRight size={18} className="shrink-0 text-fg-4" aria-hidden="true" />
      </Link>
    );
  };
  const publicItem = items.find((i) => i.icon === "public");
  const mobileMenu = (
    <div className="mb-5 min-w-0 space-y-5 md:hidden">
      <div className="card flex items-center gap-4 p-4">
        <Avatar name={user.name} src={user.avatarUrl} size={60} decorative />
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[18px] font-semibold leading-tight text-fg">{user.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-fg-3">{user.roleLabel}</p>
          <p className="truncate text-[12.5px] text-fg-4">{user.email}</p>
        </div>
      </div>
      {meter}
      {publicItem && (
        <Link href={publicItem.href} className="press btn-ink flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold">
          <ExternalLink size={17} aria-hidden="true" /> Ommaviy profilimni ko'rish
        </Link>
      )}
      <section aria-label="Asosiy bo'limlar">
        <div className="card divide-y divide-line overflow-hidden !p-0">{primary.map((item) => menuRow(item))}</div>
      </section>
      {groups.map((g) => (
        <section key={g.name} aria-label={g.name}>
          <h2 className="px-1 pb-2 font-sans text-[12.5px] font-semibold uppercase tracking-[0.06em] text-fg-3">{g.name}</h2>
          <div className="card divide-y divide-line overflow-hidden !p-0">{g.items.filter((i) => i.icon !== "public").map((item) => menuRow(item))}</div>
        </section>
      ))}
      <section aria-label="Sozlamalar">
        <h2 className="px-1 pb-2 font-sans text-[12.5px] font-semibold uppercase tracking-[0.06em] text-fg-3">Sozlamalar</h2>
        <div className="card divide-y divide-line overflow-hidden !p-0">
          <div className="flex min-h-14 items-center gap-3.5 px-4 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-fg/6 text-fg-2">
              <Globe size={19} />
            </span>
            <span className="flex-1 text-[15.5px] font-medium text-fg">Til</span>
            <LocaleSwitch />
          </div>
          <div className="flex min-h-14 items-center gap-3.5 px-4 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-fg/6 text-fg-2">
              <Palette size={19} />
            </span>
            <span className="flex-1 text-[15.5px] font-medium text-fg">Ko'rinish</span>
            <ThemeToggle />
          </div>
        </div>
      </section>
      <button type="button" onClick={() => void logout()} disabled={leaving} className="press card flex min-h-14 w-full items-center justify-center gap-2 text-[15.5px] font-semibold text-danger-text disabled:opacity-60">
        {leaving ? <Spinner /> : <LogOut size={18} />} Chiqish
      </button>
    </div>
  );

  // Umumiy vertikal qator (desktop ro'yxat + telefon varaqda bir xil)
  const renderRow = (item: KabinetNavItem, onNavigate?: () => void) => {
    const Icon = ICONS[item.icon];
    const active = isActive(item);
    const badge = badgeOf(item);
    return (
      <Link
        key={`${item.href}:${item.group ?? ""}`}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition",
          active ? "bg-fg/[0.06] font-semibold text-fg" : "font-medium text-fg-2 hover:bg-fg/5 hover:text-fg",
        )}
      >
        <Icon size={17} strokeWidth={1.75} className={active ? undefined : "text-fg-3"} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.dot && <StatusDot dot={item.dot} label={item.dotLabel} active={active} />}
        {badge ? (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums leading-none", active ? "bg-ink-fg/20 text-ink-fg" : "bg-accent-strong text-white")}>
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

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
      {/* max-h + ichki skroll: 20 ta band past ekranda (768px) kesilib, «Chiqish» yetib bo'lmay qolmasin */}
      <div className="hidden lg:sticky lg:top-28 lg:block">
        <div className="no-scrollbar max-h-[calc(100vh-8rem)] overflow-y-auto">
          <nav aria-label="Kabinet bo'limlari" className="py-1">
            <div className="space-y-0.5">{primary.map((item) => renderRow(item))}</div>
            {groups.map((g) => (
              <div key={g.name} className="mt-4">
                <p className="px-3 pb-1 pt-1 text-[12px] font-medium text-fg-4">{g.name}</p>
                <div className="space-y-0.5">{g.items.map((item) => renderRow(item))}</div>
              </div>
            ))}
          </nav>

          <div className="mx-2 my-2 h-px bg-line" />

          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] font-medium text-danger-text transition hover:bg-danger-soft disabled:opacity-60"
          >
            {leaving ? <Spinner /> : <LogOut size={18} />} Chiqish
          </button>
        </div>
      </div>

      {/* ---------- Telefon: faqat /kabinet/menyu sahifasida to'liq ro'yxat ---------- */}
      {pathname === "/kabinet/menyu" && mobileMenu}

      {/* ---------- Planshet (md–lg): sarlavha + gorizontal pill'lar. Telefonda bu yerda hech narsa yo'q — navigatsiya pastki tab + Menyu ---------- */}
      <div className="hidden min-w-0 md:block lg:hidden">
        <div className="card flex items-center gap-3 py-2.5 pl-3 pr-2">
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

        {/* Faqat kundalik 4 pill (+ joriy guruhli sahifa) — qolgani «Ko'proq» varaqda. Hick qonuni: kam tanlov = tez qaror */}
        <div ref={rowRef} className={cn("no-scrollbar -mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6", rowOver && "scroll-fade")}>
          <nav aria-label="Kabinet bo'limlari" className="flex w-max items-center gap-2">
            {[...primary, ...(activeGrouped ? [activeGrouped] : [])].map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              const badge = badgeOf(item);
              return (
                <Link
                  key={`${item.href}:${item.group ?? ""}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-semibold transition active:scale-[0.97]",
                    active ? "btn-ink border-transparent" : "border-line bg-surface text-fg-2 hover:border-line-2 hover:text-fg",
                  )}
                >
                  <Icon size={15} className={active ? undefined : "text-fg-3"} />
                  {item.label}
                  {item.dot && <StatusDot dot={item.dot} label={item.dotLabel} active={active} />}
                  {badge ? (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-none", active ? "bg-ink-fg/20 text-ink-fg" : "bg-accent-strong text-white")}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[13.5px] font-semibold text-fg-2 transition hover:border-line-2 hover:text-fg active:scale-[0.97]"
            >
              <MoreHorizontal size={16} className="text-fg-3" />
              Ko'proq
              {moreBadge && <span aria-hidden className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-accent-strong" />}
            </button>
          </nav>
        </div>
      </div>

      {/* ---------- Telefon: «Ko'proq» — barcha bo'limlar (guruhlangan) pastki varaqda ---------- */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Barcha bo'limlar" desktop="sheet" size="sm">
        <div className="space-y-4">
          <div className="space-y-1">{primary.map((item) => renderRow(item, () => setMoreOpen(false)))}</div>
          {groups.map((g) => (
            <div key={g.name}>
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-4">{g.name}</p>
              <div className="space-y-1">{g.items.map((item) => renderRow(item, () => setMoreOpen(false)))}</div>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
