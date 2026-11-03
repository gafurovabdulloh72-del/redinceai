import { Check, Minus } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { planComparison, type PlanCell } from "@/lib/subscriptions/pro";
import { cn } from "@/lib/utils";

/**
 * Tariflarni taqqoslash jadvali (professional SaaS uslubi): guruhlangan qatorlar, ✓ / — / aniq qiymat,
 * Pro ustuni ajratilgan (yuqorida «Tavsiya» belgisi, ustun foni). Server komponent — JS'siz.
 * Ma'lumot bitta joydan: lib/subscriptions/pro.ts `planComparison()` (/narxlar va Kabinet → Obuna).
 */
function Cell({ v, pro }: { v: PlanCell; pro?: boolean }) {
  if (v === true)
    return (
      <span className={cn("inline-grid h-6 w-6 place-items-center rounded-full", pro ? "bg-accent text-white" : "bg-fg/8 text-fg")}>
        <Check size={13} strokeWidth={3} aria-hidden />
        <span className="sr-only">Bor</span>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-grid h-6 w-6 place-items-center text-fg-4">
        <Minus size={14} aria-hidden />
        <span className="sr-only">Yo&apos;q</span>
      </span>
    );
  return <span className={cn("text-[13px] leading-snug", pro ? "font-semibold text-fg" : "text-fg-3")}>{v}</span>;
}

export function PlanCompare({ til, trialDays, proPrice, maxPrice, className }: { til: Locale; trialDays: number; proPrice?: string; maxPrice?: string; className?: string }) {
  const groups = planComparison(til, trialDays);
  const ru = til === "ru";
  return (
    <div className={cn("card overflow-hidden max-sm:!rounded-none max-sm:!border-x-0", className)}>
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="sr-only">{ru ? "Сравнение тарифов" : "Tariflarni taqqoslash"}</caption>
        <colgroup>
          <col />
          <col className="w-[22%] sm:w-[20%]" />
          <col className="w-[22%] sm:w-[20%]" />
          <col className="w-[24%] sm:w-[21%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="px-3 py-4 align-bottom text-[12px] font-semibold text-fg-3 sm:px-6">
              {ru ? "Возможности" : "Imkoniyatlar"}
            </th>
            <th scope="col" className="px-1.5 py-4 text-center align-bottom sm:px-3">
              <span className="block font-display text-[14px] font-semibold text-fg sm:text-[15px]">{ru ? "Стандарт" : "Standart"}</span>
              <span className="mt-0.5 block text-[11px] text-fg-3">{ru ? "Бесплатно" : "Bepul"}</span>
            </th>
            <th scope="col" className="px-1.5 py-4 text-center align-bottom sm:px-3">
              <span className="block font-display text-[14px] font-semibold text-fg sm:text-[15px]">Pro</span>
              {proPrice && <span className="mt-0.5 block text-[11px] text-fg-3">{proPrice}</span>}
            </th>
            <th scope="col" className="relative bg-accent/[0.06] px-1.5 pb-4 pt-7 text-center align-bottom sm:px-3">
              <span className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden />
              <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-px text-[9.5px] font-bold uppercase tracking-[0.08em] text-white">
                {ru ? "Лучший" : "Eng yaxshi"}
              </span>
              <span className="block font-display text-[14px] font-semibold text-fg sm:text-[15px]">Max</span>
              {maxPrice && <span className="mt-0.5 block text-[11px] font-medium text-fg-2">{maxPrice}</span>}
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.title}>
            <tr>
              <th colSpan={4} scope="colgroup" className="bg-surface-2 px-3 pb-2 pt-4 text-[11.5px] font-bold uppercase tracking-[0.08em] text-fg-3 sm:px-6">
                {g.title}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.label} className="border-t border-line first:border-t-0">
                <th scope="row" className="px-3 py-3 align-middle font-normal sm:px-6">
                  <span className="block text-[13px] font-medium leading-snug text-fg sm:text-[13.5px]">{r.label}</span>
                  {r.hint && <span className="mt-0.5 block text-[12px] leading-snug text-fg-3">{r.hint}</span>}
                </th>
                <td className="px-1.5 py-3 text-center align-middle sm:px-3">
                  <Cell v={r.free} />
                </td>
                <td className="px-1.5 py-3 text-center align-middle sm:px-3">
                  <Cell v={r.pro} />
                </td>
                <td className="bg-accent/[0.06] px-1.5 py-3 text-center align-middle sm:px-3">
                  <Cell v={r.max} pro />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
