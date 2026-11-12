import Link from "next/link";
import { ClipboardList, GraduationCap, LayoutGrid, Wallet } from "lucide-react";
import { getLocale } from "@/lib/i18n/server";
import { tr, type Tr } from "@/lib/i18n";
import { MK } from "@/lib/i18n/dict/mentorship";
import { cn } from "@/lib/utils";

/**
 * Mentor kabinetining yagona navigatsiyasi (2026-11-12: 4 tab → 3 — Kurslarim · Daromad · O'quvchilar).
 * «Sahifam» (ommaviy sahifa tahriri) endi tab emas — o'ng tomondagi ixcham tugma; «Tahlil» Daromad ichidan,
 * «Yo'l xaritasi» Kurslarim sahifasidagi havoladan ochiladi (ular o'z ota tabini faol ko'rsatadi).
 * Telefonda gorizontal aylanadi. Server komponent — til `getLocale()` dan.
 */
const TABS: ReadonlyArray<{ key: "umumiy" | "daromad" | "vazifalar"; href: string; label: Tr; icon: typeof LayoutGrid }> = [
  { key: "umumiy", href: "/kabinet/mentorlik", label: MK.navOverview, icon: LayoutGrid },
  { key: "daromad", href: "/kabinet/mentorlik/daromad", label: MK.navMoney, icon: Wallet },
  { key: "vazifalar", href: "/kabinet/mentorlik/vazifalar", label: MK.navTasks, icon: ClipboardList },
];

export type MentorTab = (typeof TABS)[number]["key"] | "sahifa";

export async function MentorNav({ active }: { active: MentorTab }) {
  const til = await getLocale();
  return (
    <nav aria-label={tr(til, MK.navAria)} className="-mx-4 mb-5 flex items-center gap-2 border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key} className="shrink-0">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold transition-colors max-sm:px-2.5",
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
      <Link
        href="/kabinet/mentorlik/sahifa"
        aria-current={active === "sahifa" ? "page" : undefined}
        aria-label={tr(til, MK.navPage)}
        title={tr(til, MK.navPage)}
        className={cn("mb-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors max-sm:w-8 max-sm:justify-center max-sm:px-0", active === "sahifa" ? "border-fg bg-fg text-bg" : "border-line-2 text-fg-2 hover:text-fg")}
      >
        <GraduationCap size={13} />
        {/* Telefonda faqat ikonka — uchala tab sig'sin */}
        <span className="max-sm:sr-only">{tr(til, MK.navPage)}</span>
      </Link>
    </nav>
  );
}
