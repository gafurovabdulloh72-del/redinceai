import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logotip: "K" harfli siyoh plitka + aniq coral nuqta (blur yo'q — kichik o'lchamda ham toza) */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Kasb Egalari — bosh sahifa">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-ink text-ink-fg transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4v16" />
          <path d="M18 4l-8.5 8L18 20" />
          <path d="M6 12h3.5" />
        </svg>
        <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.03em] text-fg">
          Kasb Egalari<span className="text-accent">.</span>
        </span>
      )}
    </Link>
  );
}
