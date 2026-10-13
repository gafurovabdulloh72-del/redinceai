import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RingTone = "success" | "info" | "warning" | "danger" | "neutral";

const TONE_CLASS: Record<RingTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-fg-3",
};

/**
 * Qolgan kunlar halqasi (SVG, server komponent). value/max — ulush; markazda ixtiyoriy matn.
 * Iz (track) — chiziq rangi, yoy — holat rangi (ikkala mavzuda tokenlar orqali).
 */
export function ProgressRing({ value, max, size = 132, stroke = 10, tone = "success", label, children }: { value: number; max: number; size?: number; stroke?: number; tone?: RingTone; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn("transition-[stroke-dashoffset] duration-700", TONE_CLASS[tone])}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
