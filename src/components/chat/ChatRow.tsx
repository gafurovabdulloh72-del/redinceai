"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { haptic } from "@/components/motion/haptics";
import { cn } from "@/lib/utils";
import type { LayerAnchor } from "./DmPanels";
import { iconBtn, useLongPress } from "./MessageParts";

/** Telefonda qatorni chapga surganda ochiladigan amal */
export interface RowSwipeAction {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Fon/matn sinflari (token ranglar) */
  cls: string;
  act: () => void;
}

const SWIPE_W = 150;
const SWIPE_EVENT = "chat:row-swipe";

/**
 * Chat ro'yxatidagi bitta qator (shaxsiy suhbat / guruh / kanal / buyurtma chati) — yagona ko'rinish va imo-ishoralar:
 *  - bosish — ochadi; desktopda hover'da «⋯» (menyu `Layer` orqali portal bo'lib ochiladi — QA A5);
 *  - TELEFON: «⋯» tugmasi YO'Q (u vaqt va o'qilmaganlar nishoni ustiga tushib qolardi) — menyu qatorni BOSIB TURISH bilan
 *    ochiladi (Telegram odati), tez amallar esa chapga surish bilan (qadash · ovozsiz · arxiv);
 *  - surish holati qatorning o'zida; boshqa qator surilsa avvalgisi yopiladi.
 */
export function ChatRow({
  rowKey,
  current,
  phone,
  avatar,
  title,
  marks,
  time,
  timeIso,
  accentTime,
  preview,
  previewIcon,
  previewTone = "normal",
  unread,
  unreadMuted,
  unreadDot,
  swipe = [],
  onOpen,
  onMenu,
  menuOpen = false,
  menuLabel,
  dataConv,
  newLabel,
}: {
  rowKey: string;
  current: boolean;
  phone: boolean;
  avatar: ReactNode;
  title: string;
  /** Nom yonidagi kichik belgilar (rasmiy, ovozsiz, qadalgan…) */
  marks?: ReactNode;
  time?: string;
  timeIso?: string;
  accentTime?: boolean;
  preview: ReactNode;
  previewIcon?: ReactNode;
  previewTone?: "normal" | "strong" | "typing";
  unread: number;
  unreadMuted?: boolean;
  /** «O'qilmagan deb belgilangan» — sonsiz nuqta */
  unreadDot?: boolean;
  swipe?: RowSwipeAction[];
  onOpen: () => void;
  /** Menyu so'raldi: langar — «⋯» tugmasi (desktop) yoki bosib turilgan nuqta (telefon) */
  onMenu?: (anchor: LayerAnchor) => void;
  menuOpen?: boolean;
  menuLabel?: string;
  dataConv?: string;
  newLabel: string;
}) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const touch = useRef<{ x: number; y: number; base: number; axis: "" | "x" | "y" } | null>(null);
  /** Bosib turishdan keyingi «bosish» (barmoq ko'tarilishi) qatorni ochib yubormasin */
  const suppressClick = useRef(false);
  const press = useLongPress(480);
  const canSwipe = phone && swipe.length > 0;

  // Boshqa qator surilsa — bu yopiladi
  useEffect(() => {
    if (!canSwipe) return;
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== rowKey) {
        setOpen(false);
        setDx(0);
      }
    };
    window.addEventListener(SWIPE_EVENT, on);
    return () => window.removeEventListener(SWIPE_EVENT, on);
  }, [canSwipe, rowKey]);

  const close = () => {
    setOpen(false);
    setDx(0);
  };
  const swipeHandlers = canSwipe
    ? {
        onTouchStart: (e: React.TouchEvent) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY, base: open ? -SWIPE_W : 0, axis: "" };
        },
        onTouchMove: (e: React.TouchEvent) => {
          const st = touch.current;
          if (!st) return;
          const t = e.touches[0];
          const mx = t.clientX - st.x;
          const my = t.clientY - st.y;
          if (!st.axis) {
            if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
            st.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
            if (st.axis === "x") {
              setDragging(true);
              window.dispatchEvent(new CustomEvent(SWIPE_EVENT, { detail: rowKey }));
            }
          }
          if (st.axis !== "x") return;
          setDx(Math.max(-SWIPE_W, Math.min(0, st.base + mx)));
        },
        onTouchEnd: () => {
          const st = touch.current;
          touch.current = null;
          setDragging(false);
          if (!st || st.axis !== "x") return;
          suppressClick.current = true;
          window.setTimeout(() => (suppressClick.current = false), 350);
          setDx((cur) => {
            const willOpen = cur < -SWIPE_W / 2.4;
            if (willOpen) haptic("light");
            setOpen(willOpen);
            return willOpen ? -SWIPE_W : 0;
          });
        },
        onTouchCancel: () => {
          touch.current = null;
          setDragging(false);
          setDx(open ? -SWIPE_W : 0);
        },
      }
    : {};

  const shown = dx !== 0 || open;
  return (
    <li className={cn("group/row relative", shown && "overflow-hidden")} {...swipeHandlers}>
      {/* Surilganda ochiladigan amallar (orqada turadi) */}
      {canSwipe && shown && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE_W }} aria-hidden={!open}>
          {swipe.map((a) => (
            <button
              key={a.key}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                close();
                a.act();
              }}
              className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-semibold", a.cls)}
            >
              <a.icon size={18} />
              <span className="max-w-full truncate px-0.5">{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className={cn("relative bg-bg", !dragging && "transition-transform duration-200")} style={shown ? { transform: `translateX(${dx}px)` } : undefined}>
        <button
          type="button"
          data-conv={dataConv}
          {...(phone && onMenu
            ? press((pt) => {
                suppressClick.current = true;
                window.setTimeout(() => (suppressClick.current = false), 900);
                onMenu(pt);
              })
            : {})}
          onContextMenu={(e) => {
            if (!onMenu) return;
            e.preventDefault();
            onMenu({ x: e.clientX, y: e.clientY });
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            if (open) return close();
            onOpen();
          }}
          aria-current={current ? "true" : undefined}
          className={cn(
            "press flex w-full select-none items-center gap-3 border-l-2 py-2.5 pl-3 text-left transition hover:bg-fg/4 focus-visible:bg-fg/4 focus-visible:outline-none max-lg:gap-3.5 max-lg:rounded-[var(--r-md)] max-lg:border-l-0 max-lg:px-2 max-lg:py-3",
            // Desktop: o'ngda «⋯» uchun joy (hover'da chiqadi) — menyusiz qatorda ham, vaqt/nishon bir chiziqda tursin;
            // telefonda tugma yo'q — vaqt/nishon chetgacha
            "lg:pr-11",
            current ? "border-fg bg-surface-2" : "border-transparent",
          )}
        >
          <span className="relative shrink-0">{avatar}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn("flex min-w-0 items-center gap-1 text-[13.5px] text-fg max-lg:text-[16px]", unread > 0 || unreadDot ? "font-bold" : "font-semibold")}>
                <span className="truncate" data-no-auto>
                  {title}
                </span>
                {marks}
              </span>
              {time && (
                <time className={cn("shrink-0 text-[11px] tabular-nums max-lg:text-[12px]", accentTime ? "font-semibold text-accent-text" : "text-fg-4")} dateTime={timeIso}>
                  {time}
                </time>
              )}
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-2">
              <span className={cn("flex min-w-0 items-center gap-1 text-[12.5px] max-lg:text-[14.5px]", previewTone === "typing" ? "italic text-fg-2" : previewTone === "strong" ? "font-semibold text-fg" : "text-fg-3")}>
                {previewIcon}
                <span className="truncate" data-no-auto>
                  {preview}
                </span>
              </span>
              {unread > 0 ? (
                <span className={cn("flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none", unreadMuted ? "bg-fg/15 text-fg" : "bg-accent text-white")} aria-label={`${unread} ${newLabel}`}>
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : unreadDot ? (
                <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-accent" aria-label={newLabel} />
              ) : null}
            </span>
          </span>
        </button>
        {/* «⋯» — faqat sichqonchali qurilmada (hover); menyu portal orqali ochiladi */}
        {onMenu && (
          <button
            type="button"
            onClick={(e) => onMenu(e.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={menuLabel}
            className={cn(iconBtn, "absolute right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 lg:flex [@media(hover:none)]:!hidden", menuOpen && "opacity-100")}
          >
            <MoreHorizontal size={16} />
          </button>
        )}
      </div>
    </li>
  );
}
