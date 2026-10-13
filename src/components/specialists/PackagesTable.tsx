"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Clock3, RefreshCw } from "lucide-react";
import { PACKAGE_TIERS } from "@/lib/constants";
import type { ServicePackage } from "@/lib/db/schema";
import { cn, formatPrice, formatUsd } from "@/lib/utils";

/**
 * Xizmat paketlari (F31): desktopda 1–3 ustunli jadval, telefonda segment (tab) bilan bittasi.
 * "Tanlash" → /buyurtma/<id>?paket=<key>. orderBase null — tugma o'rniga izoh (egasi / obuna faol emas).
 */
export function PackagesTable({
  packages,
  orderBase,
  usdRate,
  disabledNote,
}: {
  packages: ServicePackage[];
  /** "/buyurtma/<specialistId>" yoki null */
  orderBase: string | null;
  usdRate: number;
  /** orderBase null bo'lganda tugma o'rnidagi qisqa izoh */
  disabledNote?: string;
}) {
  const sorted = [...packages].sort((a, b) => PACKAGE_TIERS.findIndex((t) => t.key === a.key) - PACKAGE_TIERS.findIndex((t) => t.key === b.key));
  const [active, setActive] = useState(sorted[Math.min(1, sorted.length - 1)]?.key ?? sorted[0]?.key);
  if (sorted.length === 0) return null;

  const cols = sorted.length === 3 ? "sm:grid-cols-3" : sorted.length === 2 ? "sm:grid-cols-2" : "";

  return (
    <div>
      {sorted.length > 1 && (
        <div className="segment mb-3 flex w-full sm:hidden" role="tablist" aria-label="Paket darajasi">
          {sorted.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={active === p.key}
              aria-controls={`pkg-${p.key}`}
              data-active={active === p.key}
              onClick={() => setActive(p.key)}
              className="segment-item min-h-10 flex-1"
            >
              {PACKAGE_TIERS.find((t) => t.key === p.key)?.label ?? p.key}
            </button>
          ))}
        </div>
      )}
      <div className={cn("grid gap-3", cols)}>
        {sorted.map((p) => {
          const tier = PACKAGE_TIERS.find((t) => t.key === p.key)?.label ?? p.key;
          const usd = formatUsd(p.price, usdRate);
          const highlight = sorted.length > 1 && p.key === "standard";
          return (
            <article
              key={p.key}
              id={`pkg-${p.key}`}
              role={sorted.length > 1 ? "tabpanel" : undefined}
              aria-label={`${tier} paket`}
              className={cn(
                "flex-col p-5",
                highlight ? "card-elevated ring-1 ring-fg/10" : "card-outline",
                active === p.key ? "flex" : "hidden sm:flex",
              )}
            >
              <p className="eyebrow">{tier}</p>
              <h3 className="mt-2 font-display text-[17px] font-semibold leading-snug tracking-tight text-fg">{p.title}</h3>
              <p className="mt-3 whitespace-nowrap font-display text-[22px] font-semibold leading-none tracking-tight text-fg lg:text-[20px] xl:text-[22px]">
                {formatPrice(p.price).replace(" so'm", "")} <span className="text-[14px] font-medium text-fg-2">so'm</span>
              </p>
              {usd && <p className="mt-1 text-[12px] text-fg-3">{usd}</p>}
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-medium text-fg-2">
                <li className="inline-flex items-center gap-1.5">
                  <Clock3 size={14} className="text-fg-3" aria-hidden="true" /> {p.deliveryDays} kunda
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <RefreshCw size={14} className="text-fg-3" aria-hidden="true" /> {p.revisions > 0 ? `${p.revisions} marta tuzatish` : "Tuzatishsiz"}
                </li>
              </ul>
              {p.features.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] leading-snug text-fg-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-success-text" aria-hidden="true" />
                      <span className="min-w-0 break-words">{f}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto pt-5">
                {orderBase ? (
                  <Link
                    href={`${orderBase}?paket=${p.key}`}
                    className={cn(
                      "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition active:scale-[0.98]",
                      highlight ? "btn-accent" : "btn-ink",
                    )}
                    aria-label={`${tier} paketni tanlash — ${formatPrice(p.price)}`}
                  >
                    Tanlash <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                ) : (
                  disabledNote && <p className="rounded-[12px] bg-surface-3 px-3 py-2.5 text-center text-[12.5px] font-medium text-fg-3">{disabledNote}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
