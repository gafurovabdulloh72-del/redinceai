"use client";

import { EyeOff, Globe, Handshake, Users, type LucideIcon } from "lucide-react";
import type { VisibilityLevelValue } from "@/lib/constants";

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

/** Maydon ostidagi izoh */
export const LEVEL_HINT: Record<VisibilityLevelValue, string> = {
  public: "Profilda hammaga ko'rinadi.",
  clients: "Profilda faqat ro'yxatdan o'tganlarga ko'rinadi.",
  orders: "Profilda faqat buyurtmasi qabul qilingan mijozlarga ko'rinadi.",
  hidden: "Profilda ko'rinmaydi.",
};

/** Shaxsiy maydon yonidagi «kimga ko'rinadi» belgisi — bosilsa Maxfiylik bo'limiga olib boradi */
export function VisibilityChip({ level }: { level: VisibilityLevelValue }) {
  const Icon = LEVEL_ICON[level];
  return (
    <a
      href="#maxfiylik"
      title="Kimga ko'rinishini «Maxfiylik» bo'limida o'zgartirasiz"
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-surface-3 px-2 text-[11px] font-medium text-fg-3 transition hover:bg-fg/8 hover:text-fg"
    >
      <Icon size={11} /> {LEVEL_SHORT[level]}
    </a>
  );
}
