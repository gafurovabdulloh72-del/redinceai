"use client";

import { useEffect, useState } from "react";
import { Check, Contact, Copy, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Qisqa havola (F66): "<sayt>/u/CP82B5" + nusxalash; yonida vizitka (vCard) yuklab olish.
 * `url` — to'liq manzil (nusxalanadi), `display` — protokolsiz ko'rinish.
 */
export function ShortLink({ url, display, vcardHref, className }: { url: string; display: string; vcardHref?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* clipboard yo'q — matnni qo'lda tanlash mumkin */
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex min-h-11 min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-full border border-line bg-surface-2 py-0.5 pl-3.5 pr-0.5">
        <Link2 size={14} className="shrink-0 text-fg-3" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg-2 select-all" dir="ltr" title={url}>
          {display}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Qisqa havola nusxalandi" : "Qisqa havolani nusxalash"}
          title="Nusxalash"
          className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-fg/6", copied ? "text-success-text" : "text-fg-2 hover:text-fg")}
        >
          {copied ? <Check size={15} /> : <Copy size={14} />}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Nusxalandi" : ""}
        </span>
      </div>
      {/* basis 260px + nowrap: tor kartada maydon ostiga to'liq kenglikda o'tadi, yorliq bo'linmaydi */}
      {vcardHref && (
        <a
          href={vcardHref}
          download
          className="inline-flex min-h-11 flex-1 basis-[260px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3.5 text-[12.5px] font-semibold text-fg-2 transition hover:border-fg hover:text-fg"
          title="Kontaktni telefoningizga saqlang (vCard)"
        >
          <Contact size={14} aria-hidden="true" /> Vizitkani yuklab olish (vCard)
        </a>
      )}
    </div>
  );
}
