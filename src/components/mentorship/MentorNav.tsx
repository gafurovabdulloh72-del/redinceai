import Link from "next/link";
import { BarChart3, ClipboardList, GraduationCap, LayoutGrid, Route, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mentor kabinetining yagona navigatsiyasi — oldin har sahifada boshqacha havolalar bor edi,
 * endi hamma joyda bir xil tab qatori (v6: ramkasiz, faol band ostida 2px chiziq).
 * Telefonda gorizontal aylanadi.
 */
const TABS = [
  { key: "umumiy", href: "/kabinet/mentorlik", label: "Umumiy", icon: LayoutGrid },
  { key: "sahifa", href: "/kabinet/mentorlik/sahifa", label: "Sahifam", icon: GraduationCap },
  { key: "daromad", href: "/kabinet/mentorlik/daromad", label: "Daromad", icon: Wallet },
  { key: "vazifalar", href: "/kabinet/mentorlik/vazifalar", label: "Vazifalar", icon: ClipboardList },
  { key: "statistika", href: "/kabinet/mentorlik/statistika", label: "Tahlil", icon: BarChart3 },
  { key: "yol-xaritasi", href: "/kabinet/mentorlik/yol-xaritasi", label: "Yo'l xaritasi", icon: Route },
] as const;

export type MentorTab = (typeof TABS)[number]["key"];

export function MentorNav({ active }: { active: MentorTab }) {
  return (
    <nav aria-label="Mentorlik bo'limlari" className="no-scrollbar -mx-4 mb-5 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
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
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
