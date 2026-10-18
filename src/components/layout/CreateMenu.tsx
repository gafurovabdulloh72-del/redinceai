"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Briefcase, Megaphone, PenSquare, UsersRound, X, type LucideIcon } from "lucide-react";
import { usePresence } from "@/components/motion/usePresence";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { SHELL } from "@/lib/i18n/dict/shell";
import { cn } from "@/lib/utils";

export interface CreateMenuUser {
  id: string;
  role: "client" | "specialist" | "admin";
  specialistSlug?: string | null;
}

/**
 * "Yaratish" menyusi (ijtimoiy tarmoq qobig'i): post, guruh/kanal, vakansiya, e'lon.
 * Desktop — markazdagi oyna, telefon — pastki varaq; portal (body) orqali, chiqish animatsiyasi bilan.
 * Mehmon — kirish sahifasiga (next bilan); post faqat ijodkor profili borlarga (boshqalarga profil yaratish).
 */
export function CreateMenu({ open, onClose, user }: { open: boolean; onClose: () => void; user: CreateMenuUser | null }) {
  const til = useLocale();
  const { mounted, closing } = usePresence(open, 200);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted || !ready) return null;

  const login = (next: string) => `/auth/kirish?next=${encodeURIComponent(next)}`;
  const canPost = Boolean(user && (user.specialistSlug || user.role === "specialist" || user.role === "admin"));
  const items: Array<{ href: string; icon: LucideIcon; label: string; hint: string; accent?: boolean }> = [
    {
      href: !user ? login("/kabinet/postlar") : canPost ? "/kabinet/postlar" : "/kabinet/profil",
      icon: PenSquare,
      label: tr(til, SHELL.create.post),
      hint: canPost || !user ? tr(til, SHELL.create.postHint) : tr(til, SHELL.create.postNeedsProfile),
      accent: true,
    },
    { href: user ? "/jamoalar/yangi" : login("/jamoalar/yangi"), icon: UsersRound, label: tr(til, SHELL.create.group), hint: tr(til, SHELL.create.groupHint) },
    { href: user ? "/vakansiyalar/yangi" : login("/vakansiyalar/yangi"), icon: Briefcase, label: tr(til, SHELL.create.vacancy), hint: tr(til, SHELL.create.vacancyHint) },
    { href: user ? "/ishlar/yangi" : login("/ishlar/yangi"), icon: Megaphone, label: tr(til, SHELL.create.job), hint: tr(til, SHELL.create.jobHint) },
  ];

  return createPortal(
    <div className={cn("fixed inset-0 z-[125] flex items-end justify-center bg-ink/55 backdrop-blur-sm sm:items-center sm:p-6", closing ? "animate-fade-out" : "animate-fade-in")} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tr(til, SHELL.nav.create)}
        onClick={(e) => e.stopPropagation()}
        className={cn("card-elevated w-full max-w-md !rounded-b-none p-5 sm:!rounded-[24px]", closing ? "animate-sheet-down sm:animate-modal-out" : "animate-sheet-up sm:animate-modal-in")}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="sheet-handle mb-3 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-semibold text-fg">{tr(til, SHELL.nav.create)}</h2>
          <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-10 w-10 items-center justify-center rounded-full text-fg-3 transition hover:bg-fg/6 hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <ul className="mt-3 grid gap-1.5">
          {items.map((it) => (
            <li key={it.href + it.label}>
              <Link href={it.href} onClick={onClose} className="press flex items-center gap-3.5 rounded-[16px] px-3 py-3 transition hover:bg-fg/5">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]", it.accent ? "bg-accent text-white" : "bg-fg/6 text-fg-2")}>
                  <it.icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-semibold text-fg">{it.label}</span>
                  <span className="block text-[12.5px] leading-snug text-fg-3">{it.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
