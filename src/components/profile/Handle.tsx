"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr } from "@/lib/i18n";
import { PROFIL_X } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

/** `@username` — bosilganda nusxalanadi (2 soniya "✓"), profil sarlavhasi ostidagi meta qatorda */
export function Handle({ username, className }: { username: string; className?: string }) {
  const til = useLocale();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`@${username}`);
          setCopied(true);
        } catch {
          /* clipboard yo'q */
        }
      }}
      aria-label={copied ? tr(til, PROFIL_X.handleCopied) : tr(til, PROFIL_X.handleCopy)}
      title={tr(til, PROFIL_X.handleCopy)}
      className={cn("press inline-flex min-h-7 items-center gap-1 rounded-full text-[13px] font-medium text-fg-2 transition hover:text-fg", className)}
    >
      @{username}
      {copied ? <Check size={12} className="text-success" aria-hidden /> : <Copy size={11} className="text-fg-4" aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? tr(til, PROFIL_X.handleCopied) : ""}
      </span>
    </button>
  );
}
