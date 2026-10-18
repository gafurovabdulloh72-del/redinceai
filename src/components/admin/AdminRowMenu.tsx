"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { cn } from "@/lib/utils";

/**
 * Admin qatorlari uchun umumiy «⋯» menyusi: ikkilamchi amallar bitta tugma ostida (asosiy amal yonida klaster bo'lmasin).
 * - pop-in / pop-out (usePresence), Escape va tashqariga bosishda yopiladi, fokus birinchi bandga, strelkalar bilan yurish,
 *   yopilganda fokus tugmaga qaytadi; role="menu"/"menuitem", aria-expanded/controls.
 */
export interface AdminMenuItem {
  key: string;
  label: ReactNode;
  icon?: LucideIcon;
  /** Havola (yangi oynada ochiladi) — berilsa onSelect kerak emas */
  href?: string;
  onSelect?: () => void;
  /** Xavfli amal (o'chirish, bloklash) — qizil */
  danger?: boolean;
  /** Faol holat (masalan, «Tavsiyada») — ikonka aksent rangda */
  active?: boolean;
  title?: string;
  /** Band oldidan ajratgich chizig'i */
  divider?: boolean;
  disabled?: boolean;
}

export function AdminRowMenu({ items, label, disabled, size = "sm", className }: { items: AdminMenuItem[]; label: string; disabled?: boolean; size?: "sm" | "md"; className?: string }) {
  const [open, setOpen] = useState(false);
  const { mounted, closing } = usePresence(open, 160);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Menyu DOM'ga kirgach (usePresence keyingi renderda mount qiladi) birinchi bandga fokus
  useEffect(() => {
    if (!mounted || closing) return;
    ref.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
  }, [mounted, closing]);

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const list = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? []);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  const itemCls = (it: AdminMenuItem) =>
    cn(
      "flex min-h-10 w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium transition focus-visible:outline-none",
      it.danger ? "text-danger-text hover:bg-danger-soft focus-visible:bg-danger-soft" : "text-fg hover:bg-fg/6 focus-visible:bg-fg/6",
      it.disabled && "pointer-events-none opacity-50",
    );

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        title="Boshqa amallar"
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-line-2 text-fg-2 transition hover:border-fg hover:text-fg disabled:opacity-50", size === "md" ? "h-11 w-11" : "h-9 w-9")}
      >
        <MoreHorizontal size={16} />
      </button>
      {mounted && (
        <div id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKey} className={cn("card-floating absolute right-0 top-[calc(100%+6px)] z-20 w-60 origin-top-right whitespace-normal p-1.5 text-left", closing ? "pop-out" : "pop-in")}>
          {items.map((it) => {
            const Icon = it.icon;
            const inner = (
              <>
                {Icon && <Icon size={16} className={cn(it.danger ? undefined : it.active ? "fill-accent-3 text-accent-3" : "text-fg-3")} aria-hidden="true" />}
                <span className="min-w-0 flex-1">{it.label}</span>
              </>
            );
            return (
              <div key={it.key}>
                {it.divider && <div className="my-1 h-px bg-line" aria-hidden="true" />}
                {it.href ? (
                  <Link role="menuitem" href={it.href} target="_blank" rel="noreferrer" className={itemCls(it)} title={it.title} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled={it.disabled || undefined}
                    title={it.title}
                    className={itemCls(it)}
                    onClick={() => {
                      setOpen(false);
                      it.onSelect?.();
                    }}
                  >
                    {inner}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
