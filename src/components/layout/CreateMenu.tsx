"use client";

import Link from "next/link";
import { Briefcase, Megaphone, PenSquare, UsersRound, type LucideIcon } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
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
 * «Yaratish» menyusi (ijtimoiy tarmoq qobig'i): post, guruh/kanal, vakansiya, e'lon.
 * Umumiy Sheet ustida: telefon — pastki varaq (pastga surib yopiladi), desktop — markazdagi oyna; fokus tuzog'i,
 * fon scroll qulfi, Escape, fokus qaytishi — Sheet'dan. Mehmon — kirish sahifasiga (next bilan);
 * post faqat ijodkor profili borlarga (boshqalarga profil yaratish).
 */
export function CreateMenu({ open, onClose, user }: { open: boolean; onClose: () => void; user: CreateMenuUser | null }) {
  const til = useLocale();
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

  return (
    <Sheet open={open} onClose={onClose} title={tr(til, SHELL.nav.create)}>
      <ul className="grid gap-1 pb-2">
        {items.map((it) => (
          <li key={it.href + it.label}>
            <Link href={it.href} onClick={onClose} className="press flex items-center gap-3.5 rounded-card px-3 py-3 transition hover:bg-fg/5">
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-tile", it.accent ? "bg-accent text-white" : "bg-fg/6 text-fg-2")}>
                <it.icon size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold text-fg">{it.label}</span>
                <span className="block text-[12.5px] leading-snug text-fg-3">{it.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
