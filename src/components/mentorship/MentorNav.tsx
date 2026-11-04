import Link from "next/link";
import { ClipboardList, GraduationCap, LayoutGrid, Wallet } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { tr, type Tr } from "@/lib/i18n";
import { MK } from "@/lib/i18n/dict/mentorship";
import { cn } from "@/lib/utils";

/**
 * Mentor kabinetining yagona navigatsiyasi (2026-11-01 soddalashtirildi: 6 tab → 4).
 * «Tahlil» endi Daromad ichidan ochiladi, «Yo'l xaritasi» — Umumiy sahifadagi havoladan;
 * o'sha sahifalar o'z ota tabini faol ko'rsatadi (statistika → Daromad, yol-xaritasi → Umumiy).
 * Telefonda gorizontal aylanadi. Server komponent — til `getLocale()` dan.
 */
const TABS: ReadonlyArray<{ key: "umumiy" | "sahifa" | "daromad" | "vazifalar"; href: string; label: Tr; icon: typeof LayoutGrid }> = [
  { key: "umumiy", href: "/kabinet/mentorlik", label: MK.navOverview, icon: LayoutGrid },
  { key: "sahifa", href: "/kabinet/mentorlik/sahifa", label: MK.navPage, icon: GraduationCap },
  { key: "daromad", href: "/kabinet/mentorlik/daromad", label: MK.navMoney, icon: Wallet },
  { key: "vazifalar", href: "/kabinet/mentorlik/vazifalar", label: MK.navTasks, icon: ClipboardList },
];

export type MentorTab = (typeof TABS)[number]["key"];

export async function MentorNav({ active }: { active: MentorTab }) {
  const til = await getLocale();
  return (
    <nav aria-label={tr(til, MK.navAria)} className="no-scrollbar -mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold transition",
                  on ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-fg" : "text-fg-3 hover:text-fg",
                )}
              >
                <t.icon size={14} className={on ? "text-fg" : "text-fg-4"} />
                {tr(til, t.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
