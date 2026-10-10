import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logotip: "R" harfli siyoh plitka + aniq coral nuqta (blur yo'q — kichik o'lchamda ham toza) */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Redince — bosh sahifa">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[11px] bg-ink text-ink-fg transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="relative h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 4h7a4 4 0 0 1 0 8H5z" />
          <path d="M5 12h6l5 8" />
          <path d="M5 4v16" />
        </svg>
        <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      {!compact && (
        <span className="font-display text-[18px] font-semibold tracking-[-0.03em] text-fg">
          Redince<span className="text-accent">.</span>
        </span>
      )}
    </Link>
  );
}
