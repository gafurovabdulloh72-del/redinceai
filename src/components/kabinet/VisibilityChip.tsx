"use client";

import { EyeOff, Globe, Handshake, Users, type LucideIcon } from "lucide-react";
import type { VisibilityLevelValue } from "@/lib/constants";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Locale } from "@/lib/i18n";
import { KORINISH_CHIP, KORINISH_IZOH, KORINISH_QISQA } from "@/lib/i18n/dict/kabinet-forms";

export const LEVEL_ICON: Record<VisibilityLevelValue, LucideIcon> = {
  public: Globe,
  clients: Users,
  orders: Handshake,
  hidden: EyeOff,
};

/** Maydon yonidagi qisqa nom */
export const LEVEL_SHORT: Record<VisibilityLevelValue, string> = {
  public: "Hammaga",
  clients: "Ro'yxatdan o'tganlarga",
  orders: "Buyurtmachilarga",
  hidden: "Yashirin",
};

/** Maydon ostidagi izoh (til-mos varianti — `levelHint(til, level)`) */
export const LEVEL_HINT: Record<VisibilityLevelValue, string> = {
  public: "Profilda hammaga ko'rinadi.",
  clients: "Profilda faqat ro'yxatdan o'tganlarga ko'rinadi.",
  orders: "Profilda faqat buyurtmasi qabul qilingan mijozlarga ko'rinadi.",
  hidden: "Profilda ko'rinmaydi.",
};

/** Maydon ostidagi izoh — joriy tilda */
export function levelHint(til: Locale, level: VisibilityLevelValue): string {
  return tr(til, KORINISH_IZOH[level]);
}

/** Shaxsiy maydon yonidagi «kimga ko'rinadi» belgisi — bosilsa Maxfiylik bo'limiga olib boradi */
export function VisibilityChip({ level }: { level: VisibilityLevelValue }) {
  const til = useLocale();
  const Icon = LEVEL_ICON[level];
  return (
    <a
      href="#maxfiylik"
      title={tr(til, KORINISH_CHIP.title)}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-[11px] font-medium text-fg-3 transition hover:bg-fg/8 hover:text-fg"
    >
      <Icon size={11} /> {tr(til, KORINISH_QISQA[level])}
    </a>
  );
}
