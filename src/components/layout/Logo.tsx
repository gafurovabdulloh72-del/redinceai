import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Redince — bosh sahifa">
      <span className="relative flex h-9 w-9 items-center justify-center">
        {/* Shisha kub: ikki qatlam, specular aks */}
        <span className="glass-tint absolute inset-0 rounded-[12px] transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-105" />
        <svg viewBox="0 0 24 24" className="relative h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[19px] font-bold tracking-tight text-fg">
          Red<span className="text-gradient">ince</span>
        </span>
      )}
    </Link>
  );
}
