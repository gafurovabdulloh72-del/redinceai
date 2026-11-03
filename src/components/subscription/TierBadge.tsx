import type { Tier } from "@/lib/subscriptions/pro";
import { cn } from "@/lib/utils";

/** Tarif belgisi: PRO — qora plitka, MAX — marjon (accent) plitka. Standart'da chizilmaydi. */
export function TierBadge({ tier, size = "sm", til = "uz", className }: { tier: Tier; size?: "sm" | "lg"; til?: "uz" | "ru"; className?: string }) {
  if (tier === "free") return null;
  const max = tier === "max";
  return (
    <span
      title={max ? (til === "ru" ? "Max-специалист" : "Max mutaxassis") : til === "ru" ? "Pro-специалист" : "Pro mutaxassis"}
      className={cn(
        "inline-block font-bold tracking-wide",
        size === "lg" ? "ml-2 rounded-[6px] px-2 py-0.5 align-[5px] text-[11px] leading-[16px]" : "ml-1.5 rounded-[5px] px-1.5 py-px align-[1px] text-[10px] leading-[15px]",
        max ? "bg-[#ff5a36] text-white" : "bg-ink text-ink-fg",
        className,
      )}
    >
      {max ? "MAX" : "PRO"}
    </span>
  );
}
